// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createRoot, type Root } from 'react-dom/client'

import { ThemeFavicon } from '#/components/theme-favicon'

import { actAndFlush } from '../helpers/react'

const theme = vi.hoisted(() => ({
	resolvedTheme: undefined as string | undefined,
}))
vi.mock('#/components/theme-provider', () => ({ useTheme: () => theme }))

let root: Root
let container: HTMLDivElement
let icon: HTMLLinkElement
let color: HTMLMetaElement

beforeEach(() => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	theme.resolvedTheme = undefined
	icon = document.createElement('link')
	icon.id = 'theme-favicon'
	icon.rel = 'icon'
	icon.href = '/favicon.svg'
	color = document.createElement('meta')
	color.id = 'theme-color'
	color.content = '#080808'
	document.head.appendChild(icon)
	document.head.appendChild(color)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await actAndFlush(() => root.unmount())
	container.remove()
	icon.remove()
	color.remove()
	vi.unstubAllGlobals()
})

describe('theme-aware favicon', () => {
	it('preserves the adaptive icon until the application theme resolves', async () => {
		await actAndFlush(() => root.render(<ThemeFavicon />))
		expect(icon.getAttribute('href')).toBe('/favicon.svg')
	})

	it('tracks app theme changes and restores the adaptive fallback on unmount', async () => {
		theme.resolvedTheme = 'dark'
		await actAndFlush(() => root.render(<ThemeFavicon />))
		expect(icon.getAttribute('href')).toBe('/brand/favicon-dark.svg')
		expect(color.content).toBe('#080808')
		theme.resolvedTheme = 'light'
		await actAndFlush(() => root.render(<ThemeFavicon />))
		expect(icon.getAttribute('href')).toBe('/brand/favicon-light.svg')
		expect(color.content).toBe('#ffffff')
		await actAndFlush(() => root.render(null))
		expect(icon.getAttribute('href')).toBe('/favicon.svg')
	})
})
