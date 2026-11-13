// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { decodeAudioData, getAudioContext } from '#/lib/sound-engine'
import type {
	SoundAsset,
	UseSoundOptions,
	UseSoundReturn,
} from '#/lib/sound-types'

import { useSound } from './use-sound'

vi.mock('#/lib/sound-engine', () => ({
	decodeAudioData: vi.fn(),
	getAudioContext: vi.fn(),
}))

class Source {
	buffer: AudioBuffer | null = null
	playbackRate = { value: 1 }
	onended: (() => void) | null = null
	connect = vi.fn()
	disconnect = vi.fn()
	start = vi.fn()
	stop = vi.fn(() => this.onended?.())
}

const soundA: SoundAsset = {
	name: 'A',
	dataUri: 'data:audio/wav;base64,AAAA',
	duration: 1,
	format: 'wav',
	license: 'CC0',
	author: 'Test fixture',
}
const soundB: SoundAsset = { ...soundA, name: 'B', dataUri: 'B', duration: 2 }
const bufferA = { duration: 1.25 } as AudioBuffer
const sources: Array<Source> = []
const gains: Array<{
	gain: { value: number }
	connect: ReturnType<typeof vi.fn>
	disconnect: ReturnType<typeof vi.fn>
}> = []
let root: Root
let result: UseSoundReturn

function Harness({
	sound,
	options,
}: {
	sound: SoundAsset
	options: UseSoundOptions
}) {
	const value = useSound(sound, options)
	useLayoutEffect(() => {
		result = value
	})
	return null
}

async function render(sound = soundA, options: UseSoundOptions = {}) {
	await act(async () => {
		root.render(<Harness sound={sound} options={options} />)
		await Promise.resolve()
	})
}

beforeEach(() => {
	vi.resetAllMocks()
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
	sources.length = 0
	gains.length = 0
	root = createRoot(document.createElement('div'))
	vi.mocked(decodeAudioData).mockResolvedValue(bufferA)
	vi.mocked(getAudioContext).mockReturnValue({
		state: 'running',
		destination: {},
		createBufferSource: () => {
			const source = new Source()
			sources.push(source)
			return source
		},
		createGain: () => {
			const gain = {
				gain: { value: 1 },
				connect: vi.fn(),
				disconnect: vi.fn(),
			}
			gains.push(gain)
			return gain
		},
	} as unknown as AudioContext)
})

afterEach(() => {
	act(() => root.unmount())
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

it('honors soundEnabled independently of reduced motion', async () => {
	const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	Object.defineProperty(mediaQuery, 'matches', { value: true })
	vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery)
	await render(soundA, { soundEnabled: true })
	act(() => result[0]())
	expect(sources).toHaveLength(1)
	expect(result[1].isPlaying).toBe(true)

	await render(soundA, { soundEnabled: false })
	act(() => result[0]())
	expect(sources).toHaveLength(1)
})

it('keeps playing until every overlapping source ends naturally', async () => {
	const onEnd = vi.fn()
	await render(soundA, { onEnd })
	act(() => {
		result[0]()
		result[0]()
	})

	act(() => sources[0].onended?.())
	expect(result[1].isPlaying).toBe(true)
	expect(onEnd).toHaveBeenCalledTimes(1)
	act(() => sources[1].onended?.())
	expect(result[1].isPlaying).toBe(false)
	expect(onEnd).toHaveBeenCalledTimes(2)
	for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledTimes(1)
})

it.each(['stop', 'pause'] as const)(
	'%s stops every overlapping source without reporting a natural end',
	async (command) => {
		const onEnd = vi.fn()
		await render(soundA, { onEnd })
		act(() => {
			result[0]()
			result[0]()
		})
		act(() => result[1][command]())

		expect(result[1].isPlaying).toBe(false)
		expect(onEnd).not.toHaveBeenCalled()
		for (const source of sources) {
			expect(source.stop).toHaveBeenCalledTimes(1)
			expect(source.disconnect).toHaveBeenCalledTimes(1)
		}
		for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledTimes(1)
	}
)

it('interrupts old playback without calling onEnd', async () => {
	const onEnd = vi.fn()
	await render(soundA, { interrupt: true, onEnd })
	act(() => result[0]())
	act(() => result[0]())

	expect(sources[0].stop).toHaveBeenCalledTimes(1)
	expect(sources[1].stop).not.toHaveBeenCalled()
	expect(onEnd).not.toHaveBeenCalled()
	expect(result[1].isPlaying).toBe(true)
	act(() => sources[1].onended?.())
	expect(onEnd).toHaveBeenCalledTimes(1)
})

it('stops and disconnects every overlapping source on unmount', async () => {
	const onEnd = vi.fn()
	await render(soundA, { onEnd })
	act(() => {
		result[0]()
		result[0]()
	})
	act(() => root.unmount())

	for (const source of sources) {
		expect(source.stop).toHaveBeenCalledTimes(1)
		expect(source.disconnect).toHaveBeenCalledTimes(1)
	}
	for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledTimes(1)
	expect(onEnd).not.toHaveBeenCalled()
})

it('updates the volume of every overlapping source', async () => {
	await render()
	act(() => {
		result[0]()
		result[0]()
	})
	await render(soundA, { volume: 0.2 })
	for (const gain of gains) expect(gain.gain.value).toBe(0.2)
})

it('does not play the old asset while a replacement is decoding', async () => {
	await render()
	expect(result[1].duration).toBe(bufferA.duration)
	vi.mocked(decodeAudioData).mockReturnValueOnce(
		new Promise(() => {
			// Keep decoding pending until the hook unmounts.
		})
	)
	await render(soundB)

	act(() => result[0]())
	expect(sources).toHaveLength(0)
	expect(result[1].duration).toBe(soundB.duration)
})

it('does not fall back to the old asset if replacement decoding fails', async () => {
	const consoleError = vi
		.spyOn(console, 'error')
		.mockImplementation(() => undefined)
	await render()
	vi.mocked(decodeAudioData).mockRejectedValueOnce(new Error('Invalid audio'))
	await render(soundB)

	act(() => result[0]())
	expect(sources).toHaveLength(0)
	expect(result[1].duration).toBe(soundB.duration)
	expect(consoleError).toHaveBeenCalledTimes(1)
})
