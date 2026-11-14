import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import {
	domAnimation,
	LazyMotion,
	m,
	useInView,
	useMotionValue,
	useSpring,
} from 'motion/react'

import { mrboxsIsometric } from '#/assets/mrboxs-isometric'
import { useSound } from '#/hooks/use-sound'
import { metalClickSound } from '#/lib/metal-click'

const transition = {
	type: 'spring',
	mass: 0.5,
	damping: 18,
	stiffness: 200,
} as const

function pathVariants(paths: { normal: string; pressed: string }) {
	return {
		normal: { d: paths.normal },
		hovered: { d: paths.normal },
		pressed: { d: paths.pressed },
	}
}

const topVariants = pathVariants(mrboxsIsometric.top)
const sideFaces = mrboxsIsometric.sides.map((face) => ({
	id: face.id,
	path: face.normal,
	variants: pathVariants(face),
}))
const constructionFaceIds = new Set(['0-5', '4-2', '4-3'])
const constructionLines = sideFaces
	.filter((face) => constructionFaceIds.has(face.id))
	.map((face) => {
		const vertices = Array.from(
			face.path.matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g),
			([, x, y]) => ({ x: Number(x), y: Number(y) })
		)
		// The last two corners form the fixed base edge, including on press.
		const start = vertices.at(-2)
		const end = vertices.at(-1)
		if (!start || !end) {
			throw new Error(`Missing isometric base edge for face ${face.id}`)
		}
		const dx = (end.x - start.x) * 8
		const dy = (end.y - start.y) * 8
		return {
			id: face.id,
			path: `M${start.x - dx} ${start.y - dy}L${end.x + dx} ${end.y + dy}`,
		}
	})
const spotlightVariants = {
	normal: { opacity: 1 },
	hovered: { opacity: 1 },
	pressed: { opacity: 1 },
}

function subscribeToReducedMotion(onChange: () => void) {
	const query = window.matchMedia('(prefers-reduced-motion: reduce)')
	query.addEventListener('change', onChange)
	return () => query.removeEventListener('change', onChange)
}

