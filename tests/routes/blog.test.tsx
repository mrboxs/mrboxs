// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

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

vi.mock('void/env', () => ({ env: {} }))
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

async function advancePolling(milliseconds: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(milliseconds)
	})
}

describe('blog routes', () => {
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
