import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	BlogSourceError,
	getPostBySlug,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'
import { handleCrawlerRequest, llmsIndex, sitemap } from '#/lib/crawlers.server'
import type { CrawlerDocument } from '#/lib/crawlers.server'
import { publicUrl } from '#/lib/site'

import { blogMetadata, blogPost } from '../helpers/blog'

vi.mock('void/env', () => ({ env: {} }))
vi.mock(import('#/lib/blog.server'), async (original) => ({
	...(await original()),
	listPosts: vi.fn(),
	getPostBySlug: vi.fn(),
}))

function request(document: CrawlerDocument, method = 'GET') {
	return handleCrawlerRequest(
		new Request(`https://untrusted.example/${document}`, { method }),
		document
	)
}

beforeEach(() => {
	vi.resetAllMocks()
	vi.mocked(listPosts).mockResolvedValue([blogMetadata])
	vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
})

describe('crawler endpoints', () => {
	it('serves robots independently of GitHub, using the trusted canonical host', async () => {
		vi.mocked(listPosts).mockRejectedValue(new Error('offline'))
		const response = await request('robots')
		expect(response.status).toBe(200)
		const text = await response.text()
		expect(text).toContain(`Sitemap: ${publicUrl('/sitemap.xml')}`)
		expect(text).toContain('User-agent: *\nAllow: /')
		expect(text).not.toContain('Disallow: /api/\n')
		expect(text).not.toContain('untrusted.example')
		expect(listPosts).not.toHaveBeenCalled()
	})

	it('serves current canonical pages and cover images, with no fabricated modification dates', async () => {
		const response = await request('sitemap')
		expect(response.headers.get('Content-Type')).toBe(
			'application/xml; charset=utf-8'
		)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.text()
		expect(body).toContain(`<loc>${publicUrl('/blog/tulisan-pertama')}</loc>`)
		expect(body).toContain(
			`<image:loc>${publicUrl('/api/blog/assets/tulisan-pertama/cover.png')}</image:loc>`
		)
		expect(body).not.toContain('<lastmod>')
		expect(body).not.toContain('untrusted.example')
		vi.mocked(listPosts).mockResolvedValue([])
		expect(await (await request('sitemap')).text()).not.toContain(
			'/blog/tulisan-pertama'
		)
	})

	it('omits malformed cover paths and encodes page paths safely in XML', () => {
		const text = sitemap([
			{
				...blogMetadata,
				slug: 'a&<b',
				cover: {
					...blogMetadata.cover,
					src: { ...blogMetadata.cover.src, path: '../private' },
				},
			},
		])
		expect(text).toContain('/blog/a%26%3Cb')
		expect(text).not.toContain('image:image>')
		expect(text).not.toContain('../private')
	})

	it('provides attributed text and Markdown links for public articles', async () => {
		const response = await request('llms')
		expect(response.headers.get('Content-Type')).toBe(
			'text/plain; charset=utf-8'
		)
		const body = await response.text()
		expect(body).toContain(`# MrBoxs`)
		expect(body).toContain(publicUrl('/blog/tulisan-pertama.md'))
		expect(body).toContain('Written by MrBoxs')
		expect(body).toContain('https://github.com/mrboxs/mrboxs')
		expect(body).not.toContain('www.linkedin.com')
		expect(llmsIndex([])).toContain('No published posts yet.')
		expect(llmsIndex([{ ...blogMetadata, title: 'A [label]\\' }])).toContain(
			'A \\[label\\]\\\\'
		)
	})

	it('serves the full text through the published-post reader', async () => {
		const response = await request('llms-full')
		const body = await response.text()
		expect(body).toContain(blogPost.body)
		expect(body).toContain(`Source: ${publicUrl('/blog/tulisan-pertama')}`)
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogPost.slug)
	})

	it.each(['robots', 'sitemap', 'llms', 'llms-full'] as const)(
		'supports HEAD and rejects writes for %s',
		async (document) => {
			const head = await request(document, 'HEAD')
			expect(head.status).toBe(200)
			expect(await head.text()).toBe('')
			vi.clearAllMocks()
			const write = await request(document, 'POST')
			expect(write.status).toBe(405)
			expect(write.headers.get('Allow')).toBe('GET, HEAD')
			expect(listPosts).not.toHaveBeenCalled()
		}
	)

	it('returns an explicit failure when GitHub is unavailable instead of an empty sitemap', async () => {
		vi.mocked(listPosts).mockRejectedValue(
			new Error('private repository and secret token')
		)
		const response = await request('sitemap')
		expect(response.status).toBe(503)
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
		expect(response.headers.get('Retry-After')).toBe('60')
		expect(await response.text()).toBe(
			'Site information temporarily unavailable'
		)
	})

	it('handles missing configuration and publication changes without exposing content', async () => {
		vi.mocked(listPosts).mockRejectedValueOnce(
			new BlogSourceError('configuration')
		)
		expect((await request('llms')).status).toBe(500)
		vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
		const response = await request('llms-full')
		expect(response.status).toBe(503)
		expect(await response.text()).not.toContain(blogPost.title)
	})
})
