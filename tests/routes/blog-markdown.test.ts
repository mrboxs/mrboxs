import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { handleBlogMarkdownRequest } from '#/lib/blog-markdown.server'
import {
	BlogSourceError,
	getPostBySlug,
	InvalidBlogContentError,
	PostNotFoundError,
} from '#/lib/blog.server'

import { blogPost } from '../helpers/blog'

vi.mock('void/env', () => ({ env: {} }))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	getPostBySlug: vi.fn(),
}))

function request(slug = blogPost.slug, method = 'GET') {
	return handleBlogMarkdownRequest(
		new Request(`https://example.com/blog/${slug}.md`, { method }),
		slug
	)
}

beforeEach(() => {
	vi.resetAllMocks()
})

describe('public article Markdown', () => {
	it('serves the published article as inline text without rewriting its body', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue({
			...blogPost,
			title: 'Judul 📝',
		})
		const response = await request()
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe(
			'text/plain; charset=utf-8'
		)
		expect(response.headers.get('Content-Disposition')).toBeNull()
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
		expect(await response.text()).toBe(
			`# Judul 📝\n\n${blogPost.description}\n\n${blogPost.body}`
		)
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogPost.slug)
	})

	it('checks publication for HEAD and returns the same headers without a body', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
		const response = await request(blogPost.slug, 'HEAD')
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe(
			'text/plain; charset=utf-8'
		)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(await response.text()).toBe('')
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogPost.slug)
	})

	it.each(['missing', 'draft'])(
		'returns the same generic 404 for a %s article',
		async (slug) => {
			vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
			const response = await request(slug)
			expect(response.status).toBe(404)
			expect(await response.text()).toBe('Not found')
			expect(response.headers.get('Cache-Control')).toBe('no-store')
		}
	)

	it.each([
		{ error: new BlogSourceError('access', 404), status: 502 },
		{ error: new BlogSourceError('network'), status: 502 },
		{ error: new BlogSourceError('rate-limit', 403), status: 503 },
		{ error: new BlogSourceError('configuration'), status: 500 },
		{
			error: new InvalidBlogContentError(
				'posts/private-draft/index.md',
				'title'
			),
			status: 500,
		},
		{ error: new Error('secret-token, authorization headers'), status: 500 },
	])(
		'sanitizes source failures ($status: $error)',
		async ({ error, status }) => {
			vi.mocked(getPostBySlug).mockRejectedValue(error)
			const response = await request()
			expect(response.status).toBe(status)
			expect(response.headers.get('Cache-Control')).toBe('no-store')
			expect(await response.text()).toBe('Article temporarily unavailable')
		}
	)

	it('returns no body for a missing article on HEAD', async () => {
		vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
		const response = await request('missing', 'HEAD')
		expect(response.status).toBe(404)
		expect(await response.text()).toBe('')
	})

	it('rejects unsupported methods before reading any content', async () => {
		const response = await request(blogPost.slug, 'POST')
		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET, HEAD')
		expect(await response.text()).toBe('Method not allowed')
		expect(getPostBySlug).not.toHaveBeenCalled()
	})
})
