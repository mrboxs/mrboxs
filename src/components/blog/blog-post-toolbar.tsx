import { Link, useRouter } from '@tanstack/react-router'

import { useEffect, useRef, useState } from 'react'

import {
	IconArrowLeft,
	IconArrowRight,
	IconBrandLinkedin,
	IconBrandX,
	IconCheck,
	IconChevronDown,
	IconCopy,
	IconDownload,
	IconLink,
	IconShare2,
	IconX,
} from '@tabler/icons-react'

import { Button, buttonVariants } from '#/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '#/components/ui/button-group'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { toast } from '#/components/ui/toast'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import type { BlogPost, PostMetadata } from '#/lib/blog'

async function copyLink(url: string) {
	try {
		await navigator.clipboard.writeText(url)
		toast.add({ type: 'success', title: 'Link copied' })
	} catch {
		toast.add({
			type: 'error',
			title: 'Could not copy link',
			description: 'Allow clipboard access and try again.',
		})
	}
}

function downloadMarkdown(markdown: string, slug: string) {
	const url = URL.createObjectURL(
		new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
	)
	const link = document.createElement('a')
	link.href = url
	link.download = `${slug}.md`
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function PostCopyMenu({
	markdown,
	slug,
	url,
}: {
	markdown: string
	slug: string
	url: string
}) {
	const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const attempt = useRef(0)
	useEffect(
		() => () => {
			clearTimeout(timer.current)
			attempt.current++
		},
		[]
	)

	async function copyPage() {
		const currentAttempt = ++attempt.current
		clearTimeout(timer.current)
		let result: 'copied' | 'failed'
		try {
			await navigator.clipboard.writeText(markdown)
			result = 'copied'
		} catch {
			result = 'failed'
		}
		if (currentAttempt !== attempt.current) return
		setState(result)
		timer.current = setTimeout(() => setState('idle'), 2500)
	}

	return (
		<>
			<ButtonGroup aria-label="Copy article">
				<Button
					variant="secondary"
					size="sm"
					className="gap-1.5 border-none px-2 text-[0.8125rem]"
					aria-label="Copy page"
					onClick={() => void copyPage()}
				>
					{state === 'copied' ? (
						<IconCheck aria-hidden="true" />
					) : state === 'failed' ? (
						<IconX aria-hidden="true" />
					) : (
						<IconCopy aria-hidden="true" />
					)}
					<span className="max-[28rem]:hidden">Copy page</span>
				</Button>
				<ButtonGroupSeparator className="border-y-4 border-secondary dark:bg-white/20 data-vertical:my-0" />
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button
								variant="secondary"
								size="icon-sm"
								className="border-none"
								aria-label="Page options"
							/>
						}
					>
						<IconChevronDown aria-hidden="true" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="blog-action-menu w-fit min-w-48 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
						align="end"
					>
						<DropdownMenuGroup>
							<DropdownMenuItem
								onClick={() => downloadMarkdown(markdown, slug)}
							>
								<IconDownload aria-hidden="true" />
								Download Markdown
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => void copyLink(url)}>
								<IconLink aria-hidden="true" />
								Copy link
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
			<output className="sr-only" aria-live="polite">
				{state === 'copied'
					? 'Page copied'
					: state === 'failed'
						? 'Could not copy page. Allow clipboard access and try again.'
						: ''}
			</output>
		</>
	)
}

function PostShareMenu({ url }: { url: string }) {
	const encodedUrl = encodeURIComponent(url)
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="secondary"
						size="icon-sm"
						className="border-none"
						aria-label="Share page"
					/>
				}
			>
				<IconShare2 aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="blog-action-menu w-fit min-w-48 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
				align="end"
			>
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={() => void copyLink(url)}>
						<IconLink aria-hidden="true" />
						Copy link
					</DropdownMenuItem>
					<DropdownMenuItem
						render={
							<a
								href={`https://x.com/intent/tweet?url=${encodedUrl}`}
								aria-label="Share on X (opens in a new tab)"
								target="_blank"
								rel="noopener noreferrer"
							/>
						}
					>
						<IconBrandX aria-hidden="true" />
						Share on X
					</DropdownMenuItem>
					<DropdownMenuItem
						render={
							<a
								href={`https://www.linkedin.com/sharing/share-offsite?url=${encodedUrl}`}
								aria-label="Share on LinkedIn (opens in a new tab)"
								target="_blank"
								rel="noopener noreferrer"
							/>
						}
					>
						<IconBrandLinkedin aria-hidden="true" />
						Share on LinkedIn
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function PostNavigationLink({
	post,
	direction,
}: {
	post?: PostMetadata
	direction: 'previous' | 'next'
}) {
	const label = direction === 'previous' ? 'Previous post' : 'Next post'
	const icon =
		direction === 'previous' ? (
			<IconArrowLeft aria-hidden="true" />
		) : (
			<IconArrowRight aria-hidden="true" />
		)
	if (!post) {
		return (
			<Button
				variant="secondary"
				size="icon-sm"
				className="border-none"
				aria-label={label}
				disabled
			>
				{icon}
			</Button>
		)
	}
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						to="/blog/$slug"
						params={{ slug: post.slug }}
						aria-label={label}
						data-slot="button"
						className={buttonVariants({
							variant: 'secondary',
							size: 'icon-sm',
							className: 'border-none',
						})}
					/>
				}
			>
				{icon}
			</TooltipTrigger>
			<TooltipContent>
				{label}: {post.title}
			</TooltipContent>
		</Tooltip>
	)
}

export function BlogPostToolbar({
	post,
	previous,
	next,
	loading,
}: {
	post: Pick<BlogPost, 'title' | 'slug' | 'description' | 'body'>
	previous?: PostMetadata
	next?: PostMetadata
	loading: boolean
}) {
	const router = useRouter()
	const url = new URL(`/blog/${post.slug}`, router.origin).href
	const markdown = `# ${post.title}\n\n${post.description}\n\n${post.body}`
	return (
		<nav
			className="blog-post-toolbar flex flex-wrap items-center justify-between gap-1 p-2 pl-4 sm:gap-2"
			aria-label="Blog navigation"
		>
			<Link
				to="/blog"
				className="inline-flex h-7 shrink-0 items-center gap-2 rounded-sm text-sm tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"
			>
				<IconArrowLeft className="size-4" aria-hidden="true" />
				Blog
			</Link>
			<div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1 sm:gap-2">
				<PostCopyMenu markdown={markdown} slug={post.slug} url={url} />
				<PostShareMenu url={url} />
				<fieldset
					aria-label="Post navigation"
					aria-busy={loading}
					className="flex min-w-0 items-center gap-1 sm:gap-2"
				>
					<PostNavigationLink post={previous} direction="previous" />
					<PostNavigationLink post={next} direction="next" />
				</fieldset>
			</div>
		</nav>
	)
}
