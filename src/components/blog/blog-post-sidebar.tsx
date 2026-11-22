import { useHotkey } from '@tanstack/react-hotkeys'
import { useRouter } from '@tanstack/react-router'

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import { LineNav } from '#/components/custom/line-nav'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import type { PostMetadata } from '#/lib/blog'

const desktopQuery = '(min-width: 1280px)'

function subscribeToDesktop(notify: () => void) {
	const query = window.matchMedia(desktopQuery)
	query.addEventListener('change', notify)
	return () => query.removeEventListener('change', notify)
}

function desktopSnapshot() {
	return window.matchMedia(desktopQuery).matches
}

function serverDesktopSnapshot() {
	return false
}

export function BlogPostSidebar({
	posts,
	slug,
	loading,
	refreshing,
	onRetry,
}: {
	posts?: Array<PostMetadata>
	slug: string
	loading: boolean
	refreshing: boolean
	onRetry: () => void
}) {
	const router = useRouter()
	const [open, setOpen] = useState(true)
	const desktop = useSyncExternalStore(
		subscribeToDesktop,
		desktopSnapshot,
		serverDesktopSnapshot
	)
	const panelId = useId()
	const trigger = useRef<HTMLButtonElement | null>(null)
	const scrollArea = useRef<HTMLDivElement | null>(null)

	function toggle() {
		if (open && scrollArea.current?.contains(document.activeElement)) {
			trigger.current?.focus({ preventScroll: true })
		}
		setOpen((value) => !value)
	}

	useHotkey(
		'S',
		(event) => {
			if (
				event.target instanceof Element &&
				event.target.closest(
					'[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
				)
			) {
				return
			}
			event.preventDefault()
			toggle()
		},
		{
			enabled: desktop,
			ignoreInputs: true,
			ignoreDefaultPrevented: true,
			preventDefault: false,
			requireReset: true,
			meta: { name: 'Toggle blog sidebar' },
		}
	)

	useEffect(() => {
		if (!open || !desktop) return
		const area = scrollArea.current
		const active = area?.querySelector<HTMLAnchorElement>(
			'a[aria-current="page"]'
		)
		if (!area || !active) return
		const areaRect = area.getBoundingClientRect()
		const activeRect = active.getBoundingClientRect()
		area.scrollTop +=
			activeRect.top - areaRect.top - (areaRect.height - activeRect.height) / 2
	}, [open, slug, posts, desktop])

	return (
		<div
			data-slot="blog-sidebar"
			data-open={open}
			className="sticky top-(--blog-sidebar-top) isolate w-60 [--blog-sidebar-top:calc(6.5rem+3px)]"
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							ref={trigger}
							variant="ghost"
							size="icon-sm"
							aria-label="Toggle Sidebar"
							aria-expanded={open}
							aria-controls={panelId}
							aria-keyshortcuts="S"
							data-open={open}
							className="absolute top-1.5 left-1.5 z-10 rounded-md border-none aria-expanded:bg-transparent aria-expanded:hover:bg-muted data-[open=false]:inset-ring-1 data-[open=false]:inset-ring-border motion-reduce:transition-none pointer-coarse:size-11"
							onClick={toggle}
						/>
					}
				>
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
						<rect
							x="2"
							y="3"
							width="20"
							height="18"
							rx="4"
							stroke="currentColor"
							strokeWidth="2"
						/>
						<rect
							x="5"
							y="6"
							height="12"
							rx="1"
							fill="currentColor"
							style={{ width: open ? 6 : 2 }}
							className="transition-[width] duration-300 motion-reduce:transition-none"
						/>
					</svg>
				</TooltipTrigger>
				<TooltipContent
					side="right"
					className="gap-3 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
				>
					Toggle Sidebar <Kbd>S</Kbd>
				</TooltipContent>
			</Tooltip>
			<div
				id={panelId}
				data-slot="blog-sidebar-panel"
				data-open={open}
				aria-hidden={!open}
				inert={!open}
				className="relative flex h-[calc(100svh-var(--blog-sidebar-top)-1rem)] flex-col rounded-xl border border-border bg-background transition-[translate] duration-350 ease-[cubic-bezier(0.24,0.88,0.28,0.92)] data-[open=false]:-translate-x-[calc(100%-1px)] motion-reduce:transition-none"
			>
				<div
					ref={scrollArea}
					data-slot="blog-sidebar-scroll"
					aria-busy={loading}
					className="min-h-0 grow [scrollbar-width:none] overflow-x-clip overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_2rem,black_calc(100%-1rem),transparent)] pt-10.25 [&::-webkit-scrollbar]:hidden"
				>
					{posts !== undefined ? (
						posts.length > 0 ? (
							<LineNav
								aria-label="Blog posts"
								className="pr-0.5 pl-3"
								items={posts.map((post) => ({
									title: post.title,
									href: `/blog/${post.slug}`,
								}))}
								activeHref={`/blog/${slug}`}
								scrollActiveIntoView={false}
								onItemClick={(item, event) => {
									if (
										event.defaultPrevented ||
										event.button !== 0 ||
										event.ctrlKey ||
										event.metaKey ||
										event.shiftKey ||
										event.altKey
									) {
										return
									}
									const post = posts.find(
										(entry) => item.href === `/blog/${entry.slug}`
									)
									if (!post) return
									event.preventDefault()
									void router.navigate({
										to: '/blog/$slug',
										params: { slug: post.slug },
									})
								}}
							/>
						) : (
							<p className="px-3 py-5 text-sm text-muted-foreground">
								Belum ada tulisan.
							</p>
						)
					) : loading ? (
						<output className="block px-3 py-5 text-sm text-muted-foreground">
							Memuat tulisan…
						</output>
					) : (
						<div className="flex flex-col items-start gap-3 px-3 py-5">
							<p role="alert" className="text-sm text-muted-foreground">
								Daftar tulisan belum bisa dimuat.
							</p>
							<Button
								variant="secondary"
								size="sm"
								disabled={refreshing}
								onClick={onRetry}
							>
								{refreshing ? 'Memuat…' : 'Coba lagi'}
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
