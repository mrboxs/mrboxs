// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	RouterContextProvider,
} from '@tanstack/react-router'

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { Blog } from '#/components/portfolio/blog'
import type { PostMetadata } from '#/lib/blog'
import { listPosts } from '#/lib/blog.server'
import { orpc } from '#/orpc/client'

import { blogMetadata } from '../../helpers/blog'
import { actAndFlush } from '../../helpers/react'

const { updates } = vi.hoisted(() => ({ updates: vi.fn() }))
vi.mock('#/hooks/use-blog-updates', () => ({ useBlogUpdates: updates }))
vi.mock('void/env', () => ({ env: {} }))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	listPosts: vi.fn(),
}))
vi.mock(import('#/orpc/client'), async () => {
	const { createRouterClient } = await import('@orpc/server')
	const { createTanstackQueryUtils } = await import('@orpc/tanstack-query')
	const { routers } = await import('#/orpc/routers')
	return {
		orpc: createTanstackQueryUtils(
			createRouterClient(routers, { context: {} })
		),
	}
})

let root: Root
let container: HTMLDivElement
let client: QueryClient
let router: ReturnType<typeof createTestRouter>

const posts = Array.from({ length: 5 }, (_, index) => ({
	...blogMetadata,
	slug: `post-${index + 1}`,
	title: `Published post ${index + 1}`,
	cover: {
		...blogMetadata.cover,
		src: {
			...blogMetadata.cover.src,
			path: `posts/post-${index + 1}/cover.png`,
		},
	},
}))

function createTestRouter(queryClient: QueryClient) {
	const rootRoute = createRootRouteWithContext<{
		queryClient: QueryClient
		orpc: typeof orpc
	}>()()
	return createRouter({
		context: { queryClient, orpc },
		history: createMemoryHistory({ initialEntries: ['/'] }),
		routeTree: rootRoute.addChildren([
			createRoute({ getParentRoute: () => rootRoute, path: '/' }),
			createRoute({ getParentRoute: () => rootRoute, path: '/blog' }),
			createRoute({ getParentRoute: () => rootRoute, path: '/blog/$slug' }),
		]),
	})
}

beforeEach(async () => {
	vi.clearAllMocks()
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	vi.mocked(listPosts).mockResolvedValue(posts)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	router = createTestRouter(client)
	await router.load()
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	client.clear()
	router.history.destroy()
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

async function tick(action: () => void = () => undefined) {
	await act(async () => {
		action()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}

async function render() {
	await actAndFlush(() =>
		root.render(
			<QueryClientProvider client={client}>
				<RouterContextProvider router={router}>
					<Blog />
				</RouterContextProvider>
			</QueryClientProvider>
		)
	)
	await tick()
}

it('shows the total published count but only the first four cards, with lazy images and working links', async () => {
	await render()
	expect(container.querySelector('#blog-title sup')?.textContent).toBe('(5)')
	expect(
		[...container.querySelectorAll('h3')].map((h) => h.textContent)
	).toEqual(posts.slice(0, 4).map((p) => p.title))
	expect(container.querySelectorAll('h2')).toHaveLength(1)
	expect(
		[...container.querySelectorAll('img')].every(
			(image) => image.loading === 'lazy'
		)
	).toBe(true)
	expect(updates).toHaveBeenCalledWith(blogMetadata.cover.src.commit)
	const first = container.querySelector<HTMLAnchorElement>(
		'a[href="/blog/post-1"]'
	)
	const all = container.querySelector<HTMLAnchorElement>('a[href="/blog"]')
	if (!first || !all) throw new Error('Missing blog navigation')
	expect(all.textContent).toBe('All posts')
	await act(async () => {
		first.click()
		await router.load()
	})
	expect(router.state.location.pathname).toBe('/blog/post-1')
	await act(async () => {
		all.click()
		await router.load()
	})
	expect(router.state.location.pathname).toBe('/blog')
})

it('keeps loading local to the section and does not invent a count before the empty response arrives', async () => {
	let resolvePosts: ((value: Array<PostMetadata>) => void) | undefined
	vi.mocked(listPosts).mockReturnValue(
		new Promise((resolve) => {
			resolvePosts = resolve
		})
	)
	await render()
	expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe(
		'true'
	)
	expect(container.querySelector('output')?.textContent).toBe('Memuat tulisan…')
	expect(container.querySelector('sup')).toBeNull()
	expect(updates).not.toHaveBeenCalled()
	await tick(() => resolvePosts?.([]))
	await tick()
	expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe(
		'false'
	)
	expect(container.querySelector('sup')?.textContent).toBe('(0)')
	expect(container.textContent).toContain(
		'Belum ada tulisan yang dipublikasikan.'
	)
	expect(container.querySelector('a[href="/blog"]')).not.toBeNull()
})

it('recovers from a source failure using the section retry button', async () => {
	vi.mocked(listPosts).mockRejectedValueOnce(new Error('private-source-detail'))
	await render()
	expect(container.querySelector('[role="alert"]')?.textContent).toBe(
		'Tulisan belum bisa dimuat.'
	)
	expect(container.textContent).not.toContain('private-source-detail')
	expect(container.querySelector('sup')).toBeNull()
	const retry = container.querySelector<HTMLButtonElement>('button')
	if (!retry) throw new Error('Missing retry button')
	await tick(() => retry.click())
	await tick()
	expect(listPosts).toHaveBeenCalledTimes(2)
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(container.querySelectorAll('h3')).toHaveLength(4)
})

it('updates the count and latest cards when shared cache data changes, retaining them after a background failure', async () => {
	await render()
	await tick(() =>
		client.setQueryData(orpc.blog.list.queryKey({ input: {} }), posts.slice(2))
	)
	expect(container.querySelector('sup')?.textContent).toBe('(3)')
	expect(
		[...container.querySelectorAll('h3')].map((h) => h.textContent)
	).toEqual(posts.slice(2).map((p) => p.title))
	vi.mocked(listPosts).mockRejectedValueOnce(
		new Error('background-source-error')
	)
	await act(async () => {
		await client.refetchQueries({
			queryKey: orpc.blog.list.queryKey({ input: {} }),
		})
	})
	await tick()
	expect(container.querySelectorAll('h3')).toHaveLength(3)
	expect(container.querySelector('sup')?.textContent).toBe('(3)')
	expect(container.querySelector('button')).toBeNull()
})
