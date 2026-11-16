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

describe('blog routes', () => {
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
		expect(container.querySelector('article strong')?.textContent).toBe(
			'Teks tebal'
		)
		expect(getPostBySlug).toHaveBeenCalledExactlyOnceWith(blogMetadata.slug)
	})

	it('renders Markdown and local assets while discarding raw HTML', async () => {
		await renderPath('/blog/tulisan-pertama')
		expect(container.querySelector('article h2')?.textContent).toBe(
			'Heading mentah'
		)
		expect(container.querySelector('article script')).toBeNull()
		expect(container.querySelector('article img')?.getAttribute('src')).toBe(
			'/api/blog/assets/tulisan-pertama/cover.png'
		)
		expect(container.querySelector('article strong')?.textContent).toBe(
			'Teks tebal'
		)
		expect(container.querySelectorAll('article')).toHaveLength(1)
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

	it('copies the loaded page as Markdown with its title and description', async () => {
		const writeText = vi
			.spyOn(navigator.clipboard, 'writeText')
			.mockResolvedValue()
		await renderPath('/blog/tulisan-pertama')
		const copy = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Copy page"]'
		)
		if (!copy) throw new Error('Missing copy page button')
		await actAndFlush(() => copy.click())
		expect(writeText).toHaveBeenCalledExactlyOnceWith(
			`# ${blogPost.title}\n\n${blogPost.description}\n\n${blogPost.body}`
		)
		expect(container.querySelector('nav output')?.textContent).toBe(
			'Page copied'
		)
	})

	it('announces a denied clipboard write without claiming it copied the page', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
			new Error('Denied')
		)
		await renderPath('/blog/tulisan-pertama')
		const copy = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Copy page"]'
		)
		if (!copy) throw new Error('Missing copy page button')
		await actAndFlush(() => copy.click())
		expect(container.querySelector('nav output')?.textContent).toContain(
			'Could not copy page'
		)
		expect(container.querySelector('nav output')?.textContent).not.toContain(
			'Page copied'
		)
		expect(container.querySelector('h1')?.textContent).toBe(blogPost.title)
	})

	it('follows the published list order for previous and next articles', async () => {
		const newer = {
			...blogMetadata,
			slug: 'newer-post',
			title: 'Newer post',
			publishedAt: '2026-11-17',
		}
		const older = {
			...blogMetadata,
			slug: 'older-post',
			title: 'Older post',
			publishedAt: '2026-11-14',
		}
		const posts = [newer, blogMetadata, older]
		vi.mocked(listPosts).mockResolvedValue(posts)
		vi.mocked(getPostBySlug).mockImplementation((slug) =>
			Promise.resolve({
				...blogPost,
				...posts.find((post) => post.slug === slug),
			})
		)
		await renderPath('/blog/tulisan-pertama')
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		const previous = container.querySelector<HTMLAnchorElement>(
			'a[aria-label="Previous post"]'
		)
		const next = container.querySelector<HTMLAnchorElement>(
			'a[aria-label="Next post"]'
		)
		expect(previous?.getAttribute('href')).toBe('/blog/newer-post')
		expect(next?.getAttribute('href')).toBe('/blog/older-post')
		if (!next) throw new Error('Missing next article link')
		await act(async () => {
			next.click()
			await router.load()
		})
		expect(router.state.location.pathname).toBe('/blog/older-post')
		expect(container.querySelector('h1')?.textContent).toBe('Older post')
	})

	it('disables missing neighbors instead of linking to an unavailable article', async () => {
		await renderPath('/blog/tulisan-pertama')
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		for (const label of ['Previous post', 'Next post']) {
			expect(
				container.querySelector<HTMLButtonElement>(
					`button[aria-label="${label}"]`
				)?.disabled
			).toBe(true)
			expect(container.querySelector(`a[aria-label="${label}"]`)).toBeNull()
		}
	})

	it('keeps a readable article when the optional navigation list fails', async () => {
		vi.mocked(listPosts).mockRejectedValue(new Error('private-list-details'))
		await renderPath('/blog/tulisan-pertama')
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(container.querySelector('h1')?.textContent).toBe(blogPost.title)
		expect(container.querySelector('article strong')?.textContent).toBe(
			'Teks tebal'
		)
		expect(container.textContent).not.toContain('private-list-details')
	})

	it('copies the canonical article link from the share menu', async () => {
		const writeText = vi
			.spyOn(navigator.clipboard, 'writeText')
			.mockResolvedValue()
		await renderPath('/blog/tulisan-pertama')
		const share = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Share page"]'
		)
		if (!share) throw new Error('Missing share page button')
		await actAndFlush(() => share.click())
		const copyLink = Array.from(
			document.querySelectorAll<HTMLElement>('[role="menuitem"]')
		).find((item) => item.textContent.trim() === 'Copy link')
		if (!copyLink) throw new Error('Missing copy link menu item')
		await actAndFlush(() => copyLink.click())
		expect(writeText).toHaveBeenCalledExactlyOnceWith(
			new URL('/blog/tulisan-pertama', router.origin).href
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
