// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterContextProvider,
} from '@tanstack/react-router'

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

import { TOCMinimap } from '#/components/custom/toc-minimap'
import type { TOCItemType } from '#/components/custom/toc-minimap'

const { play } = vi.hoisted(() => ({ play: vi.fn() }))
vi.mock('#/hooks/use-sound', () => ({ useSound: () => [play, {}] }))

const items: Array<TOCItemType> = [
	{ title: 'First section', url: '#first', depth: 2 },
	{ title: 'Second section', url: '#second', depth: 3 },
	{ title: 'Café', url: '#caf%C3%A9', depth: 4 },
]
let positions: Record<string, number>
let container: HTMLDivElement
let root: Root
let router: ReturnType<typeof createRouter>
const observers: Array<TestObserver> = []

class TestObserver implements IntersectionObserver {
	readonly delay = 0
	readonly root = null
	readonly rootMargin = ''
	readonly scrollMargin = '0px'
	readonly thresholds = [0]
	readonly trackVisibility = false
	observe = vi.fn()
	unobserve = vi.fn()
	disconnect = vi.fn()
	takeRecords = () => []
	constructor(readonly callback: IntersectionObserverCallback) {
		observers.push(this)
	}
	notify() {
		this.callback([], this)
	}
}

beforeEach(async () => {
	vi.clearAllMocks()
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	vi.stubGlobal('IntersectionObserver', TestObserver)
	observers.length = 0
	positions = { first: 300, second: 900, café: 1500 }
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
		function (this: Element) {
			return this.id in positions
				? new DOMRect(0, positions[this.id], 400, 32)
				: new DOMRect()
		}
	)
	vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
		4000
	)
	const rootRoute = createRootRoute()
	const postRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/blog/$slug',
	})
	router = createRouter({
		routeTree: rootRoute.addChildren([postRoute]),
		history: createMemoryHistory({ initialEntries: ['/blog/test?ref=reader'] }),
	})
	await router.load()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await frame(() => root.unmount())
	router.history.destroy()
	container.remove()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

function view(outline = items) {
	return (
		<RouterContextProvider router={router}>
			<TOCMinimap items={outline} />
			<article>
				<h2 id="first" tabIndex={-1}>
					First section
				</h2>
				<h3 id="second" tabIndex={-1}>
					Second section
				</h3>
				<h4 id="café" tabIndex={-1}>
					Café
				</h4>
			</article>
		</RouterContextProvider>
	)
}

async function frame(action: () => void) {
	await act(async () => {
		action()
		await new Promise(requestAnimationFrame)
	})
}

async function render(outline = items) {
	await frame(() => root.render(view(outline)))
}

function trigger() {
	const button = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Table of contents"]'
	)
	if (!button) throw new Error('Missing TOC trigger')
	return button
}

async function open() {
	await frame(() => trigger().click())
}

function link(id: string) {
	const anchor = document.querySelector<HTMLAnchorElement>(
		'nav[aria-label="On this page"] a[href="' + id + '"]'
	)
	if (!anchor) throw new Error('Missing TOC link: ' + id)
	return anchor
}

function currentBar() {
	return [...trigger().querySelectorAll('[data-active]')].findIndex(
		(element) => element.getAttribute('data-active') === 'true'
	)
}

