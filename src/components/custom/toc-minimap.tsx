import { useRouter } from '@tanstack/react-router'

import {
	useCallback,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react'
import type { MouseEvent, ReactNode } from 'react'

import { IconList } from '@tabler/icons-react'
import { cn } from 'cn'

import {
	Popover,
	PopoverContent,
	PopoverTitle,
	PopoverTrigger,
} from '#/components/ui/popover'
import { useSound } from '#/hooks/use-sound'
import { uMiniMapOpenSound } from '#/lib/u-mini-map-open'

export type TOCItemType = {
	title: ReactNode
	url: string
	depth: number
}

export type TOCMinimapProps = {
	items: Array<TOCItemType>
	className?: string
}

export function TOCMinimap({ items, className }: TOCMinimapProps) {
	const headings = useMemo(
		() =>
			items.flatMap((item) => {
				if (!item.url.startsWith('#')) return []
				try {
					const id = decodeURIComponent(item.url.slice(1))
					return id ? [{ ...item, id }] : []
				} catch {
					return []
				}
			}),
		[items]
	)
	return headings.length > 0 ? (
		<TOCMinimapContent items={headings} className={className} />
	) : null
}

function TOCMinimapContent({
	items,
	className,
}: {
	items: Array<TOCItemType & { id: string }>
	className?: string
}) {
	const router = useRouter()
	const itemIds = useMemo(() => items.map((item) => item.id), [items])
	const activeHeading = useActiveHeading(itemIds)
	const [open, setOpen] = useState(false)
	const navigating = useRef(false)
	const pointerInside = useRef(false)
	const pendingFocus = useRef<HTMLElement | null>(null)
	const outline = useRef<HTMLElement | null>(null)
	const [play] = useSound(uMiniMapOpenSound, { volume: 0.3 })
	const barHeight = `min(${Math.max(items.length * 14 - 12, 2)}px, 50dvh)`
	const attachOutline = useCallback((element: HTMLElement | null) => {
		outline.current = element
		alignActiveItem(element)
	}, [])

	function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return
		}
		const target = document.getElementById(id)
		if (!target) return
		event.preventDefault()
		const keepOpen = pointerInside.current && event.detail > 0
		navigating.current = !keepOpen
		pendingFocus.current = keepOpen ? target : null
		if (!keepOpen) {
			pointerInside.current = false
			setOpen(false)
		}
		void router.navigate({
			hash: id,
			search: true,
			resetScroll: false,
			hashScrollIntoView: false,
		})
		target.scrollIntoView({
			block: 'start',
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
				? 'instant'
				: 'smooth',
		})
		if (!keepOpen) target.focus({ preventScroll: true })
	}

	return (
		<div
			data-slot="toc-minimap"
			className={cn('w-fit lg:w-14', className)}
			style={{
				top: `max(0px, calc((100dvh - max(2.75rem, calc(${barHeight} + 1.5rem))) / 2))`,
			}}
		>
			<Popover
				open={open}
				onOpenChange={(nextOpen, details) => {
					if (
						!nextOpen &&
						pointerInside.current &&
						(details.reason === 'focus-out' ||
							details.reason === 'trigger-hover')
					) {
						details.cancel()
						return
					}
					setOpen(nextOpen)
					if (nextOpen && !open) {
						navigating.current = false
						pendingFocus.current = null
						// Reopening can reuse the popup before its exit animation finishes.
						alignActiveItem(outline.current)
						play()
					} else if (!nextOpen) {
						pointerInside.current = false
						pendingFocus.current = null
					}
				}}
			>
				<PopoverTrigger
					openOnHover
					delay={0}
					closeDelay={100}
					aria-label="Table of contents"
					className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none lg:py-3 lg:pr-0 lg:pl-6"
				>
					<IconList aria-hidden="true" className="size-4 lg:hidden" />
					<span className="lg:sr-only">On this page</span>
					<span
						aria-hidden="true"
						className="hidden w-8 flex-col justify-between lg:flex"
						style={{ height: barHeight }}
					>
						{items.map((item) => (
							<div
								key={item.url}
								data-depth={Math.min(4, Math.max(2, item.depth))}
								data-active={item.id === activeHeading}
								className={cn(
									'h-0.5 w-6 rounded-xs bg-ring/50 transition-colors duration-200 motion-reduce:transition-none',
									'data-[depth=3]:ml-2 data-[depth=3]:w-4',
									'data-[depth=4]:ml-4 data-[depth=4]:w-2',
									'data-active:bg-foreground'
								)}
							/>
						))}
					</span>
				</PopoverTrigger>
				<PopoverContent
					className="w-56 max-w-[calc(100dvw-2rem)] overflow-hidden p-0 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
					finalFocus={() => !navigating.current}
					initialFocus={(interaction) =>
						interaction === 'keyboard'
							? (outline.current?.querySelector<HTMLAnchorElement>(
									'a[aria-current="location"]'
								) ?? true)
							: interaction === 'touch'
					}
					onPointerEnter={(event) => {
						if (event.pointerType !== 'touch') pointerInside.current = true
					}}
					onPointerLeave={(event) => {
						if (event.pointerType === 'touch') return
						pointerInside.current = false
						const target = pendingFocus.current
						pendingFocus.current = null
						if (target?.isConnected) {
							navigating.current = true
							target.focus({ preventScroll: true })
						}
						setOpen(false)
					}}
					align="start"
					alignOffset={0}
					side="left"
					sideOffset={4}
				>
					<PopoverTitle className="sr-only">On this page</PopoverTitle>
					<nav
						ref={attachOutline}
						aria-label="On this page"
						className="relative max-h-[50dvh] overflow-y-auto overscroll-contain"
					>
						<ul className="flex flex-col px-4 py-2 text-sm">
							{items.map((item) => (
								<li key={item.url}>
									<a
										href={item.url}
										data-depth={Math.min(4, Math.max(2, item.depth))}
										data-active={item.id === activeHeading}
										aria-current={
											item.id === activeHeading ? 'location' : undefined
										}
										className={cn(
											'flex min-h-11 w-full cursor-pointer items-center rounded-sm py-2 wrap-anywhere transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none',
											'text-muted-foreground hover:text-foreground data-active:text-foreground',
											'data-[depth=3]:pl-4 data-[depth=4]:pl-8'
										)}
										onClick={(event) => navigate(event, item.id)}
									>
										{item.title}
									</a>
								</li>
							))}
						</ul>
					</nav>
				</PopoverContent>
			</Popover>
		</div>
	)
}

