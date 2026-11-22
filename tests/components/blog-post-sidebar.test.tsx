// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { HotkeyManager, KeyStateTracker } from '@tanstack/react-hotkeys'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterContextProvider,
} from '@tanstack/react-router'

import { act } from 'react'
import type { ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import { BlogPostSidebar } from '#/components/blog/blog-post-sidebar'
import { TooltipProvider } from '#/components/ui/tooltip'

import { blogMetadata } from '../helpers/blog'
import { actAndFlush } from '../helpers/react'

const posts = [
	{ ...blogMetadata, title: 'Newer post', slug: 'newer-post' },
	blogMetadata,
	{ ...blogMetadata, title: 'Older post', slug: 'older-post' },
]
let container: HTMLDivElement
let root: Root
let router: ReturnType<typeof createRouter>
let desktop: boolean
const onRetry = vi.fn()

beforeEach(async () => {
	vi.clearAllMocks()
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	desktop = true
	const matchMedia = window.matchMedia.bind(window)
	vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
		const media = matchMedia(query)
		if (query === '(min-width: 1280px)') {
			Object.defineProperty(media, 'matches', { get: () => desktop })
		} else if (query.includes('prefers-reduced-motion')) {
			Object.defineProperty(media, 'matches', { value: true })
		}
		return media
	})
	const rootRoute = createRootRoute()
	const postRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/blog/$slug',
	})
	router = createRouter({
		routeTree: rootRoute.addChildren([postRoute]),
		history: createMemoryHistory({ initialEntries: ['/blog/tulisan-pertama'] }),
	})
	await router.load()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	router.history.destroy()
	container.remove()
	HotkeyManager.resetInstance()
	KeyStateTracker.resetInstance()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

function view(props: Partial<ComponentProps<typeof BlogPostSidebar>> = {}) {
	return (
		<RouterContextProvider router={router}>
			<TooltipProvider>
				<BlogPostSidebar
					posts={posts}
					slug={blogMetadata.slug}
					loading={false}
					refreshing={false}
					onRetry={onRetry}
					{...props}
				/>
			</TooltipProvider>
		</RouterContextProvider>
	)
}

async function render(
	props: Partial<ComponentProps<typeof BlogPostSidebar>> = {}
) {
	await actAndFlush(() => root.render(view(props)))
}

function find<T extends Element>(selector: string): T {
	const element = container.querySelector<T>(selector)
	if (!element) throw new Error('Missing ' + selector)
	return element
}

function toggleButton() {
	return find<HTMLButtonElement>('button[aria-label="Toggle Sidebar"]')
}

async function pressS(
	target: HTMLElement = document.body,
	options: KeyboardEventInit = {},
	release = true
) {
	const event = new KeyboardEvent('keydown', {
		key: 's',
		code: 'KeyS',
		bubbles: true,
		cancelable: true,
		...options,
	})
	await actAndFlush(() => {
		target.dispatchEvent(event)
		if (release) {
			target.dispatchEvent(
				new KeyboardEvent('keyup', { key: 's', code: 'KeyS', bubbles: true })
			)
		}
	})
	return event
}

