// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { HotkeyManager, KeyStateTracker } from '@tanstack/react-hotkeys'
import { focusManager, type QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
	getBlogRevision,
	getPostBySlug,
	BlogSourceError,
	InvalidBlogContentError,
	listPosts,
	PostNotFoundError,
} from '#/lib/blog.server'
import { getRouter } from '#/router'

import { blogMetadata, blogPost } from '../helpers/blog'
import { actAndFlush } from '../helpers/react'

vi.mock('void/env', () => ({
	env: {
		APP_URL: 'https://portfolio.example.test',
		VITE_APP_URL: 'https://portfolio.example.test',
	},
}))
vi.mock('#/hooks/use-sound', () => ({ useSound: () => [vi.fn(), {}] }))
vi.mock(import('#/lib/blog.server'), async (importOriginal) => ({
	...(await importOriginal()),
	listPosts: vi.fn(),
	getPostBySlug: vi.fn(),
	getBlogRevision: vi.fn(),
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
	const { TooltipProvider } = await import('#/components/ui/tooltip')
	return {
		Route: createRootRouteWithContext<{
			queryClient: QueryClient
			orpc: typeof orpc
		}>()({
			component: () => (
				<TooltipProvider>
					<Outlet />
				</TooltipProvider>
			),
		}),
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
	vi.mocked(getBlogRevision).mockResolvedValue(blogPost.cover.src.commit)
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
	HotkeyManager.resetInstance()
	KeyStateTracker.resetInstance()
	vi.useRealTimers()
	focusManager.setFocused(undefined)
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

function searchInput() {
	const input = container.querySelector<HTMLInputElement>('#blog-search')
	if (!input) throw new Error('Missing blog search')
	return input
}

async function searchFor(query: string) {
	await actAndFlush(() => {
		const input = searchInput()
		Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			'value'
		)?.set?.call(input, query)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

async function advancePolling(milliseconds: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(milliseconds)
	})
}

function mockNavigationPosts() {
	const posts = [
		{ ...blogMetadata, slug: 'newer-post', title: 'Newer post' },
		blogMetadata,
		{ ...blogMetadata, slug: 'older-post', title: 'Older post' },
	]
	vi.mocked(listPosts).mockResolvedValue(posts)
	vi.mocked(getPostBySlug).mockImplementation((slug) =>
		Promise.resolve({
			...blogPost,
			...posts.find((post) => post.slug === slug),
		})
	)
	const { queryClient, orpc } = router.options.context
	queryClient.setQueryData(orpc.blog.list.queryKey({ input: {} }), posts)
	return posts
}

async function renderNavigablePost() {
	await renderPath('/blog/tulisan-pertama')
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	if (!container.querySelector('a[aria-label="Next post"]')) {
		throw new Error('Post navigation did not finish loading')
	}
}

async function pressArrow(
	key: 'ArrowLeft' | 'ArrowRight',
	target: HTMLElement = document.body,
	options: KeyboardEventInit = {},
	release = true
) {
	const event = new KeyboardEvent('keydown', {
		key,
		code: key,
		bubbles: true,
		cancelable: true,
		...options,
	})
	await act(async () => {
		target.dispatchEvent(event)
		await Promise.resolve()
		await router.load()
		if (release) {
			target.dispatchEvent(
				new KeyboardEvent('keyup', { key, code: key, bubbles: true })
			)
		}
	})
	return event
}

describe('blog routes', () => {
	it('lists posts in the reading sidebar, keeps its state across navigation, and receives live list updates', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		const sidebar = () =>
			container.querySelector('aside[aria-label="Blog posts sidebar"]')
		const toggle = () =>
			sidebar()?.querySelector<HTMLButtonElement>(
				'button[aria-label="Toggle Sidebar"]'
			)
		expect(
			sidebar()?.querySelector('a[aria-current="page"]')?.textContent
		).toBe(blogPost.title)
		expect(sidebar()?.querySelectorAll('nav a')).toHaveLength(3)
		await actAndFlush(() => toggle()?.click())
		const next = container.querySelector<HTMLAnchorElement>(
			'a[aria-label="Next post"]'
		)
		if (!next) throw new Error('Missing next post')
		await act(async () => {
			next.click()
			await new Promise((resolve) => setTimeout(resolve, 0))
			await router.load()
		})
		expect(router.state.location.pathname).toBe('/blog/older-post')
		expect(toggle()?.getAttribute('aria-expanded')).toBe('false')
		await actAndFlush(() => toggle()?.click())
		expect(
			sidebar()?.querySelector('a[aria-current="page"]')?.textContent
		).toBe('Older post')
		const { queryClient, orpc } = router.options.context
		await act(async () => {
			queryClient.setQueryData(orpc.blog.list.queryKey({ input: {} }), [
				{ ...blogMetadata, slug: 'live-post', title: 'Live post' },
				blogMetadata,
			])
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(
			sidebar()?.querySelector('a[href="/blog/live-post"]')?.textContent
		).toBe('Live post')
	})

	it('updates the TOC offset for changing article header geometry without depending on page scroll', async () => {
		const observers: Array<{ element: Element; notify: () => void }> = []
		class HeaderObserver implements ResizeObserver {
			constructor(readonly callback: ResizeObserverCallback) {}
			observe(element: Element) {
				observers.push({ element, notify: () => this.callback([], this) })
			}
			unobserve = vi.fn()
			disconnect = vi.fn()
		}
		vi.stubGlobal('ResizeObserver', HeaderObserver)
		await renderPath('/blog/tulisan-pertama')
		const header = container.querySelector('article > header')
		const main = container.querySelector<HTMLElement>('#main-content')
		const observer = observers.find((entry) => entry.element === header)
		if (!header || !main || !observer) {
			throw new Error('Missing article geometry observer')
		}
		const geometry = vi
			.spyOn(header, 'getBoundingClientRect')
			.mockReturnValue(new DOMRect(255, 104, 766, 144))
		await actAndFlush(observer.notify)
		expect(main.style.getPropertyValue('--post-reading-top')).toBe('248px')
		vi.spyOn(window, 'scrollY', 'get').mockReturnValue(600)
		geometry.mockReturnValue(new DOMRect(255, -496, 766, 184))
		await actAndFlush(observer.notify)
		expect(main.style.getPropertyValue('--post-reading-top')).toBe('288px')
	})

	it('navigates with the displayed arrow shortcuts using the current neighbors', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		await pressArrow('ArrowRight')
		expect(router.state.location.pathname).toBe('/blog/older-post')
		expect(container.querySelector('#post-title')?.textContent).toBe(
			'Older post'
		)
		await pressArrow('ArrowLeft')
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
	})

	it('does not navigate repeatedly while an arrow key is held across article changes', async () => {
		const posts = mockNavigationPosts()
		posts.push({ ...blogMetadata, slug: 'oldest-post', title: 'Oldest post' })
		await renderNavigablePost()
		await pressArrow('ArrowRight', document.body, {}, false)
		expect(router.state.location.pathname).toBe('/blog/older-post')
		await pressArrow('ArrowRight', document.body, { repeat: true })
		expect(router.state.location.pathname).toBe('/blog/older-post')
		await pressArrow('ArrowRight')
		expect(router.state.location.pathname).toBe('/blog/oldest-post')
	})

	it.each([
		{ altKey: true },
		{ ctrlKey: true },
		{ metaKey: true },
		{ shiftKey: true },
		{ isComposing: true },
	])(
		'leaves modified or composing arrow presses alone: %j',
		async (options) => {
			mockNavigationPosts()
			await renderNavigablePost()
			const event = await pressArrow('ArrowRight', document.body, options)
			expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
			expect(event.defaultPrevented).toBe(false)
		}
	)

	it('does not navigate from editable controls or article scrolling regions', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		for (const tag of [
			'input',
			'textarea',
			'select',
			'div',
			'pre',
			'section',
		]) {
			const field = document.createElement(tag)
			field.tabIndex = 0
			if (tag === 'div') field.contentEditable = 'true'
			if (tag === 'section') field.setAttribute('role', 'region')
			document.body.appendChild(field)
			try {
				field.focus()
				const event = await pressArrow('ArrowRight', field)
				expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
				expect(event.defaultPrevented).toBe(false)
			} finally {
				field.remove()
			}
		}
	})

	it('lets the page-options menu keep its arrow keys', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		const options = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Page options"]'
		)
		if (!options) throw new Error('Missing page options')
		await actAndFlush(() => options.click())
		const item = document.querySelector<HTMLAnchorElement>('a[role="menuitem"]')
		if (!item) throw new Error('Missing menu item')
		await actAndFlush(() => item.focus())
		await pressArrow('ArrowRight', item)
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
		expect(document.querySelector('[role="menu"]')).not.toBeNull()
	})

	it('keeps an image preview open when an arrow is pressed in its dialog', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		const image = container.querySelector<HTMLButtonElement>(
			'button[aria-label^="Enlarge image"]'
		)
		if (!image) throw new Error('Missing article image')
		await actAndFlush(() => image.click())
		const close = document.querySelector<HTMLButtonElement>(
			'[role="dialog"] [data-slot="lightbox-close"]'
		)
		if (!close) throw new Error('Missing image dialog')
		await actAndFlush(() => close.focus())
		await pressArrow('ArrowRight', close)
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
		expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	})

	it('does not override arrow events already handled by another control', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			code: 'ArrowRight',
			bubbles: true,
			cancelable: true,
		})
		event.preventDefault()
		await actAndFlush(() => document.body.dispatchEvent(event))
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
	})

	it('unregisters article shortcuts when the page unmounts', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		const navigate = vi.spyOn(router, 'navigate')
		await actAndFlush(() => root.render(null))
		await actAndFlush(() => {
			document.body.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'ArrowRight',
					code: 'ArrowRight',
					bubbles: true,
					cancelable: true,
				})
			)
		})
		expect(navigate).not.toHaveBeenCalled()
	})

	it.each([
		['nav a[href="/blog"]', 'Back to blog', undefined],
		['button[aria-label="Copy page"]', 'Copy page', undefined],
		['button[aria-label="Page options"]', 'Page options', undefined],
		['button[aria-label="Share page"]', 'Share page', undefined],
		['a[aria-label="Previous post"]', 'Previous post', '←'],
		['a[aria-label="Next post"]', 'Next post', '→'],
	] as const)(
		'shows the shadcn tooltip for %s with its shortcut hint',
		async (selector, label, shortcut) => {
			mockNavigationPosts()
			await renderNavigablePost()
			const trigger = container.querySelector<HTMLElement>(selector)
			if (!trigger) throw new Error(`Missing ${label}`)
			await actAndFlush(() => {
				trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
				trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
			})
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0))
			})
			const tooltip = document.querySelector(
				'[data-slot="tooltip-content"]:not([data-closed])'
			)
			if (!tooltip) throw new Error(`Missing ${label} tooltip`)
			expect(tooltip.textContent).toContain(label)
			if (shortcut) {
				expect(tooltip.querySelector('kbd')?.textContent).toBe(shortcut)
			}
			expect(container.querySelector('button button')).toBeNull()
		}
	)

	it('exposes the available navigation shortcuts to assistive technology', async () => {
		mockNavigationPosts()
		await renderNavigablePost()
		expect(
			container
				.querySelector('a[aria-label="Previous post"]')
				?.getAttribute('aria-keyshortcuts')
		).toBe('ArrowLeft')
		expect(
			container
				.querySelector('a[aria-label="Next post"]')
				?.getAttribute('aria-keyshortcuts')
		).toBe('ArrowRight')
	})

	it('keeps missing neighbors disabled and leaves their keys unclaimed', async () => {
		await renderPath('/blog/tulisan-pertama')
		for (const key of ['ArrowLeft', 'ArrowRight'] as const) {
			const event = await pressArrow(key)
			expect(event.defaultPrevented).toBe(false)
		}
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
		expect(container.querySelector('nav [aria-keyshortcuts]')).toBeNull()
	})

	it('updates the open list on the next revision poll and leaves unchanged content cached', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		await renderPath('/blog')
		await advancePolling(0)
		expect(listPosts).toHaveBeenCalledTimes(1)
		const nextRevision = 'b'.repeat(40)
		vi.mocked(getBlogRevision).mockResolvedValue(nextRevision)
		vi.mocked(listPosts).mockResolvedValue([
			{
				...blogMetadata,
				slug: 'new-post',
				title: 'Published without a reload',
				cover: {
					...blogMetadata.cover,
					src: { commit: nextRevision, path: 'posts/new-post/cover.png' },
				},
			},
			blogMetadata,
		])
		await advancePolling(4_999)
		expect(container.textContent).not.toContain('Published without a reload')
		await advancePolling(2)
		expect(container.textContent).toContain('Published without a reload')
		expect(container.textContent).toContain('2 tulisan')
		expect(listPosts).toHaveBeenCalledTimes(2)
		await advancePolling(5_001)
		expect(getBlogRevision).toHaveBeenCalledTimes(3)
		expect(listPosts).toHaveBeenCalledTimes(2)
	})

	it('refreshes an open article, its loader metadata, and its neighbors after a push', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(0)
		const nextRevision = 'b'.repeat(40)
		const updated = {
			...blogPost,
			title: 'Updated after push',
			body: '## Updated body\n\nNew paragraph.',
			cover: {
				...blogPost.cover,
				src: { ...blogPost.cover.src, commit: nextRevision },
			},
		}
		vi.mocked(getBlogRevision).mockResolvedValue(nextRevision)
		vi.mocked(getPostBySlug).mockResolvedValue(updated)
		vi.mocked(listPosts).mockResolvedValue([
			{ ...blogMetadata, slug: 'new-post', title: 'New post' },
			updated,
		])
		await advancePolling(5_010)
		expect(container.querySelector('#post-title')?.textContent).toBe(
			'Updated after push'
		)
		expect(container.querySelector('article h2')?.textContent).toBe(
			'Updated body'
		)
		expect(
			container
				.querySelector('a[aria-label="Previous post"]')
				?.getAttribute('href')
		).toBe('/blog/new-post')
		expect(router.state.matches.at(-1)).toMatchObject({
			loaderData: { title: 'Updated after push' },
		})
		expect(getPostBySlug).toHaveBeenCalledTimes(2)
		const toc = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Table of contents"]'
		)
		if (!toc) throw new Error('Missing updated TOC')
		await actAndFlush(() => toc.click())
		expect(
			document.querySelector('nav[aria-label="On this page"]')?.textContent
		).toContain('Updated body')
	})

	it('replaces a withdrawn article with the not-found boundary after a revision change', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(0)
		vi.mocked(getBlogRevision).mockResolvedValue('b'.repeat(40))
		vi.mocked(listPosts).mockResolvedValue([])
		vi.mocked(getPostBySlug).mockRejectedValue(new PostNotFoundError())
		await advancePolling(5_001)
		expect(container.querySelector('article')).toBeNull()
		expect(container.textContent).toContain('Tulisan tidak ditemukan')
	})

	it.each(['list', 'article'] as const)(
		'retries a failed %s refresh on the next poll for the same revision',
		async (failure) => {
			vi.useFakeTimers()
			focusManager.setFocused(true)
			await renderPath('/blog/tulisan-pertama')
			await advancePolling(0)
			const nextRevision = 'b'.repeat(40)
			const updated = {
				...blogPost,
				title: 'Updated on retry',
				cover: {
					...blogPost.cover,
					src: { ...blogPost.cover.src, commit: nextRevision },
				},
			}
			vi.mocked(getBlogRevision).mockResolvedValue(nextRevision)
			vi.mocked(getPostBySlug).mockResolvedValue(updated)
			vi.mocked(listPosts).mockResolvedValue([
				{ ...blogMetadata, slug: 'new-post', title: 'New post' },
				updated,
			])
			if (failure === 'list') {
				vi.mocked(listPosts).mockRejectedValueOnce(
					new BlogSourceError('network')
				)
			} else {
				vi.mocked(getPostBySlug).mockRejectedValueOnce(
					new BlogSourceError('network')
				)
			}
			await advancePolling(5_001)
			expect(container.querySelector('#post-title')?.textContent).toBe(
				blogPost.title
			)
			await advancePolling(5_001)
			expect(container.querySelector('#post-title')?.textContent).toBe(
				updated.title
			)
			expect(
				container
					.querySelector('a[aria-label="Previous post"]')
					?.getAttribute('href')
			).toBe('/blog/new-post')
			expect(listPosts).toHaveBeenCalledTimes(3)
			expect(getPostBySlug).toHaveBeenCalledTimes(failure === 'list' ? 2 : 3)
			expect(getBlogRevision).toHaveBeenCalledTimes(3)
			expect(router.state.matches.at(-1)).toMatchObject({
				status: 'success',
				loaderData: { title: updated.title },
			})
			await advancePolling(5_001)
			expect(listPosts).toHaveBeenCalledTimes(3)
			expect(getPostBySlug).toHaveBeenCalledTimes(failure === 'list' ? 2 : 3)
		}
	)

	it('cancels an older detail request before it can make the previous revision fresh again', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(0)
		const { queryClient, orpc } = router.options.context
		let completeOlder!: (post: typeof blogPost) => void
		vi.mocked(getPostBySlug).mockReturnValueOnce(
			new Promise((resolve) => {
				completeOlder = resolve
			})
		)
		let backgroundRefresh!: Promise<void>
		await actAndFlush(() => {
			backgroundRefresh = queryClient.refetchQueries({
				queryKey: orpc.blog.getBySlug.key(),
			})
		})
		expect(getPostBySlug).toHaveBeenCalledTimes(2)
		const updated = {
			...blogPost,
			title: 'Current publication',
			cover: {
				...blogPost.cover,
				src: { ...blogPost.cover.src, commit: 'b'.repeat(40) },
			},
		}
		vi.mocked(getBlogRevision).mockResolvedValue(updated.cover.src.commit)
		vi.mocked(getPostBySlug).mockResolvedValue(updated)
		let completeList!: (posts: Array<typeof blogMetadata>) => void
		vi.mocked(listPosts).mockReturnValueOnce(
			new Promise((resolve) => {
				completeList = resolve
			})
		)
		await advancePolling(5_001)
		await actAndFlush(() =>
			completeOlder({ ...blogPost, title: 'Older background response' })
		)
		await backgroundRefresh
		await advancePolling(1)
		expect(container.textContent).not.toContain('Older background response')
		await actAndFlush(() => completeList([updated]))
		await advancePolling(1)
		expect(container.querySelector('#post-title')?.textContent).toBe(
			updated.title
		)
		expect(router.state.matches.at(-1)).toMatchObject({
			loaderData: { title: updated.title },
		})
		expect(getPostBySlug).toHaveBeenCalledTimes(3)
		await advancePolling(5_001)
		expect(getPostBySlug).toHaveBeenCalledTimes(3)
	})

	it('does not restart an in-flight content refresh when another revision poll completes', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(0)
		vi.mocked(getBlogRevision).mockResolvedValue('b'.repeat(40))
		let complete!: (posts: Array<typeof blogMetadata>) => void
		vi.mocked(listPosts).mockReturnValueOnce(
			new Promise((resolve) => {
				complete = resolve
			})
		)
		await advancePolling(10_001)
		expect(listPosts).toHaveBeenCalledTimes(2)
		await actAndFlush(() => complete([blogMetadata]))
		expect(getPostBySlug).toHaveBeenCalledTimes(2)
		await advancePolling(5_001)
		expect(listPosts).toHaveBeenCalledTimes(2)
	})

	it('detects a push between the initial loader and the first revision check', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		vi.mocked(getBlogRevision).mockResolvedValue('b'.repeat(40))
		vi.mocked(getPostBySlug)
			.mockResolvedValueOnce(blogPost)
			.mockResolvedValue({
				...blogPost,
				title: 'Changed during initial load',
				cover: {
					...blogPost.cover,
					src: { ...blogPost.cover.src, commit: 'b'.repeat(40) },
				},
			})
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(1)
		expect(container.querySelector('#post-title')?.textContent).toBe(
			'Changed during initial load'
		)
	})

	it('keeps readable content during revision failures and backs off before retrying', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		vi.mocked(getBlogRevision).mockRejectedValue(
			new BlogSourceError('rate-limit', 403)
		)
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(5_001)
		expect(container.querySelector('#post-title')?.textContent).toBe(
			blogPost.title
		)
		expect(getBlogRevision).toHaveBeenCalledTimes(1)
		expect(getPostBySlug).toHaveBeenCalledTimes(1)
		vi.mocked(getBlogRevision).mockResolvedValue(blogPost.cover.src.commit)
		await advancePolling(55_000)
		expect(getBlogRevision).toHaveBeenCalledTimes(2)
		expect(getPostBySlug).toHaveBeenCalledTimes(1)
	})

	it('ignores a cached revision until the current probe succeeds', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		const { queryClient, orpc } = router.options.context
		queryClient.setQueryData(orpc.blog.revision.queryKey({ input: {} }), {
			revision: 'b'.repeat(40),
		})
		vi.mocked(getBlogRevision).mockRejectedValue(new BlogSourceError('network'))
		await renderPath('/blog/tulisan-pertama')
		await advancePolling(10)
		expect(getBlogRevision).toHaveBeenCalledTimes(1)
		expect(getPostBySlug).toHaveBeenCalledTimes(1)
		expect(container.querySelector('#post-title')?.textContent).toBe(
			blogPost.title
		)
	})

	it('stops revision polling when the blog page unmounts', async () => {
		vi.useFakeTimers()
		focusManager.setFocused(true)
		await renderPath('/blog')
		await advancePolling(0)
		expect(getBlogRevision).toHaveBeenCalledTimes(1)
		await actAndFlush(() => root.render(null))
		await advancePolling(10_001)
		expect(getBlogRevision).toHaveBeenCalledTimes(1)
	})

	it('renders list data through the oRPC Query cache and follows the detail link', async () => {
		await renderPath('/blog')
		expect(container.textContent).toContain(blogMetadata.title)
		const cover = container.querySelector('#blog-post-list img')
		expect(cover?.getAttribute('src')).toBe(
			'/api/blog/assets/tulisan-pertama/cover.png'
		)
		expect(cover?.getAttribute('alt')).toBe(blogMetadata.cover.alt)
		expect(cover?.getAttribute('loading')).toBe('eager')
		expect(cover?.getAttribute('fetchpriority')).toBe('high')
		expect(container.querySelector('time')?.textContent).toBe('15 Nov 2026')
		expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
			blogMetadata.publishedAt
		)
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

	it('searches titles, descriptions, and tags without changing publication order or fetching article bodies', async () => {
		vi.mocked(listPosts).mockResolvedValue([
			{
				...blogMetadata,
				title: 'React compiler notes',
				slug: 'compiler',
				description: 'Memoization experiments.',
				tags: ['javascript'],
			},
			{
				...blogMetadata,
				title: 'Old hardware journal',
				slug: 'hardware',
				description: 'Learning React with limited hardware.',
				tags: ['computing'],
			},
			{
				...blogMetadata,
				title: 'Music production',
				slug: 'music',
				description: 'Mixing a remix.',
				tags: ['creative'],
			},
		])
		await renderPath('/blog')
		const titles = () =>
			[...container.querySelectorAll('#blog-post-list h2')].map(
				(h) => h.textContent
			)
		await searchFor('  COMPILER   react  ')
		expect(titles()).toEqual(['React compiler notes'])
		await searchFor('react')
		expect(titles()).toEqual(['React compiler notes', 'Old hardware journal'])
		await searchFor('CREATIVE')
		expect(titles()).toEqual(['Music production'])
		expect(listPosts).toHaveBeenCalledTimes(1)
		expect(getPostBySlug).not.toHaveBeenCalled()
	})

	it('announces no matches and clears the search while keeping focus in the input', async () => {
		await renderPath('/blog')
		await searchFor('not-a-matching-post')
		expect(container.textContent).toContain('No posts found.')
		expect(container.querySelector('output')?.textContent).toBe(
			'0 tulisan ditemukan.'
		)
		expect(container.querySelector('#blog-post-list h2')).toBeNull()
		const clear = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Clear search"]'
		)
		if (!clear) throw new Error('Missing clear button')
		await actAndFlush(() => clear.click())
		expect(searchInput().value).toBe('')
		expect(document.activeElement).toBe(searchInput())
		expect(container.querySelector('#blog-post-list h2')?.textContent).toBe(
			blogMetadata.title
		)
		expect(container.querySelector('output')?.textContent).toBe('1 tulisan')
		expect(
			container.querySelector('button[aria-label="Clear search"]')
		).toBeNull()
	})

	it('clears on Escape in the search field without interrupting an IME composition', async () => {
		await renderPath('/blog')
		await searchFor('missing')
		await actAndFlush(() => {
			searchInput().focus()
			searchInput().dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					bubbles: true,
					isComposing: true,
				})
			)
		})
		expect(searchInput().value).toBe('missing')
		await actAndFlush(() =>
			searchInput().dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
			)
		)
		expect(searchInput().value).toBe('')
		expect(document.activeElement).toBe(searchInput())
		expect(container.querySelectorAll('#blog-post-list h2')).toHaveLength(1)
	})

	it('keeps filtering fresh cache data with the current search query', async () => {
		await renderPath('/blog')
		await searchFor('later')
		expect(container.querySelector('#blog-post-list h2')).toBeNull()
		const { queryClient, orpc } = router.options.context
		await act(async () => {
			queryClient.setQueryData(orpc.blog.list.queryKey({ input: {} }), [
				{ ...blogMetadata, slug: 'later-post', title: 'Published later' },
				blogMetadata,
			])
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(searchInput().value).toBe('later')
		expect(container.querySelectorAll('#blog-post-list h2')).toHaveLength(1)
		expect(container.querySelector('#blog-post-list h2')?.textContent).toBe(
			'Published later'
		)
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

	it('places the published cover between the description and body and prioritizes it over body images', async () => {
		await renderPath('/blog/tulisan-pertama')
		const cover = container.querySelector('[data-slot="post-cover"]')
		if (!cover) throw new Error('Missing post cover')
		expect(cover.previousElementSibling?.textContent).toBe(blogPost.description)
		expect(
			cover.nextElementSibling?.querySelector(
				'button[aria-label="Table of contents"]'
			)
		).not.toBeNull()
		expect(
			cover.nextElementSibling?.nextElementSibling?.getAttribute('aria-label')
		).toBe('Article content')
		const image = cover.querySelector('img')
		expect(image?.getAttribute('src')).toBe(
			'/api/blog/assets/tulisan-pertama/cover.png'
		)
		expect(image?.alt).toBe(blogPost.cover.alt)
		expect(image?.getAttribute('loading')).toBe('eager')
		expect(image?.getAttribute('fetchpriority')).toBe('high')
		expect(image?.width).toBe(1200)
		expect(image?.height).toBe(675)
		const trigger = cover.querySelector<HTMLButtonElement>(
			'[data-slot="lightbox-trigger"]'
		)
		if (!trigger) throw new Error('Missing cover lightbox trigger')
		await actAndFlush(() => trigger.click())
		expect(
			document
				.querySelector('[data-slot="lightbox-content"] img')
				?.getAttribute('src')
		).toBe('/api/blog/assets/tulisan-pertama/cover.png')
		expect(
			document
				.querySelector('[data-slot="lightbox-item"]')
				?.getAttribute('aria-label')
		).toBe('Image 1 of 1')
		expect(
			container
				.querySelector('section[aria-label="Article content"] img')
				?.getAttribute('loading')
		).toBe('lazy')
	})

	it('builds the TOC from the same duplicate, formatted and non-ASCII headings as the renderer', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue({
			...blogPost,
			body: '# Intro\n\n## Intro\n\n### **日本語**\n\n## Post title\n\n```md\n## Not a heading\n```',
		})
		await renderPath('/blog/tulisan-pertama')
		const trigger = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Table of contents"]'
		)
		if (!trigger) throw new Error('Missing TOC')
		await actAndFlush(() => trigger.click())
		const links = [
			...document.querySelectorAll<HTMLAnchorElement>(
				'nav[aria-label="On this page"] a'
			),
		]
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'#intro',
			'#intro-1',
			'#日本語',
			'#post-title-1',
		])
		for (const link of links) {
			const id = link.getAttribute('href')?.slice(1)
			expect(id && document.getElementById(id)?.textContent).toBe(
				link.textContent
			)
		}
	})

	it('omits the TOC and its layout slot for an article without headings', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue({
			...blogPost,
			body: 'A plain article.',
		})
		await renderPath('/blog/tulisan-pertama')
		expect(
			container.querySelector('button[aria-label="Table of contents"]')
		).toBeNull()
		expect(
			container
				.querySelector('[data-slot="post-cover"]')
				?.nextElementSibling?.getAttribute('aria-label')
		).toBe('Article content')
	})

	it('keeps heading permalinks distinct from page and footnote IDs', async () => {
		vi.mocked(getPostBySlug).mockResolvedValue({
			...blogPost,
			body: '## Post title\n\n## Main content\n\n## Post title\n\n## Footnote label\n\nA note[^one].\n\n[^one]: Footnote content.',
		})
		await renderPath('/blog/tulisan-pertama')
		for (const id of ['post-title', 'main-content', 'footnote-label']) {
			expect(container.querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
		}
		for (const id of [
			'post-title-1',
			'main-content-1',
			'post-title-2',
			'footnote-label-1',
		]) {
			const heading = container.querySelector(`h2[id="${id}"]`)
			expect(heading).not.toBeNull()
			expect(heading?.querySelector('a')?.hash).toBe(`#${id}`)
		}
		const ids = [...container.querySelectorAll('[id]')].map(
			(element) => element.id
		)
		expect(new Set(ids).size).toBe(ids.length)
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

	it('opens the active article in Markdown, GitHub, and each requested AI service', async () => {
		await renderPath('/blog/tulisan-pertama')
		const options = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Page options"]'
		)
		if (!options) throw new Error('Missing page options button')
		await actAndFlush(() => options.click())
		const links = Array.from(
			document.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]')
		)
		expect(links.map((link) => link.textContent.trim())).toEqual([
			'View as Markdown',
			'Open in GitHub',
			'Open in ChatGPT',
			'Open in Claude',
			'Open in Cursor',
			'Open in Grok',
		])
		const destinations = links.map((link) => new URL(link.href))
		const markdownUrl = new URL('/blog/tulisan-pertama.md', router.origin).href
		expect(destinations[0].href).toBe(markdownUrl)
		expect(destinations[1].href).toBe(
			'https://github.com/mrboxs/written-by-boxs/blob/main/posts/tulisan-pertama/index.md'
		)
		const prompt = `Read ${markdownUrl}, I want to ask questions about it.`
		for (const [offset, base, key] of [
			[2, 'https://chatgpt.com/', 'q'],
			[3, 'https://claude.ai/new', 'q'],
			[4, 'https://cursor.com/link/prompt', 'text'],
			[5, 'https://grok.com/', 'q'],
		] as const) {
			const destination = destinations[offset]
			expect(`${destination.origin}${destination.pathname}`).toBe(base)
			expect(destination.searchParams.get(key)).toBe(prompt)
		}
		expect(destinations[2].searchParams.get('hints')).toBe('search')
		for (const link of links) {
			expect(link.target).toBe('_blank')
			expect(link.relList.contains('noopener')).toBe(true)
			expect(link.relList.contains('noreferrer')).toBe(true)
			expect(link.getAttribute('aria-label')).toContain('opens in a new tab')
		}
		expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(8)
	})

	it('retains copy link in the expanded page options menu', async () => {
		const writeText = vi
			.spyOn(navigator.clipboard, 'writeText')
			.mockResolvedValue()
		await renderPath('/blog/tulisan-pertama')
		const options = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Page options"]'
		)
		if (!options) throw new Error('Missing page options button')
		await actAndFlush(() => options.click())
		const copyLink = Array.from(
			document.querySelectorAll<HTMLElement>('[role="menuitem"]')
		).find((item) => item.textContent.trim() === 'Copy link')
		if (!copyLink) throw new Error('Missing copy link menu item')
		await actAndFlush(() => copyLink.click())
		expect(writeText).toHaveBeenCalledExactlyOnceWith(
			new URL('/blog/tulisan-pertama', router.origin).href
		)
	})

	it.each(['list', 'post'] as const)(
		'shows the %s loading layout until its data arrives',
		async (kind) => {
			let release: (() => void) | undefined
			const pending = new Promise<void>((resolve) => {
				release = resolve
			})
			vi.mocked(listPosts).mockImplementation(async () => {
				await pending
				return [blogMetadata]
			})
			vi.mocked(getPostBySlug).mockImplementation(async () => {
				await pending
				return blogPost
			})
			router.update({
				context: router.options.context,
				defaultPendingMs: 0,
				defaultPendingMinMs: 0,
			})
			await renderPath('/not-a-page')
			let navigation: Promise<void> | undefined
			await act(async () => {
				navigation =
					kind === 'list'
						? router.navigate({ to: '/blog' })
						: router.navigate({
								to: '/blog/$slug',
								params: { slug: blogPost.slug },
							})
				await new Promise((resolve) => setTimeout(resolve, 10))
			})
			try {
				expect(container.querySelector('h1 output')?.textContent).toBe(
					kind === 'list' ? 'Memuat daftar tulisan…' : 'Memuat tulisan…'
				)
				expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
			} finally {
				await act(async () => {
					release?.()
					await navigation
				})
			}
			expect(container.querySelector('h1 output')).toBeNull()
			expect(container.textContent).toContain(blogPost.title)
		}
	)

	it('uses the global designed 404 for an unmatched URL', async () => {
		await renderPath('/not-a-page')
		expect(container.querySelector('h1')?.textContent).toBe('Page not found')
		expect(container.textContent).toContain('404')
		expect(container.querySelector('a[href="/"]')).not.toBeNull()
		expect(container.querySelector('a[href="/blog"]')).not.toBeNull()
		expect(getPostBySlug).not.toHaveBeenCalled()
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

	it.each(['list', 'post'] as const)(
		'keeps %s errors private and retries the loader',
		async (kind) => {
			vi.spyOn(console, 'warn').mockImplementation(() => undefined)
			const error = new InvalidBlogContentError(
				'posts/private-draft/index.md',
				'secret-field'
			)
			if (kind === 'list') vi.mocked(listPosts).mockRejectedValue(error)
			else vi.mocked(getPostBySlug).mockRejectedValue(error)
			await renderPath(kind === 'list' ? '/blog' : `/blog/${blogPost.slug}`)
			expect(container.textContent).toContain('Tulisan belum bisa dimuat')
			expect(container.textContent).not.toMatch(/private-draft|secret-field/)
			expect(
				container.querySelector(`a[href="${kind === 'list' ? '/' : '/blog'}"]`)
			).not.toBeNull()
			vi.mocked(listPosts).mockResolvedValue([blogMetadata])
			vi.mocked(getPostBySlug).mockResolvedValue(blogPost)
			const button = container.querySelector<HTMLButtonElement>('button')
			if (!button) throw new Error('Missing retry button')
			await act(async () => {
				button.click()
				await router.load()
			})
			expect(container.textContent).toContain(blogMetadata.title)
			expect(container.textContent).not.toContain('Tulisan belum bisa dimuat')
		}
	)
})
