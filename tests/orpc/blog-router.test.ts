import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { OpenAPIHandler } from '@orpc/openapi/fetch'

import { ORPC_ERRORS } from '#/constants/orpc-errors'
import type { BlogPost, PostMetadata } from '#/lib/blog'
import {
	BlogAssetTooLargeError,
	BlogSourceError,
	getBlogRevision,
	getPostBySlug,
	InvalidBlogContentError,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'
import { blogRouter } from '#/orpc/routers/blog-router'

vi.mock('void/env', () => ({ env: {} }))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	listPosts: vi.fn(),
	getPostBySlug: vi.fn(),
	getBlogRevision: vi.fn(),
}))

const metadata: PostMetadata = {
	title: 'Tulisan Pertama',
	slug: 'tulisan-pertama',
	description: 'Catatan pertama.',
	publishedAt: '2026-11-15',
	tags: ['personal'],
	author: { id: 'mrboxs', name: 'MrBoxs', url: 'https://github.com/mrboxs' },
	cover: {
		src: { commit: 'a'.repeat(40), path: 'posts/tulisan-pertama/cover.png' },
		alt: 'Cover tulisan pertama.',
	},
}
const post: BlogPost = {
	...metadata,
	body: '## Tulisan\n\n![Cover](./cover.png)\n',
	assets: { 'cover.png': metadata.cover.src },
}
const handler = new OpenAPIHandler({ blog: blogRouter })

async function request(path: string, method = 'GET') {
	const result = await handler.handle(
		new Request(`https://example.com/api${path}`, { method }),
		{ prefix: '/api' }
	)
	if (!result.matched) throw new Error('Expected a matching blog procedure')
	return result.response
}

beforeEach(() => {
	vi.resetAllMocks()
})

describe('blog oRPC router', () => {
	it('exposes only the validated current revision without rendering or listing articles', async () => {
		vi.mocked(getBlogRevision).mockResolvedValue('a'.repeat(40))
		const response = await request('/blog-revision', 'QUERY')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ revision: 'a'.repeat(40) })
		expect(getBlogRevision).toHaveBeenCalledExactlyOnceWith()
		expect(getPostBySlug).not.toHaveBeenCalled()
		expect(listPosts).not.toHaveBeenCalled()
	})

	it('rejects malformed revision output instead of exposing it as a valid version', async () => {
		vi.mocked(getBlogRevision).mockResolvedValue('private-source-error')
		const response = await request('/blog-revision', 'QUERY')
		expect(response.status).toBe(500)
		expect(await response.text()).not.toContain('private-source-error')
	})

	it('returns the public list as a compact array, including an empty list', async () => {
		vi.mocked(listPosts)
			.mockResolvedValueOnce([metadata])
			.mockResolvedValueOnce([])
		const response = await request('/blogs', 'QUERY')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual([metadata])
		expect(await (await request('/blogs', 'QUERY')).json()).toEqual([])
		expect(listPosts).toHaveBeenCalledTimes(2)
		expect(getPostBySlug).not.toHaveBeenCalled()
	})

	it('maps detailed path params and adds rendering data without rewriting the article', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue(post)
		const response = await request('/blogs/tulisan-pertama')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			...post,
			prepared: { codeBlocks: {} },
		})
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith('tulisan-pertama')
		expect(listPosts).not.toHaveBeenCalled()
	})

	it('includes serializable code blocks through the output schema', async () => {
		const code = '\tconst value = 1;  \n\n'
		const body = `Intro\n\n\`\`\`TS\n${code}\n\`\`\``
		vi.mocked(getPostBySlug).mockResolvedValue({ ...post, body })
		const response = await request('/blogs/tulisan-pertama')
		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({
			body,
			prepared: {
				codeBlocks: { [body.indexOf('```')]: { code, language: 'ts' } },
			},
		})
	})

	it('rejects invalid slugs before invoking the source service', async () => {
		const response = await request('/blogs/Invalid-Slug')
		expect(response.status).toBe(400)
		expect(getPostBySlug).not.toHaveBeenCalled()
	})

	it('returns the same public 404 for a missing or unpublished article', async () => {
		vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
		for (const slug of ['missing', 'draft']) {
			const response = await request(`/blogs/${slug}`)
			expect(response.status).toBe(404)
			expect(await response.json()).toMatchObject({
				code: 'NOT_FOUND',
				message: ORPC_ERRORS.NOT_FOUND.message,
				data: {
					why: 'The article is missing or unpublished.',
					link: '/blog',
				},
			})
		}
	})

	it.each(['/blog-revision', '/blogs', '/blogs/tulisan-pertama'])(
		'maps GitHub rate limits to the declared error for %s',
		async (path) => {
			const error = new BlogSourceError('rate-limit', 403)
			vi.mocked(listPosts).mockRejectedValue(error)
			vi.mocked(getPostBySlug).mockRejectedValue(error)
			vi.mocked(getBlogRevision).mockRejectedValue(error)
			const response = await request(
				path,
				path === '/blogs/tulisan-pertama' ? 'GET' : 'QUERY'
			)
			expect(response.status).toBe(429)
			expect(await response.json()).toMatchObject({
				code: 'TOO_MANY_REQUESTS',
				message: ORPC_ERRORS.TOO_MANY_REQUESTS.message,
			})
		}
	)

	it.each([
		new BlogSourceError('access', 404),
		new BlogSourceError('access', 401),
		new BlogSourceError('configuration'),
		new BlogSourceError('network'),
		new BlogSourceError('upstream', 503),
		new BlogSourceError('invalid-response'),
		new InvalidBlogContentError('posts/private-draft/index.md', 'title'),
		new BlogAssetTooLargeError(),
		new Error('Unexpected failure with secret-token and authorization headers'),
	])(
		'sanitizes source failures instead of returning client auth/content errors: %s',
		async (error) => {
			vi.mocked(listPosts).mockRejectedValue(error)
			vi.mocked(getPostBySlug).mockRejectedValue(error)
			vi.mocked(getBlogRevision).mockRejectedValue(error)
			for (const path of [
				'/blog-revision',
				'/blogs',
				'/blogs/tulisan-pertama',
			]) {
				const response = await request(
					path,
					path === '/blogs/tulisan-pertama' ? 'GET' : 'QUERY'
				)
				expect(response.status).toBe(500)
				const body = await response.text()
				expect(JSON.parse(body)).toMatchObject({
					code: 'INTERNAL_SERVER_ERROR',
					message: ORPC_ERRORS.INTERNAL_SERVER_ERROR.message,
				})
				expect(body).not.toMatch(
					/secret-token|authorization|private-draft|INVALID_BLOG_CONTENT|BLOG_SOURCE_ERROR/
				)
			}
		}
	)
})