describe('blog post sidebar', () => {
	it('renders open on the server and lists the real posts with one active page', async () => {
		const html = renderToString(view())
		expect(html).toContain('aria-expanded="true"')
		expect(html).toContain('href="/blog/tulisan-pertama"')
		await render()
		expect(toggleButton().getAttribute('aria-expanded')).toBe('true')
		expect(
			find('nav[aria-label="Blog posts"]').querySelectorAll('a')
		).toHaveLength(3)
		expect(find('a[aria-current="page"]').getAttribute('href')).toBe(
			'/blog/tulisan-pertama'
		)
		expect(container.querySelectorAll('a[aria-current]')).toHaveLength(1)
	})

	it('keeps collapsed links inert and returns focus to the toggle when S closes a focused link', async () => {
		await render()
		const button = toggleButton()
		const panel = document.getElementById(
			button.getAttribute('aria-controls') ?? ''
		)
		if (!panel) throw new Error('Missing controlled panel')
		await actAndFlush(() => button.click())
		expect(button.getAttribute('aria-expanded')).toBe('false')
		expect(panel.getAttribute('aria-hidden')).toBe('true')
		expect(panel.hasAttribute('inert')).toBe(true)
		await actAndFlush(() => button.click())
		expect(panel.hasAttribute('inert')).toBe(false)
		const active = find<HTMLAnchorElement>('a[aria-current="page"]')
		await actAndFlush(() => active.focus())
		const event = await pressS(active, {}, false)
		expect(event.defaultPrevented).toBe(true)
		expect(document.activeElement).toBe(button)
		expect(button.getAttribute('aria-expanded')).toBe('false')
		await pressS(button, { repeat: true }, false)
		expect(button.getAttribute('aria-expanded')).toBe('false')
		await actAndFlush(() =>
			button.dispatchEvent(
				new KeyboardEvent('keyup', { key: 's', code: 'KeyS', bubbles: true })
			)
		)
		await pressS(button)
		expect(button.getAttribute('aria-expanded')).toBe('true')
	})

	it('leaves typing, dialog controls, modified keys, and handled events alone', async () => {
		await render()
		const field = document.createElement('input')
		const editable = document.createElement('div')
		editable.contentEditable = 'true'
		editable.tabIndex = 0
		const dialog = document.createElement('div')
		dialog.setAttribute('role', 'dialog')
		const dialogButton = document.createElement('button')
		dialog.appendChild(dialogButton)
		document.body.appendChild(field)
		document.body.appendChild(editable)
		document.body.appendChild(dialog)
		try {
			for (const target of [field, editable, dialogButton]) {
				await actAndFlush(() => target.focus())
				const event = await pressS(target)
				expect(event.defaultPrevented).toBe(false)
				expect(toggleButton().getAttribute('aria-expanded')).toBe('true')
			}
			await pressS(document.body, { ctrlKey: true })
			await pressS(document.body, { metaKey: true })
			const handled = new KeyboardEvent('keydown', {
				key: 's',
				code: 'KeyS',
				bubbles: true,
				cancelable: true,
			})
			handled.preventDefault()
			await actAndFlush(() => document.body.dispatchEvent(handled))
			expect(toggleButton().getAttribute('aria-expanded')).toBe('true')
		} finally {
			field.remove()
			editable.remove()
			dialog.remove()
		}
	})

	it('disables the shortcut below the desktop sidebar breakpoint', async () => {
		desktop = false
		await render()
		const event = await pressS()
		expect(event.defaultPrevented).toBe(false)
		expect(toggleButton().getAttribute('aria-expanded')).toBe('true')
	})

	it('uses client navigation for a plain click and preserves modified link behavior', async () => {
		await render()
		const link = find<HTMLAnchorElement>('a[href="/blog/older-post"]')
		const modified = new MouseEvent('click', {
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
		})
		await actAndFlush(() => link.dispatchEvent(modified))
		expect(modified.defaultPrevented).toBe(false)
		expect(router.state.location.pathname).toBe('/blog/tulisan-pertama')
		await act(async () => {
			link.click()
			await new Promise((resolve) => setTimeout(resolve, 0))
			await router.load()
		})
		expect(router.state.location.pathname).toBe('/blog/older-post')
		await render({ slug: 'older-post' })
		expect(find('a[aria-current="page"]').textContent).toBe('Older post')
	})

	it('centers asynchronously loaded active posts inside the panel without scrolling the article', async () => {
		const pageScroll = vi.spyOn(window, 'scrollTo')
		const intoView = vi.spyOn(Element.prototype, 'scrollIntoView')
		vi.spyOn(window, 'scrollY', 'get').mockReturnValue(800)
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
			function (this: Element) {
				if (this.getAttribute('data-slot') === 'blog-sidebar-scroll') {
					return new DOMRect(0, 100, 238, 200)
				}
				if (this.getAttribute('aria-current') === 'page') {
					const area = this.closest('[data-slot="blog-sidebar-scroll"]')
					return new DOMRect(0, 500 - (area?.scrollTop ?? 0), 224, 1)
				}
				return new DOMRect()
			}
		)
		await render({ posts: undefined, loading: true })
		await render()
		const area = find<HTMLDivElement>('[data-slot="blog-sidebar-scroll"]')
		expect(area.scrollTop).toBe(300.5)
		await actAndFlush(() => toggleButton().click())
		area.scrollTop = 0
		await actAndFlush(() => toggleButton().click())
		expect(area.scrollTop).toBe(300.5)
		expect(window.scrollY).toBe(800)
		expect(pageScroll).not.toHaveBeenCalled()
		expect(intoView).not.toHaveBeenCalled()
	})

	it('shows loading, retryable failure, and empty states without fabricating links', async () => {
		await render({ posts: undefined, loading: true })
		expect(find('output').textContent).toBe('Memuat tulisan…')
		expect(container.querySelector('nav')).toBeNull()
		await render({ posts: undefined })
		expect(find('[role="alert"]').textContent).toBe(
			'Daftar tulisan belum bisa dimuat.'
		)
		const retry = [...container.querySelectorAll('button')].find(
			(button) => button.textContent === 'Coba lagi'
		)
		if (!retry) throw new Error('Missing retry button')
		await actAndFlush(() => retry.click())
		expect(onRetry).toHaveBeenCalledOnce()
		await render({ posts: [] })
		expect(container.textContent).toContain('Belum ada tulisan.')
		expect(container.querySelector('nav')).toBeNull()
	})
})
