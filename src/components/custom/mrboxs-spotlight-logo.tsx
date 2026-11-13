import { useId, useState } from 'react'

import {
	domAnimation,
	LazyMotion,
	m,
	useMotionValue,
	useReducedMotion,
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
const spotlightVariants = {
	normal: { opacity: 0 },
	hovered: { opacity: 1 },
	pressed: { opacity: 1 },
}

export function MrBoxsSpotlightLogo() {
	const id = useId()
	const ids = {
		shape: `mrboxs-logo-shape-${id}`,
		pattern: `mrboxs-logo-pattern-${id}`,
		spotlight: `mrboxs-logo-spotlight-${id}`,
	}
	const [play] = useSound(metalClickSound)
	const shouldReduceMotion = useReducedMotion()
	const [isKeyboardPressed, setIsKeyboardPressed] = useState(false)
	const mouseX = useMotionValue(278)
	const mouseY = useMotionValue(177)
	const cx = useSpring(mouseX, { stiffness: 300, damping: 30, mass: 0.1 })
	const cy = useSpring(mouseY, { stiffness: 300, damping: 30, mass: 0.1 })
	const highlightTransition = { duration: shouldReduceMotion ? 0 : 0.18 }
	const highlightVariant =
		isKeyboardPressed && !shouldReduceMotion ? 'pressed' : 'hovered'

	return (
		<LazyMotion features={domAnimation} strict>
			<m.button
				type="button"
				tabIndex={0}
				aria-label="Play mrboxs logo sound"
				className="block w-full cursor-pointer touch-manipulation rounded-sm [--pattern:color-mix(in_oklab,var(--foreground)_12%,var(--background))] [--stroke:color-mix(in_oklab,var(--foreground)_24%,var(--background))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
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
				onPointerMove={(event) => {
					if (shouldReduceMotion || event.pointerType === 'touch') return

					const bounds = event.currentTarget.getBoundingClientRect()
					mouseX.set(((event.clientX - bounds.left) / bounds.width) * 556)
					mouseY.set(((event.clientY - bounds.top) / bounds.height) * 354)
				}}
			>
				<svg
					className="h-auto w-full"
					viewBox={mrboxsIsometric.viewBox}
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
							width="8"
							height="8"
							patternUnits="userSpaceOnUse"
						>
							<path
								d="M-1 1l2 -2M0 8l8 -8M7 9l2 -2"
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

					<g strokeWidth="0.7" strokeLinejoin="round">
						{sideFaces.map((face) => (
							<g key={face.id}>
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
				</svg>
			</m.button>
		</LazyMotion>
	)
}
