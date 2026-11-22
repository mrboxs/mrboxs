import { memo, useEffect, useRef } from 'react'

import { cn } from 'cn'
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'

const lineVariants = {
	normal: { width: 24 },
	active: { width: 40 },
	hover: { width: 40 },
}

export type LineNavItem = {
	title: string
	href: string
}

export type LineNavProps = {
	className?: string
	'aria-label'?: string
	/** @fumadocsHref #linenavitem */
	items: Array<LineNavItem>
	/** Href of the active item. */
	activeHref?: string
	/** Scroll the active item into view on mount. */
	scrollActiveIntoView?: boolean
	/** Called when an item is clicked. */
	onItemClick?: (
		item: LineNavItem,
		event: React.MouseEvent<HTMLAnchorElement>
	) => void
}

export function LineNav({
	className,
	'aria-label': label,
	items,
	activeHref,
	scrollActiveIntoView = true,
	onItemClick,
}: LineNavProps) {
	const activeItemRef = useRef<HTMLAnchorElement | null>(null)
	const reduceMotion = useReducedMotion()

	useEffect(() => {
		if (scrollActiveIntoView) {
			activeItemRef.current?.scrollIntoView({ block: 'center' })
		}
	}, [scrollActiveIntoView])

	return (
		<LazyMotion features={domAnimation}>
			<nav
				aria-label={label}
				data-slot="line-nav"
				className={cn('flex min-w-0 flex-col gap-2 py-5.25', className)}
				style={
					{
						'--line-nav-width': `${lineVariants.normal.width}px`,
					} as React.CSSProperties
				}
			>
				{items.map((item, index) => {
					const isActive = item.href === activeHref

					return (
						<LineNavLink
							key={item.href}
							ref={isActive ? activeItemRef : undefined}
							title={item.title}
							href={item.href}
							active={isActive}
							reduceMotion={reduceMotion === true}
							isLast={index === items.length - 1}
							onClick={
								onItemClick ? (event) => onItemClick(item, event) : undefined
							}
						/>
					)
				})}
			</nav>
		</LazyMotion>
	)
}

const LineNavLink = memo(function LineNavLink({
	ref,
	title,
	href,
	active = false,
	reduceMotion = false,
	isLast = false,
	onClick,
}: {
	ref?: React.Ref<HTMLAnchorElement>
	title: string
	href: string
	active?: boolean
	reduceMotion?: boolean
	isLast?: boolean
	onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) {
	return (
		<>
			<m.a
				ref={ref}
				aria-current={active ? 'page' : undefined}
				className="group relative flex h-px min-w-0 items-center gap-3 outline-none after:absolute after:top-1/2 after:left-0 after:size-full after:-translate-y-1/2 after:rounded-xs after:p-3.5 focus-visible:after:outline-2 focus-visible:after:outline-ring pointer-coarse:min-h-11"
				href={href}
				title={title}
				initial={false}
				animate={active ? 'active' : 'normal'}
				whileHover="hover"
				whileFocus="hover"
				onClick={onClick}
			>
				<m.span
					aria-hidden="true"
					className="block h-px shrink-0 bg-foreground/20 transition-[background-color] ease-out group-hover:bg-foreground group-focus-visible:bg-foreground group-aria-[current=page]:bg-foreground motion-reduce:transition-none"
					variants={lineVariants}
					transition={
						reduceMotion
							? { duration: 0 }
							: { type: 'spring', stiffness: 200, damping: 20 }
					}
				/>
				<span className="min-w-0 truncate text-sm text-muted-foreground transition-[color] ease-out group-hover:text-foreground group-focus-visible:text-foreground group-aria-[current=page]:text-foreground motion-reduce:transition-none">
					{title}
				</span>
			</m.a>

			{!isLast && (
				<>
					<span
						aria-hidden="true"
						className="block h-px w-(--line-nav-width) bg-foreground/20"
					/>
					<span
						aria-hidden="true"
						className="block h-px w-(--line-nav-width) bg-foreground/20"
					/>
				</>
			)}
		</>
	)
})
