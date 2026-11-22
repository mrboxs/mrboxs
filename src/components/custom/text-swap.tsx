'use client'

import { Children, useEffect, useRef, useState } from 'react'

import { cn } from 'cn'
import type { Transition, Variants } from 'motion/react'
import {
	AnimatePresence,
	domAnimation,
	LazyMotion,
	m,
	useReducedMotion,
} from 'motion/react'

const defaultTransition: Transition = {
	type: 'spring',
	visualDuration: 0.35,
	bounce: 0,
}

const exitTransition: Transition = { duration: 0.2, ease: 'easeOut' }

const defaultVariants: Variants = {
	initial: { y: '-0.25em', opacity: 0, filter: 'blur(2px)' },
	animate: { y: '0em', opacity: 1, filter: 'blur(0px)' },
	exit: {
		y: '0.25em',
		opacity: 0,
		filter: 'blur(2px)',
		transition: exitTransition,
	},
}

// `animate` stays shared: it is what the server renders with `initial={false}`,
// and the client reads the media query before hydrating.
const reducedMotionVariants: Variants = {
	...defaultVariants,
	initial: { opacity: 0 },
	exit: { opacity: 0, transition: exitTransition },
}

type MotionElement = typeof m.p | typeof m.span | typeof m.code

export type TextSwapProps = {
	/**
	 * Motion element to render.
	 * @defaultValue m.p
	 * */
	as?: MotionElement
	className?: string
	/** Array of children to cycle through. */
	children: Array<React.ReactNode>

	/**
	 * Time in seconds between each swap.
	 * @defaultValue 2
	 * */
	interval?: number
	/**
	 * Motion transition for the enter animation. The default exit is faster and
	 * sets its own transition.
	 * @defaultValue { type: "spring", visualDuration: 0.35, bounce: 0 }
	 * */
	transition?: Transition
	/**
	 * Motion variants for enter/exit animations. Replaces the defaults, including
	 * their reduced motion fallback.
	 * */
	variants?: Variants

	/** Controls whether the swap animation runs. */
	play?: boolean

	/** Called with the new index after each swap. */
	onIndexChange?: (index: number) => void
}

export function TextSwap({
	as: Component = m.p,
	className,
	children,

	interval = 2,
	transition = defaultTransition,
	variants,
	play = true,

	onIndexChange,
}: TextSwapProps) {
	const [currentIndex, setCurrentIndex] = useState(0)
	const indexRef = useRef(0)
	const shouldReduceMotion = useReducedMotion()

	const items = Children.toArray(children)
	const activeIndex = items.length > 0 ? currentIndex % items.length : 0

	useEffect(() => {
		if (!play || items.length < 2) return

		const timer = setInterval(() => {
			const next = (indexRef.current + 1) % items.length
			indexRef.current = next
			setCurrentIndex(next)
			onIndexChange?.(next)
		}, interval * 1000)

		return () => clearInterval(timer)
	}, [play, interval, items.length, onIndexChange])

	return (
		<LazyMotion features={domAnimation} strict>
			<AnimatePresence mode="wait" initial={false}>
				<Component
					key={activeIndex}
					className={cn('inline-block', className)}
					initial="initial"
					animate="animate"
					exit="exit"
					transition={transition}
					variants={
						variants ??
						(shouldReduceMotion ? reducedMotionVariants : defaultVariants)
					}
				>
					{items[activeIndex]}
				</Component>
			</AnimatePresence>
		</LazyMotion>
	)
}
