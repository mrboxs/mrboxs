import { useCallback, useEffect, useRef, useState } from 'react'

import { decodeAudioData, getAudioContext } from '#/lib/sound-engine'
import type {
	SoundAsset,
	UseSoundOptions,
	UseSoundReturn,
} from '#/lib/sound-types'

function stopSources(sources: Map<AudioBufferSourceNode, GainNode>) {
	for (const [source, gain] of sources) {
		source.onended = null
		try {
			source.stop()
		} catch {
			// A source may have already ended before its event is dispatched.
		}
		source.disconnect()
		gain.disconnect()
	}
	sources.clear()
}

export function useSound(
	sound: SoundAsset,
	options: UseSoundOptions = {}
): UseSoundReturn {
	const {
		volume = 0.5,
		playbackRate = 1,
		interrupt = false,
		soundEnabled = true,
		onPlay,
		onEnd,
		onPause,
		onStop,
	} = options

	const [isPlaying, setIsPlaying] = useState(false)
	const [decodedSound, setDecodedSound] = useState<{
		dataUri: string
		buffer: AudioBuffer
	} | null>(null)
	const sourcesRef = useRef(new Map<AudioBufferSourceNode, GainNode>())
	const { dataUri } = sound
	const buffer = decodedSound?.dataUri === dataUri ? decodedSound.buffer : null
	const duration = buffer?.duration ?? sound.duration

	useEffect(() => {
		let cancelled = false
		decodeAudioData(dataUri)
			.then((decodedBuffer) => {
				if (!cancelled) {
					setDecodedSound({ dataUri, buffer: decodedBuffer })
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					console.error('Failed to decode audio:', error)
				}
			})
		return () => {
			cancelled = true
		}
	}, [dataUri])

	const stop = useCallback(() => {
		stopSources(sourcesRef.current)
		setIsPlaying(false)
		onStop?.()
	}, [onStop])

	const play = useCallback(
		(overrides?: { volume?: number; playbackRate?: number }) => {
			if (!soundEnabled || !buffer) return

			const ctx = getAudioContext()

			if (ctx.state === 'suspended') {
				ctx.resume().catch((error: unknown) => {
					console.error('Failed to resume audio context:', error)
				})
			}

			if (interrupt && sourcesRef.current.size > 0) {
				stop()
			}

			const source = ctx.createBufferSource()
			const gain = ctx.createGain()

			source.buffer = buffer
			source.playbackRate.value = overrides?.playbackRate ?? playbackRate
			gain.gain.value = overrides?.volume ?? volume

			source.connect(gain)
			gain.connect(ctx.destination)

			source.onended = () => {
				if (!sourcesRef.current.delete(source)) return
				source.onended = null
				source.disconnect()
				gain.disconnect()
				setIsPlaying(sourcesRef.current.size > 0)
				onEnd?.()
			}

			source.start(0)
			sourcesRef.current.set(source, gain)
			setIsPlaying(true)
			onPlay?.()
		},
		[soundEnabled, buffer, playbackRate, volume, interrupt, stop, onPlay, onEnd]
	)

	const pause = useCallback(() => {
		stop()
		onPause?.()
	}, [stop, onPause])

	useEffect(() => {
		for (const gain of sourcesRef.current.values()) {
			gain.gain.value = volume
		}
	}, [volume])

	useEffect(() => {
		const sources = sourcesRef.current
		return () => {
			stopSources(sources)
		}
	}, [])

	return [play, { stop, pause, isPlaying, duration, sound }] as const
}
