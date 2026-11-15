// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
	getPostBySlug,
	InvalidBlogContentError,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'
import { getRouter } from '#/router'

import { blogMetadata, blogPost } from '../helpers/blog'
import { actAndFlush } from '../helpers/react'

vi.mock('void/env', () => ({ env: {} }))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	listPosts: vi.fn(),
	getPostBySlug: vi.fn(),
}))
vi.mock(import('#/orpc/client'), async () => {
	const { createRouterClient } = await import('@orpc/server')
	const { createTanstackQueryUtils } = await import('@orpc/tanstack-query')
	const { routers } = await import('#/orpc/routers')
	const client = createRouterClient(routers, { context: {} })
	return {
		client,
		orpc: createTanstackQueryUtils(client),
		blogORPC: createTanstackQueryUtils(client.blog, { prefix: 'blogs' }),
	}
})

vi.mock('#/routes/__root', async () => {
	const { createRootRouteWithContext, Outlet } =
		await import('@tanstack/react-router')
	const { orpc } = await import('#/orpc/client')
	return {
		Route: createRootRouteWithContext<{
			queryClient: QueryClient
			orpc: typeof orpc
		}>()({ component: Outlet }),
	}
})

let root: Root
let container: HTMLDivElement
let router: ReturnType<typeof getRouter>

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	vi.mocked(listPosts).mockResolvedValue([blogMetadata])
	vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	router = getRouter()
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	router.options.context.queryClient.clear()
	router.history.destroy()
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

async function renderPath(path: string) {
	router.update({
		history: createMemoryHistory({ initialEntries: [path] }),
		context: router.options.context,
	})
	await act(async () => {
		await router.load()
		root.render(<RouterProvider router={router} />)
	})
}

describe('plain-text blog routes', () => {
	it('renders list data through the oRPC Query cache and follows the detail link', async () => {
		await renderPath('/blog')
		expect(container.textContent).toContain(blogMetadata.title)
		expect(container.textContent).toContain(blogMetadata.author.name)
		expect(container.textContent).toContain('1 tulisan')
		expect(listPosts).toHaveBeenCalledTimes(1)
		const link = container.querySelector<HTMLAnchorElement>(
			'a[href="/blog/tulisan-pertama"]'
		)
		if (!link) throw new Error('Missing detail link')
		await act(async () => {
			link.click()
			await router.load()
		})
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
		expect(container.querySelector('pre')?.textContent).toBe(blogPost.body)
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogMetadata.slug)
	})

	it('renders Markdown and HTML source as text without executing or rendering it', async () => {
		await renderPath('/blog/tulisan-pertama')
		expect(container.querySelector('pre')?.textContent).toBe(blogPost.body)
		expect(container.querySelector('article script')).toBeNull()
		expect(container.querySelector('article img')).toBeNull()
		expect(container.querySelector('article strong')).toBeNull()
		expect(getPostBySlug).toHaveBeenCalledTimes(1)
	})

	it('shows an empty list instead of treating it as an error', async () => {
		vi.mocked(listPosts).mockResolvedValue([])
		await renderPath('/blog')
		expect(container.textContent).toContain('0 tulisan')
		expect(container.textContent).toContain(
			'Belum ada tulisan yang dipublikasikan.'
		)
	})

	it.each(['missing', 'draft'])(
		'uses the 404 boundary for a %s article',
		async (slug) => {
			vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
			await renderPath(`/blog/${slug}`)
			expect(
				router.state.matches.some((match) => match.status === 'notFound')
			).toBe(true)
			expect(container.textContent).toContain('Tulisan tidak ditemukan')
			expect(container.querySelector('article')).toBeNull()
		}
	)

	it('treats invalid URL slugs as missing pages without reaching GitHub', async () => {
		await renderPath('/blog/Invalid-Slug')
		expect(container.textContent).toContain('Tulisan tidak ditemukan')
		expect(getPostBySlug).not.toHaveBeenCalled()
	})

	it('keeps errors private and retries the loader when the retry button is clicked', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		vi.mocked(listPosts).mockRejectedValue(
			new InvalidBlogContentError(
				'posts/private-draft/index.md',
				'secret-field'
			)
		)
		await renderPath('/blog')
		expect(container.textContent).toContain('Tulisan belum bisa dimuat')
		expect(container.textContent).not.toMatch(/private-draft|secret-field/)
		vi.mocked(listPosts).mockResolvedValue([blogMetadata])
		const button = container.querySelector<HTMLButtonElement>('button')
		if (!button) throw new Error('Missing retry button')
		await act(async () => {
			button.click()
			await router.load()
		})
		expect(container.textContent).toContain(blogMetadata.title)
		expect(container.textContent).not.toContain('Tulisan belum bisa dimuat')
	})
})
