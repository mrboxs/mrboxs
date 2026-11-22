// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import { act, StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { MotionConfig } from 'motion/react'

import { TextSwap } from '#/components/custom/text-swap'
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

function render(element: ReactNode) {
	return actAndFlush(() =>
		root?.render(<MotionConfig skipAnimations>{element}</MotionConfig>)
	)
}

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
	await render(
		<StrictMode>
			<TextSwap onIndexChange={onIndexChange}>{items}</TextSwap>
		</StrictMode>
	)
	expect(onIndexChange).not.toHaveBeenCalled()
	await act(async () => vi.advanceTimersByTimeAsync(2200))
	expect(onIndexChange.mock.calls).toEqual([[1]])
	await act(async () => vi.advanceTimersByTimeAsync(2000))
	expect(onIndexChange.mock.calls).toEqual([[1], [0]])
})

it('advances every elapsed interval when React batches the updates', async () => {
	const onIndexChange = vi.fn()
	await render(<TextSwap onIndexChange={onIndexChange}>{items}</TextSwap>)
	await actAndFlush(() => vi.advanceTimersByTime(6000))
	expect(onIndexChange.mock.calls).toEqual([[1], [0], [1]])
})

it.each([0, 1])('does not rotate with %i items', async (count) => {
	const onIndexChange = vi.fn()
	await render(
		<TextSwap onIndexChange={onIndexChange}>{items.slice(0, count)}</TextSwap>
	)
	await act(async () => vi.advanceTimersByTimeAsync(6000))
	expect(onIndexChange).not.toHaveBeenCalled()
})

it('stops notifying after unmount', async () => {
	const onIndexChange = vi.fn()
	await render(<TextSwap onIndexChange={onIndexChange}>{items}</TextSwap>)
	await actAndFlush(() => root?.unmount())
	root = null
	await act(async () => vi.advanceTimersByTimeAsync(6000))
	expect(onIndexChange).not.toHaveBeenCalled()
})

it('rotates the profile tagline without playback or pronunciation controls', async () => {
	await render(<ProfileHeader />)
	const tagline = container.querySelector('#profile-tagline')
	expect(tagline?.textContent).toBe(profile.taglines[0])
	await act(async () => vi.advanceTimersByTimeAsync(2200))
	expect(tagline?.textContent).toBe(profile.taglines[1])

	expect(container.querySelector('button')).toBeNull()
	await act(async () => vi.advanceTimersByTimeAsync(2000))
	expect(tagline?.textContent).toBe(profile.taglines[2])
})
