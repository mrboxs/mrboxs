// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { ORPCError } from '@orpc/client'

import {
	PageError,
	PageNotFound,
	PagePending,
} from '#/components/route-feedback'

import { actAndFlush } from '../helpers/react'

let root: Root
let container: HTMLDivElement
let router: ReturnType<typeof testRouter>

function testRouter({
	path = '/',
	loader,
	component = () => <h1>Article ready</h1>,
}: {
	path?: string
	loader?: () => unknown
	component?: () => ReactNode
} = {}) {
	const parent = createRootRoute({ component: Outlet })
	const home = createRoute({
		getParentRoute: () => parent,
		path: '/',
		component: () => (
			<main id="main-content">
				<h1>Home</h1>
			</main>
		),
	})
	const blog = createRoute({
		getParentRoute: () => parent,
		path: '/blog',
		component: () => <h1>Blog</h1>,
	})
	const article = createRoute({
		getParentRoute: () => parent,
		path: '/article',
		loader,
		component,
	})
	return createRouter({
		routeTree: parent.addChildren([home, blog, article]),
		history: createMemoryHistory({ initialEntries: [path] }),
		defaultErrorComponent: PageError,
		defaultNotFoundComponent: () => <PageNotFound />,
		defaultPendingComponent: PagePending,
		defaultPendingMs: 0,
		defaultPendingMinMs: 0,
	})
}

beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	router.history.destroy()
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

async function mount(options: Parameters<typeof testRouter>[0] = {}) {
	router = testRouter(options)
	await act(async () => {
		await router.load()
		root.render(<RouterProvider router={router} />)
	})
}

function retryButton() {
	const button = container.querySelector<HTMLButtonElement>('button')
	if (!button) throw new Error('Missing retry button')
	return button
}

function silenceExpectedErrors() {
	vi.spyOn(console, 'warn').mockImplementation(vi.fn())
	vi.spyOn(console, 'error').mockImplementation(vi.fn())
}

it.each([
	['/', 'Home'],
	['/blog', 'Blog'],
])('recovers from an unmatched URL through the %s link', async (to, title) => {
	await mount({ path: '/missing' })
	expect(container.querySelector('h1')?.textContent).toBe('Page not found')
	expect(container.textContent).toContain('404')
	const link = container.querySelector<HTMLAnchorElement>(`a[href="${to}"]`)
	if (!link) throw new Error('Missing recovery link')
	expect(link.getAttribute('role')).toBeNull()
	await act(async () => {
		link.click()
		await router.load()
	})
	expect(container.querySelector('h1')?.textContent).toBe(title)
})

it('keeps loader errors private and reruns the loader on retry', async () => {
	silenceExpectedErrors()
	const loader = vi.fn().mockRejectedValue(new Error('private-source-details'))
	await mount({ path: '/article', loader })
	expect(container.querySelector('h1')?.textContent).toBe(
		'Something went wrong'
	)
	expect(container.querySelector('[role="alert"]')?.textContent).toContain(
		'We couldn’t load this page.'
	)
	expect(container.textContent).not.toContain('private-source-details')
	loader.mockResolvedValue(undefined)
	await act(async () => {
		retryButton().click()
		await router.load()
	})
	expect(loader).toHaveBeenCalledTimes(2)
	expect(container.querySelector('h1')?.textContent).toBe('Article ready')
})

it('also recovers from a component render failure', async () => {
	silenceExpectedErrors()
	let failed = true
	await mount({
		path: '/article',
		component: () => {
			if (failed) throw new Error('private-render-details')
			return <h1>Rendered again</h1>
		},
	})
	expect(container.querySelector('h1')?.textContent).toBe(
		'Something went wrong'
	)
	expect(container.textContent).not.toContain('private-render-details')
	failed = false
	await act(async () => {
		retryButton().click()
		await router.load()
	})
	expect(container.querySelector('h1')?.textContent).toBe('Rendered again')
})

it('explains rate limiting without starting automatic retries', async () => {
	silenceExpectedErrors()
	const loader = vi.fn().mockRejectedValue(new ORPCError('TOO_MANY_REQUESTS'))
	await mount({ path: '/article', loader })
	expect(container.textContent).toContain('429')
	expect(container.querySelector('[role="alert"]')?.textContent).toContain(
		'Wait a little before trying again.'
	)
	expect(loader).toHaveBeenCalledTimes(1)
	expect(retryButton().disabled).toBe(false)
})

it.each(['success', 'failure'] as const)(
	'replaces the pending screen after loader %s',
	async (outcome) => {
		silenceExpectedErrors()
		let settle: ((error?: Error) => void) | undefined
		const pending = new Promise<void>((resolve, reject) => {
			settle = (error) => {
				if (error) reject(error)
				else resolve()
			}
		})
		await mount({ loader: () => pending })
		let navigation: Promise<void> | undefined
		await act(async () => {
			navigation = router.navigate({ href: '/article' })
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
		expect(container.querySelector('h1 output')?.textContent).toBe(
			'Loading page…'
		)
		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
		expect(container.querySelector('#pending-content')).not.toBeNull()
		const ids = Array.from(
			container.querySelectorAll('main[id]'),
			(main) => main.id
		)
		expect(new Set(ids).size).toBe(ids.length)
		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
		expect(container.querySelector('button, input')).toBeNull()
		await act(async () => {
			settle?.(
				outcome === 'failure' ? new Error('private-delayed-failure') : undefined
			)
			await navigation
		})
		expect(container.querySelector('h1 output')).toBeNull()
		expect(container.querySelector('[aria-busy="true"]')).toBeNull()
		expect(container.querySelector('h1')?.textContent).toBe(
			outcome === 'success' ? 'Article ready' : 'Something went wrong'
		)
		expect(container.textContent).not.toContain('private-delayed-failure')
	}
)