describe('TOC minimap', () => {
	it('omits empty and invalid outlines without creating observers', async () => {
		await render([])
		expect(container.querySelector('button')).toBeNull()
		await render([
			{ title: 'Invalid', url: '#%broken', depth: 2 },
			{ title: 'External', url: 'https://example.com', depth: 2 },
		])
		expect(container.querySelector('button')).toBeNull()
		expect(observers).toHaveLength(0)
	})

	it('tracks the preceding heading through long gaps and upward scrolling', async () => {
		await render()
		expect(currentBar()).toBe(0)
		positions.first = -500
		positions.second = 110
		await frame(() => window.dispatchEvent(new Event('scroll')))
		expect(currentBar()).toBe(0)
		positions.second = 95
		await frame(() => observers[0].notify())
		expect(currentBar()).toBe(1)
		positions.second = 200
		await frame(() => window.dispatchEvent(new Event('scroll')))
		expect(currentBar()).toBe(0)
	})

	it('marks the final heading at the document bottom even if it cannot reach the activation line', async () => {
		await render()
		vi.spyOn(window, 'scrollY', 'get').mockReturnValue(
			4000 - window.innerHeight
		)
		await frame(() => window.dispatchEvent(new Event('scroll')))
		expect(currentBar()).toBe(2)
	})

	it('updates after layout resize and exposes the active item to assistive technology', async () => {
		await render()
		positions.second = 80
		positions.first = -300
		await frame(() => window.dispatchEvent(new Event('resize')))
		await open()
		expect(link('#second').getAttribute('aria-current')).toBe('location')
		expect(
			document.querySelectorAll('nav[aria-label="On this page"] [aria-current]')
		).toHaveLength(1)
	})

	it('disconnects old heading observers on outline replacement and unmount', async () => {
		await render()
		const original = observers[0]
		await render(items.slice(1))
		expect(original.disconnect).toHaveBeenCalledTimes(1)
		const latest = observers.at(-1)
		await frame(() => root.render(null))
		expect(latest?.disconnect).toHaveBeenCalledTimes(1)
	})

	it('keeps scroll tracking functional without IntersectionObserver', async () => {
		vi.stubGlobal('IntersectionObserver', undefined)
		await render()
		positions.first = -400
		positions.second = 60
		await frame(() => window.dispatchEvent(new Event('scroll')))
		expect(currentBar()).toBe(1)
	})

	it.each([false, true])(
		'navigates and focuses an encoded heading with reduced motion=%s',
		async (reduced) => {
			const matchMedia = window.matchMedia.bind(window)
			vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
				const result = matchMedia(query)
				if (query.includes('prefers-reduced-motion')) {
					Object.defineProperty(result, 'matches', { value: reduced })
				}
				return result
			})
			await render()
			await open()
			const target = document.getElementById('café')
			if (!target) throw new Error('Missing heading')
			const scroll = vi
				.spyOn(target, 'scrollIntoView')
				.mockImplementation(() => undefined)
			await act(async () => {
				link('#caf%C3%A9').click()
				await router.load()
			})
			await frame(() => undefined)
			expect(router.state.location.pathname).toBe('/blog/test')
			expect(router.state.location.search).toEqual({ ref: 'reader' })
			expect(router.state.location.hash).toBe('café')
			expect(scroll).toHaveBeenCalledWith({
				block: 'start',
				behavior: reduced ? 'instant' : 'smooth',
			})
			expect(document.activeElement).toBe(target)
			expect(trigger().getAttribute('aria-expanded')).toBe('false')
			await act(async () => {
				router.history.back()
				await router.load()
			})
			expect(router.state.location.hash).toBe('')
			expect(router.state.location.search).toEqual({ ref: 'reader' })
		}
	)

	it.each([
		{ ctrlKey: true },
		{ metaKey: true },
		{ shiftKey: true },
		{ altKey: true },
		{ button: 1 },
	])('leaves modified clicks to the browser: %j', async (modifiers) => {
		await render()
		await open()
		const navigate = vi.spyOn(router, 'navigate')
		const event = new MouseEvent('click', {
			bubbles: true,
			cancelable: true,
			...modifiers,
		})
		await frame(() => link('#second').dispatchEvent(event))
		expect(event.defaultPrevented).toBe(false)
		expect(navigate).not.toHaveBeenCalled()
	})

	it('closes on Escape and restores the trigger focus, playing sound only on open', async () => {
		await render()
		await open()
		expect(trigger().getAttribute('aria-expanded')).toBe('true')
		expect(play).toHaveBeenCalledTimes(1)
		await frame(() =>
			document.activeElement?.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Escape',
					code: 'Escape',
					bubbles: true,
				})
			)
		)
		expect(trigger().getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).toBe(trigger())
		expect(play).toHaveBeenCalledTimes(1)
	})

	it('renders a server-safe labelled trigger before heading subscriptions exist', () => {
		const html = renderToString(view())
		expect(html).toContain('aria-label="Table of contents"')
		expect(observers).toHaveLength(0)
	})
})
