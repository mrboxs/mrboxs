import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	BlogSourceError,
	getPostBySlug,
	PostNotFoundError,
} from '#/lib/blog.server'
import { handleOgRequest } from '#/lib/og/image.server'

import { blogPost } from '../helpers/blog'

const render = vi.hoisted(() => vi.fn<() => Response>())
vi.mock('void/env', () => ({
	env: {
		APP_URL: 'https://portfolio.example.test',
		VITE_APP_URL: 'https://portfolio.example.test',
	},
}))
vi.mock('@vercel/og', () => ({
	ImageResponse: function () {
		return render()
	},
}))
vi.mock(import('#/lib/blog.server'), async (original) => ({
	...(await original()),
	getPostBySlug: vi.fn(),
}))

function request(slug?: string, method = 'GET') {
	return handleOgRequest(
		new Request('https://example.com/og/default.png?v=untrusted', { method }),
		slug
	)
}

beforeEach(() => {
	vi.resetAllMocks()
	vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
	render.mockImplementation(
		() => new Response(new Uint8Array([137, 80, 78, 71]))
	)
})

describe('dynamic OG HTTP contract', () => {
	it('renders the default preview without accessing the blog source', async () => {
		const response = await request()
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toBe('image/png')
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(
			new Uint8Array([137, 80, 78, 71])
		)
		expect(getPostBySlug).not.toHaveBeenCalled()
	})

	it('reads the currently public post without trusting caller-supplied revisions', async () => {
		expect((await request(blogPost.slug)).status).toBe(200)
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogPost.slug)
	})

	it('reuses a rendered image but still removes access after unpublishing', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue({
			...blogPost,
			title: 'Cached public article',
		})
		await request(blogPost.slug)
		await request(blogPost.slug)
		expect(render).toHaveBeenCalledTimes(1)
		vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
		expect((await request(blogPost.slug)).status).toBe(404)
		expect(getPostBySlug).toHaveBeenCalledTimes(3)
	})

	it.each(['draft', 'missing'])(
		'returns a generic 404 for %s',
		async (slug) => {
			vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
			const response = await request(slug)
			expect(response.status).toBe(404)
			expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
			expect(await response.text()).toBe('Not found')
			expect(render).not.toHaveBeenCalled()
		}
	)

	it('checks publication for HEAD while avoiding image rendering', async () => {
		const response = await request(blogPost.slug, 'HEAD')
		expect(response.status).toBe(200)
		expect(await response.text()).toBe('')
		expect(response.headers.get('Content-Type')).toBe('image/png')
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogPost.slug)
		expect(render).not.toHaveBeenCalled()
	})

	it('rejects writes before reading data or rendering', async () => {
		const response = await request(blogPost.slug, 'POST')
		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET, HEAD')
		expect(render).not.toHaveBeenCalled()
		expect(getPostBySlug).not.toHaveBeenCalled()
	})

	it.each([
		{ error: new BlogSourceError('configuration'), status: 500 },
		{ error: new BlogSourceError('network'), status: 502 },
		{ error: new BlogSourceError('rate-limit'), status: 503 },
		{ error: new Error('private token'), status: 500 },
	])('sanitizes source failures ($status)', async ({ error, status }) => {
		vi.mocked(getPostBySlug).mockRejectedValue(error)
		const response = await request(blogPost.slug)
		expect(response.status).toBe(status)
		expect(await response.text()).toBe('Image temporarily unavailable')
	})

	it('converts streaming render failures into a failed HTTP response', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue({
			...blogPost,
			title: 'Streaming render failure',
		})
		const log = vi.spyOn(console, 'error').mockImplementation(vi.fn())
		render.mockImplementation(
			() =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.error(new Error('render failed'))
						},
					})
				)
		)
		const response = await request(blogPost.slug)
		expect(response.status).toBe(503)
		expect(response.headers.get('Content-Type')).not.toBe('image/png')
		expect(await response.text()).toBe('Image temporarily unavailable')
		log.mockRestore()
	})
})