function alignActiveItem(outline: HTMLElement | null) {
	const active = outline?.querySelector<HTMLElement>(
		'a[aria-current="location"]'
	)
	if (outline && active) outline.scrollTop = active.offsetTop
}

export function useActiveHeading(itemIds: Array<string>) {
	const subscribe = useCallback(
		(notify: () => void) => {
			let frame: number | undefined
			function update() {
				if (frame !== undefined) return
				frame = requestAnimationFrame(() => {
					frame = undefined
					notify()
				})
			}
			const observer =
				typeof IntersectionObserver === 'undefined'
					? undefined
					: new IntersectionObserver(update, {
							rootMargin: '-96px 0px -60% 0px',
							threshold: 0,
						})
			for (const id of itemIds) {
				const element = document.getElementById(id)
				if (element) observer?.observe(element)
			}
			const resizeObserver =
				typeof ResizeObserver === 'undefined'
					? undefined
					: new ResizeObserver(update)
			const article = itemIds
				.map((id) => document.getElementById(id)?.closest('article'))
				.find((element) => element)
			if (article) resizeObserver?.observe(article)
			window.addEventListener('scroll', update, { passive: true })
			window.addEventListener('resize', update)
			return () => {
				observer?.disconnect()
				resizeObserver?.disconnect()
				window.removeEventListener('scroll', update)
				window.removeEventListener('resize', update)
				if (frame !== undefined) cancelAnimationFrame(frame)
			}
		},
		[itemIds]
	)
	const getSnapshot = useCallback(() => {
		const elements = itemIds
			.map((id) => document.getElementById(id))
			.filter((element) => element !== null)
		if (elements.length === 0) return null
		if (
			window.scrollY > 0 &&
			window.scrollY + window.innerHeight >=
				document.documentElement.scrollHeight - 1
		) {
			return elements.at(-1)?.id ?? null
		}
		// Follow the rendered permalink scroll margin, including changes from text zoom.
		const offset =
			Number.parseFloat(getComputedStyle(elements[0]).scrollMarginTop) || 96
		let active = elements[0].id
		for (const element of elements) {
			if (element.getBoundingClientRect().top <= offset + 1) active = element.id
		}
		return active
	}, [itemIds])
	return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
