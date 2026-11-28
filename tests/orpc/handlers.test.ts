import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { WideEvent } from 'evlog'
import {
	enableDiagnosticsChannel,
	subscribeToWideEvents,
} from 'evlog/diagnostics'

import { getPostBySlug, listPosts } from '#/lib/blog.server'
import { openApiHandler, rpcHandler } from '#/orpc/handlers'
import type { ORPCRouterClient } from '#/orpc/routers'

import { blogMetadata, blogPost, renderedBlogPost } from '../helpers/blog'

vi.mock('void/env', () => ({ env: {} }))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	listPosts: vi.fn(),
	getPostBySlug: vi.fn(),
}))

beforeEach(() => {
	vi.resetAllMocks()
	vi.mocked(listPosts).mockResolvedValue([blogMetadata])
	vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
})

describe('configured oRPC handlers', () => {
	it.each(['QUERY', 'POST'] as const)(
		'round-trips real RPC encoding for list and detailed input using %s',
		async (method) => {
			const client: ORPCRouterClient = createORPCClient(
				new RPCLink({
					origin: 'https://example.com',
					url: '/api/rpc',
					method,
					fetch: async (url, init) => {
						const result = await rpcHandler.handle(new Request(url, init), {
							prefix: '/api/rpc',
						})
						if (!result.matched) throw new Error('Unmatched RPC request')
						return result.response
					},
				})
			)
			await expect(client.blog.list({})).resolves.toEqual([blogMetadata])
			await expect(
				client.blog.getBySlug({ params: { slug: blogMetadata.slug } })
			).resolves.toEqual(renderedBlogPost)
			expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogMetadata.slug)
		}
	)

	it('does not dispatch GET requests to RPC procedures', async () => {
		const result = await rpcHandler.handle(
			new Request('https://example.com/api/rpc/blog/list'),
			{ prefix: '/api/rpc' }
		)
		expect(result.matched).toBe(false)
		expect(listPosts).not.toHaveBeenCalled()
	})

	it('serves compact REST responses without bearer authentication', async () => {
		for (const [path, method, expected] of [
			['/blogs', 'QUERY', [blogMetadata]],
			[`/blogs/${blogMetadata.slug}`, 'GET', renderedBlogPost],
		] as const) {
			const result = await openApiHandler.handle(
				new Request(`https://example.com/api/reference${path}`, { method }),
				{ prefix: '/api/reference' }
			)
			expect(result.response.status).toBe(200)
			expect(await result.response.json()).toEqual(expected)
		}
	})

	it('includes an unmapped OpenAPI request and its structured 404 in one event', async () => {
		const events: Array<WideEvent> = []
		const stop = await enableDiagnosticsChannel()
		const unsubscribe = await subscribeToWideEvents((event) =>
			events.push(event)
		)
		try {
			const { response } = await openApiHandler.handle(
				new Request('https://example.com/api/reference/unmapped'),
				{ prefix: '/api/reference' }
			)

			expect(response.status).toBe(404)
			expect(response.headers.get('Cache-Control')).toBe('no-store')
			expect(await response.json()).toMatchObject({
				status: 404,
				data: { code: 'OPENAPI_ROUTE_NOT_FOUND', link: '/api/reference' },
			})
			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({
				action: 'openapi.request',
				openapi: { matched: false },
				status: 404,
				error: { message: 'API endpoint not found' },
			})
		} finally {
			unsubscribe()
			stop()
		}
	})

	it('generates an origin-independent spec that describes public blog operations', async () => {
		const result = await openApiHandler.handle(
			new Request('https://preview.example.test/api/reference/spec.json'),
			{ prefix: '/api/reference' }
		)
		expect(result.response.status).toBe(200)
		const spec = await result.response.json()
		expect(spec).toMatchObject({
			openapi: '3.2.0',
			servers: [{ url: '/api/reference' }],
			paths: {
				'/blogs': { query: { operationId: 'listBlogs' } },
				'/blogs/{slug}': { get: { operationId: 'getBlogBySlug' } },
			},
		})
		expect(spec).not.toHaveProperty('security')
		expect(listPosts).not.toHaveBeenCalled()
		expect(getPostBySlug).not.toHaveBeenCalled()
	})
})
