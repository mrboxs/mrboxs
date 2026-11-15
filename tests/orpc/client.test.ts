// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { QueryClient } from '@tanstack/react-query'

import { getContext } from '#/integrations/tanstack-query/root-provider'
import { getPostBySlug, listPosts } from '#/lib/blog.server'
import { client, orpc } from '#/orpc/client'
import { rpcHandler } from '#/orpc/handlers'

import { blogMetadata, blogPost } from '../helpers/blog'

vi.hoisted(() => {
	window.location.href = 'https://preview.example.test/blog'
})
vi.mock('@tanstack/react-start', () => ({
	createIsomorphicFn: () => ({
		server: () => ({ client: (factory: () => unknown) => factory }),
	}),
}))
vi.mock('void/env', () => ({
	env: { VITE_APP_URL: 'http://wrong-host.invalid' },
}))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	listPosts: vi.fn(),
	getPostBySlug: vi.fn(),
}))

const transport = vi.fn<typeof fetch>(async (url, init) => {
	const address = url instanceof Request ? url.url : url.toString()
	const request = new Request(new URL(address, window.location.href), init)
	const result = await rpcHandler.handle(request, { prefix: '/api/rpc' })
	if (!result.matched) throw new Error('Unmatched browser RPC request')
	return result.response
})

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubGlobal('fetch', transport)
	vi.mocked(listPosts).mockResolvedValue([blogMetadata])
	vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
})

afterEach(() => vi.unstubAllGlobals())

describe('isomorphic oRPC browser client', () => {
	it('uses the current origin and shares loader/hook query keys without repeat fetches', async () => {
		const queryClient = new QueryClient()
		try {
			const options = orpc.blog.list.queryOptions({
				input: {},
				retry: false,
				staleTime: 30_000,
			})
			await expect(queryClient.query(options)).resolves.toEqual([blogMetadata])
			await expect(queryClient.query(options)).resolves.toEqual([blogMetadata])
			expect(transport).toHaveBeenCalledTimes(1)
			const [url, init] = transport.mock.calls[0]
			const address = url instanceof Request ? url.url : url.toString()
			expect(new URL(address, window.location.href).origin).toBe(
				'https://preview.example.test'
			)
			expect(init).toMatchObject({ method: 'QUERY', credentials: 'include' })
		} finally {
			queryClient.clear()
		}
	})

	it('keeps detailed slug input intact over the browser RPC transport', async () => {
		await expect(
			client.blog.getBySlug({ params: { slug: blogMetadata.slug } })
		).resolves.toEqual(blogPost)
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogMetadata.slug)
		expect(transport.mock.calls[0][1]?.method).toBe('QUERY')
	})

	it('does not turn a Query mutation into a QUERY request because of its name or cache hint', async () => {
		const queryClient = new QueryClient()
		try {
			const mutation = queryClient.getMutationCache().build(
				queryClient,
				orpc.blog.getBySlug.mutationOptions({
					context: { cache: 'no-store' },
				})
			)
			await expect(
				mutation.execute({ params: { slug: blogMetadata.slug } })
			).resolves.toEqual(blogPost)
			expect(transport.mock.calls[0][1]).toMatchObject({
				method: 'POST',
				cache: 'no-store',
			})
		} finally {
			queryClient.clear()
		}
	})

	it('supplies oRPC in router context and isolates Query caches per router instance', () => {
		const first = getContext()
		const second = getContext()
		try {
			expect(first.orpc).toBe(orpc)
			expect(first.queryClient).not.toBe(second.queryClient)
			const key = orpc.blog.list.queryKey({ input: {} })
			first.queryClient.setQueryData(key, [blogMetadata])
			expect(second.queryClient.getQueryData(key)).toBeUndefined()
		} finally {
			first.queryClient.clear()
			second.queryClient.clear()
		}
	})
})