function getReducedMotion() {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getServerReducedMotion() {
	return true
}

export function MrBoxsSpotlightLogo() {
	const ref = useRef<HTMLButtonElement>(null)
	const id = useId()
	const ids = {
		shape: `mrboxs-logo-shape-${id}`,
		pattern: `mrboxs-logo-pattern-${id}`,
		spotlight: `mrboxs-logo-spotlight-${id}`,
	}
	const [play] = useSound(metalClickSound)
	const shouldReduceMotion = useSyncExternalStore(
		subscribeToReducedMotion,
		getReducedMotion,
		getServerReducedMotion
	)
	const isInView = useInView(ref, { margin: '80px' })
	const [isKeyboardPressed, setIsKeyboardPressed] = useState(false)
	const mouseX = useMotionValue(278)
	const mouseY = useMotionValue(177)
	const cx = useSpring(mouseX, { stiffness: 300, damping: 30, mass: 0.1 })
	const cy = useSpring(mouseY, { stiffness: 300, damping: 30, mass: 0.1 })
	const highlightTransition = { duration: shouldReduceMotion ? 0 : 0.18 }
	const highlightVariant =
		isKeyboardPressed && !shouldReduceMotion ? 'pressed' : 'hovered'

	useEffect(() => {
		if (
			shouldReduceMotion ||
			!isInView ||
			!window.matchMedia('(hover: hover) and (pointer: fine)').matches
		) {
			return
		}

		const followPointer = (event: PointerEvent) => {
			if (event.pointerType === 'touch') return
			mouseX.set(49 + (event.clientX / window.innerWidth) * 458)
			mouseY.set(32 + (event.clientY / window.innerHeight) * 291)
		}

		window.addEventListener('pointermove', followPointer)
		return () => window.removeEventListener('pointermove', followPointer)
	}, [isInView, shouldReduceMotion, mouseX, mouseY])

	return (
		<LazyMotion features={domAnimation} strict>
			<m.button
				ref={ref}
				type="button"
				tabIndex={0}
				aria-label="Play mrboxs logo sound"
				className="block w-full cursor-pointer touch-manipulation rounded-sm [--pattern:color-mix(in_oklab,var(--foreground)_12%,var(--background))] [--stroke:color-mix(in_oklab,var(--foreground)_16%,var(--background))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
				initial="normal"
				whileHover={highlightVariant}
				whileFocus={highlightVariant}
				whileTap={shouldReduceMotion ? undefined : 'pressed'}
				onClick={() => play()}
				onKeyDown={(event) => {
					if (
						!shouldReduceMotion &&
						(event.key === 'Enter' || event.key === ' ')
					) {
						setIsKeyboardPressed(true)
					}
				}}
				onKeyUp={() => setIsKeyboardPressed(false)}
				onBlur={() => setIsKeyboardPressed(false)}
			>
				<svg
					className="h-auto w-full overflow-visible"
					viewBox="49 32 458 291"
					width="556"
					height="354"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<defs>
						<m.path
							id={ids.shape}
							d={mrboxsIsometric.top.normal}
							fillRule="evenodd"
							variants={topVariants}
							transition={transition}
						/>
						<pattern
							id={ids.pattern}
							width="10"
							height="10"
							patternUnits="userSpaceOnUse"
						>
							<path
								d="M-1 1l2 -2M0 10l10 -10M9 11l2 -2"
								stroke="var(--pattern)"
								strokeWidth="0.7"
							/>
						</pattern>
						<m.radialGradient
							id={ids.spotlight}
							cx={cx}
							cy={cy}
							r="180"
							gradientUnits="userSpaceOnUse"
						>
							<stop stopColor="var(--foreground)" stopOpacity="0.85" />
							<stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
						</m.radialGradient>
					</defs>

					<g
						stroke="var(--line)"
						strokeWidth="0.7"
						strokeDasharray="4 2"
						pointerEvents="none"
					>
						{constructionLines.map((line) => (
							<path
								key={line.id}
								d={line.path}
								data-construction-face={line.id}
							/>
						))}
					</g>

					<g strokeWidth="0.7" strokeLinejoin="round">
						{sideFaces.map((face) => (
							<g key={face.id} data-isometric-face={face.id}>
								<m.path
									d={face.path}
									variants={face.variants}
									transition={transition}
									fill="var(--background)"
									stroke="var(--stroke)"
								/>
								<m.g
									variants={spotlightVariants}
									transition={highlightTransition}
								>
									<m.path
										d={face.path}
										variants={face.variants}
										transition={transition}
										stroke={`url(#${ids.spotlight})`}
									/>
								</m.g>
							</g>
						))}
						<use
							href={`#${ids.shape}`}
							fill="var(--background)"
							stroke="var(--stroke)"
						/>
						<use href={`#${ids.shape}`} fill={`url(#${ids.pattern})`} />
						<m.g variants={spotlightVariants} transition={highlightTransition}>
							<use href={`#${ids.shape}`} stroke={`url(#${ids.spotlight})`} />
						</m.g>
					</g>

					<g
						className="pointer-events-none text-dimension max-sm:hidden"
						stroke="currentColor"
						strokeWidth="0.8"
						strokeLinejoin="round"
					>
						<path d="M203.35 38.09H101.35M115.35 38.09A88 88 0 0 0 127.14 82.09" />
						<path
							d="m115.35 38.09-3 8h6Zm11.79 44 6.6-5.4-3-5.2Z"
							fill="var(--background)"
						/>
						<text
							x="103"
							y="64.6"
							className="fill-current font-mono"
							stroke="none"
							fontSize="10"
							textAnchor="middle"
							dominantBaseline="central"
						>
							30°
						</text>
					</g>
				</svg>
			</m.button>
		</LazyMotion>
	)
}
