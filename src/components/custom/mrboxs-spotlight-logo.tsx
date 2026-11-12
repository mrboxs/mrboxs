import { useId } from 'react'

import {
	motion,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from 'motion/react'

import { useSound } from '#/hooks/use-sound'
import { metalClickSound } from '#/lib/metal-click'

type Point = readonly [number, number]

// Original contours, including the B cutout: https://github.com/mrboxs/mrboxs-brandkit/blob/fb83810ece286280087cbfc35758c8013fde3bf8/01-logos/inline/mrboxs-symbol-currentcolor.svg
const logoContours: ReadonlyArray<ReadonlyArray<Point>> = [
	[
		[16, 15.22],
		[25.1, 9.93],
		[23.31, 8.89],
		[16, 13.13],
		[8.69, 8.89],
		[6.9, 9.93],
	],
	[
		[16, 11.01],
		[21.48, 7.83],
		[19.69, 6.78],
		[16, 8.93],
		[12.31, 6.78],
		[10.52, 7.83],
	],
	[
		[14.21, 5.68],
		[16, 6.72],
		[17.79, 5.68],
		[16, 4.64],
	],
	[
		[16.87, 16.82],
		[16.89, 27.36],
		[26, 22.07],
		[26, 11.57],
	],
	[
		[24.23, 16.82],
		[20.54, 18.96],
		[20.54, 21.05],
		[24.23, 18.86],
		[24.23, 21.05],
		[18.73, 24.23],
		[18.73, 17.86],
		[24.23, 14.62],
	],
	[
		[6, 11.55],
		[6, 22.07],
		[7.74, 23.08],
		[7.74, 14.63],
		[9.61, 15.75],
		[9.61, 24.17],
		[11.44, 25.23],
		[11.44, 16.75],
		[13.25, 17.82],
		[13.25, 26.28],
		[15.06, 27.34],
		[15.09, 16.78],
	],
]

const extrusionDepth = 26
const pressDepth = 13
const transition = {
	type: 'spring',
	mass: 0.5,
	damping: 18,
	stiffness: 200,
} as const

function project([x, y]: Point, offset = 0): Point {
	return [
		278 + ((x + y - 32) * Math.sqrt(3) * 17) / 2,
		162 + ((y - x) * 17) / 2 + offset,
	]
}

function polygonPath(points: ReadonlyArray<Point>): string {
	return `${points
		.map(
			([x, y], index) =>
				`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
		)
		.join('')}Z`
}

function topPath(offset: number): string {
	return logoContours
		.map((contour) =>
			polygonPath(contour.map((point) => project(point, offset)))
		)
		.join('')
}

const topVariants = {
	normal: { d: topPath(0) },
	pressed: { d: topPath(pressDepth) },
}

const sideFaces = logoContours.flatMap((contour, contourIndex) =>
	contour.flatMap((point, index) => {
		const start = project(point)
		const end = project(contour[(index + 1) % contour.length])

		// Source outer contours and the hole have opposite winding. Positive
		// screen-space dx selects the walls facing the viewer for both.
		if (end[0] <= start[0]) return []

		const wallPath = (offset: number) =>
			polygonPath([
				[start[0], start[1] + offset],
				[end[0], end[1] + offset],
				[end[0], end[1] + extrusionDepth],
				[start[0], start[1] + extrusionDepth],
			])

		return [
			{
				id: `${contourIndex}-${index}`,
				depth: (start[1] + end[1]) / 2,
				variants: {
					normal: { d: wallPath(0) },
					pressed: { d: wallPath(pressDepth) },
				},
			},
		]
	})
)

sideFaces.sort((a, b) => a.depth - b.depth)

export function MrBoxsSpotlightLogo() {
	const id = useId()
	const ids = {
		shape: `mrboxs-logo-shape-${id}`,
		pattern: `mrboxs-logo-pattern-${id}`,
		spotlight: `mrboxs-logo-spotlight-${id}`,
		visibleSides: `mrboxs-logo-visible-sides-${id}`,
	}
	const [play] = useSound(metalClickSound)
	const shouldReduceMotion = useReducedMotion()
	const mouseX = useMotionValue(210)
	const mouseY = useMotionValue(130)
	const cx = useSpring(mouseX, { stiffness: 300, damping: 30, mass: 0.1 })
	const cy = useSpring(mouseY, { stiffness: 300, damping: 30, mass: 0.1 })

	return (
		<motion.button
			type="button"
			aria-label="Play mrboxs logo sound"
			className="block w-full touch-manipulation rounded-sm [--pattern:color-mix(in_oklab,var(--foreground)_12%,transparent)] [--stroke:color-mix(in_oklab,var(--foreground)_24%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
			initial="normal"
			whileTap={shouldReduceMotion ? undefined : 'pressed'}
			onClick={() => play()}
			onPointerMove={(event) => {
				if (shouldReduceMotion || event.pointerType === 'touch') return

				const bounds = event.currentTarget.getBoundingClientRect()
				mouseX.set(((event.clientX - bounds.left) / bounds.width) * 556)
				mouseY.set(((event.clientY - bounds.top) / bounds.height) * 354)
			}}
		>
			<svg
				className="h-auto w-full"
				viewBox="0 0 556 354"
				width="556"
				height="354"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<defs>
					<motion.path
						id={ids.shape}
						fillRule="evenodd"
						variants={topVariants}
						transition={transition}
					/>

					<mask
						id={ids.visibleSides}
						maskUnits="userSpaceOnUse"
						x="0"
						y="0"
						width="556"
						height="354"
					>
						<rect width="556" height="354" fill="white" />
						<use href={`#${ids.shape}`} fill="black" />
					</mask>

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

					<motion.radialGradient
						id={ids.spotlight}
						cx={cx}
						cy={cy}
						r="180"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="var(--foreground)" stopOpacity="0.85" />
						<stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
					</motion.radialGradient>
				</defs>

				<g strokeWidth="0.7" strokeLinejoin="round">
					<g mask={`url(#${ids.visibleSides})`}>
						{sideFaces.map((face) => (
							<g key={face.id}>
								<motion.path
									variants={face.variants}
									transition={transition}
									fill="var(--background)"
									stroke="var(--stroke)"
								/>
								<motion.path
									variants={face.variants}
									transition={transition}
									stroke={`url(#${ids.spotlight})`}
								/>
							</g>
						))}
					</g>
					<use
						href={`#${ids.shape}`}
						fill={`url(#${ids.pattern})`}
						stroke="var(--stroke)"
					/>
					<use href={`#${ids.shape}`} stroke={`url(#${ids.spotlight})`} />
				</g>
			</svg>
		</motion.button>
	)
}
