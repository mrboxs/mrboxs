import { useState, useEffect, useRef, Children, type ReactNode } from 'react'

import { cn } from 'cn'
import type { Transition, Variants, AnimatePresenceProps } from 'motion/react'
import {
	AnimatePresence,
	domAnimation,
	LazyMotion,
	m,
	useReducedMotion,
} from 'motion/react'

export type TextLoopProps = {
	children: Array<ReactNode>
	id?: string
	className?: string
	interval?: number
	transition?: Transition
	variants?: Variants
	onIndexChange?: (index: number) => void
	trigger?: boolean
	mode?: AnimatePresenceProps['mode']
}

export function TextLoop({
	children,
	id,
	className,
	interval = 2,
	transition = { duration: 0.3 },
	variants,
	onIndexChange,
	trigger = true,
	mode = 'popLayout',
}: TextLoopProps) {
	const [currentIndex, setCurrentIndex] = useState(0)
	const indexRef = useRef(0)
	const shouldReduceMotion = useReducedMotion()
	const items = Children.toArray(children)
	const activeIndex = items.length > 0 ? currentIndex % items.length : 0

	useEffect(() => {
		if (!trigger || items.length < 2) return

		const intervalMs = interval * 1000
		const timer = setInterval(() => {
			const next = (indexRef.current + 1) % items.length
			indexRef.current = next
			setCurrentIndex(next)
			onIndexChange?.(next)
		}, intervalMs)
		return () => clearInterval(timer)
	}, [items.length, interval, onIndexChange, trigger])

	const motionVariants: Variants = {
		initial: { y: 20, opacity: 0 },
		animate: { y: 0, opacity: 1 },
		exit: { y: -20, opacity: 0 },
	}

	return (
		<LazyMotion features={domAnimation} strict>
			<div id={id} className={cn('relative min-w-0', className)}>
				<AnimatePresence mode={mode} initial={false}>
					<m.div
						key={activeIndex}
						initial="initial"
						animate="animate"
						exit="exit"
						transition={shouldReduceMotion ? { duration: 0 } : transition}
						variants={variants ?? motionVariants}
					>
						{items[activeIndex]}
					</m.div>
				</AnimatePresence>
			</div>
		</LazyMotion>
	)
}
