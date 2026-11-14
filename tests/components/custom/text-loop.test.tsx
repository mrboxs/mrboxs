// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { TextLoop } from '#/components/custom/text-loop'
import { ProfileHeader } from '#/components/portfolio/profile-header'
import { profile } from '#/data/profile'

import { actAndFlush } from '../../helpers/react'

vi.mock('#/components/custom/mrboxs-spotlight-logo', () => ({
	MrBoxsSpotlightLogo: () => null,
}))

let root: Root | null
let container: HTMLDivElement
const items = [
	<span key="first">First tagline</span>,
	<span key="second">Second tagline</span>,
]

beforeEach(() => {
	vi.useFakeTimers()
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	const matchMedia = window.matchMedia.bind(window)
	vi.spyOn(window, 'matchMedia').mockImplementation((media) => {
		const result = matchMedia(media)
		Object.defineProperty(result, 'matches', {
			value: media.includes('prefers-reduced-motion'),
		})
		return result
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await actAndFlush(() => root?.unmount())
	container.remove()
	vi.clearAllTimers()
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

it('notifies once per rotation in Strict Mode without an initial notification', async () => {
	const onIndexChange = vi.fn()
	await actAndFlush(() => {
		root?.render(
			<StrictMode>
				<TextLoop onIndexChange={onIndexChange}>{items}</TextLoop>
			</StrictMode>
		)
	})
	expect(onIndexChange).not.toHaveBeenCalled()
	await act(async () => vi.advanceTimersByTimeAsync(2200))
	expect(onIndexChange.mock.calls).toEqual([[1]])
	await act(async () => vi.advanceTimersByTimeAsync(2000))
	expect(onIndexChange.mock.calls).toEqual([[1], [0]])
})

it('advances every elapsed interval when React batches the updates', async () => {
	const onIndexChange = vi.fn()
	await actAndFlush(() => {
		root?.render(<TextLoop onIndexChange={onIndexChange}>{items}</TextLoop>)
	})
	await actAndFlush(() => vi.advanceTimersByTime(6000))
	expect(onIndexChange.mock.calls).toEqual([[1], [0], [1]])
})

it.each([0, 1])('does not rotate with %i items', async (count) => {
	const onIndexChange = vi.fn()
	await actAndFlush(() => {
		root?.render(
			<TextLoop onIndexChange={onIndexChange}>{items.slice(0, count)}</TextLoop>
		)
	})
	await act(async () => vi.advanceTimersByTimeAsync(6000))
	expect(onIndexChange).not.toHaveBeenCalled()
})

it('stops notifying after unmount', async () => {
	const onIndexChange = vi.fn()
	await actAndFlush(() => {
		root?.render(<TextLoop onIndexChange={onIndexChange}>{items}</TextLoop>)
	})
	await actAndFlush(() => root?.unmount())
	root = null
	await act(async () => vi.advanceTimersByTimeAsync(6000))
	expect(onIndexChange).not.toHaveBeenCalled()
})

it('pauses and resumes the profile tagline from its accessible control', async () => {
	await actAndFlush(() => root?.render(<ProfileHeader />))
	const tagline = container.querySelector('#profile-tagline')
	expect(tagline?.textContent).toBe(profile.taglines[0])
	await act(async () => vi.advanceTimersByTimeAsync(2200))
	expect(tagline?.textContent).toBe(profile.taglines[1])

	const pause = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Pause tagline rotation"]'
	)
	expect(pause?.getAttribute('aria-controls')).toBe('profile-tagline')
	await actAndFlush(() => pause?.click())
	await act(async () => vi.advanceTimersByTimeAsync(6000))
	expect(tagline?.textContent).toBe(profile.taglines[1])

	const resume = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Resume tagline rotation"]'
	)
	expect(resume).not.toBeNull()
	await actAndFlush(() => resume?.click())
	await act(async () => vi.advanceTimersByTimeAsync(2200))
	expect(tagline?.textContent).toBe(profile.taglines[2])
})
