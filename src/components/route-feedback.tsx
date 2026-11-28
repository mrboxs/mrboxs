import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'

import type { ReactNode } from 'react'

import { ORPCError } from '@orpc/client'
import { IconRefresh } from '@tabler/icons-react'
import { cn } from 'cn'

import { Button, buttonVariants } from '#/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '#/components/ui/card'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '#/components/ui/empty'
import { Skeleton } from '#/components/ui/skeleton'

type Scope = 'page' | 'blog'

const actionClassName =
	'h-11 px-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground motion-reduce:transform-none motion-reduce:transition-none sm:pointer-fine:h-9'

function PageFrame({
	children,
	id = 'main-content',
}: {
	children: ReactNode
	id?: string
}) {
	return (
		<main id={id} className="overflow-x-clip pt-14">
			<div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col">
				<div className="relative isolate flex flex-1 flex-col border-x border-line pt-12">
					{children}
				</div>
			</div>
		</main>
	)
}

function PageStatus({
	code,
	title,
	description,
	scope,
	alert = false,
	children,
}: {
	code: string
	title: string
	description: string
	scope: Scope
	alert?: boolean
	children: ReactNode
}) {
	return (
		<PageFrame>
			<section
				aria-labelledby="page-state-title"
				className="screen-line-bottom screen-line-top my-auto px-4 py-10 sm:px-8 sm:py-12"
			>
				<p className="mb-8 font-mono text-xs text-muted-foreground">
					{scope === 'blog' ? 'Blog' : 'Portfolio'}
				</p>
				<Empty className="items-start gap-8 p-0 text-left">
					<EmptyMedia className="mb-0">
						<p className="font-mono text-[clamp(4rem,20vw,10rem)] leading-none tracking-tighter tabular-nums">
							{code}
						</p>
					</EmptyMedia>
					<EmptyHeader className="max-w-none items-start gap-3">
						<EmptyTitle>
							<h1
								id="page-state-title"
								className="font-heading text-3xl font-medium tracking-tight text-balance wrap-anywhere"
							>
								{title}
							</h1>
						</EmptyTitle>
						<EmptyDescription
							className="max-w-sm"
							role={alert ? 'alert' : undefined}
						>
							{description}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent className="max-w-none items-stretch sm:items-start">
						<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
							{children}
						</div>
					</EmptyContent>
				</Empty>
			</section>
		</PageFrame>
	)
}

function PageLink({
	to,
	primary = false,
	children,
}: {
	to: '/' | '/blog'
	primary?: boolean
	children: ReactNode
}) {
	return (
		<Link
			to={to}
			data-slot="button"
			className={cn(
				buttonVariants({ variant: primary ? 'default' : 'outline' }),
				actionClassName
			)}
		>
			{children}
		</Link>
	)
}

export function PageNotFound({ scope = 'page' }: { scope?: Scope }) {
	const blog = scope === 'blog'
	return (
		<PageStatus
			code="404"
			scope={scope}
			title={blog ? 'Tulisan tidak ditemukan' : 'Page not found'}
			description={
				blog
					? 'Tulisan ini tidak tersedia. Kamu bisa menemukan tulisan lainnya di blog.'
					: 'There’s no page at this address. Return home or explore the blog.'
			}
		>
			<PageLink to={blog ? '/blog' : '/'} primary>
				{blog ? 'Kembali ke daftar tulisan' : 'Back to home'}
			</PageLink>
			<PageLink to={blog ? '/' : '/blog'}>
				{blog ? 'Beranda' : 'Browse blog'}
			</PageLink>
		</PageStatus>
	)
}

export function PageError({
	error,
	scope = 'page',
}: {
	error: unknown
	scope?: Scope
}) {
	const router = useRouter()
	const loading = useRouterState({ select: (state) => state.isLoading })
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})
	const { reset } = useQueryErrorResetBoundary()
	const blog = scope === 'blog'
	const blogIndex = pathname === '/blog' || pathname === '/blog/'
	const backTo = pathname === '/' || (blog && !blogIndex) ? '/blog' : '/'
	const rateLimited =
		error instanceof ORPCError && error.code === 'TOO_MANY_REQUESTS'
	const copy = blog
		? {
				title: 'Tulisan belum bisa dimuat',
				description:
					'Terjadi kesalahan saat mengambil tulisan. Silakan coba lagi.',
				rateLimited: 'Batas permintaan sumber tercapai. Coba lagi nanti.',
				retry: 'Coba lagi',
				retrying: 'Mencoba lagi…',
				home: 'Beranda',
				blog: 'Kembali ke daftar tulisan',
			}
		: {
				title: 'Something went wrong',
				description:
					'We couldn’t load this page. Try again, or head back to the portfolio.',
				rateLimited: 'Too many requests. Wait a little before trying again.',
				retry: 'Try again',
				retrying: 'Trying again…',
				home: 'Back to home',
				blog: 'Browse blog',
			}

	return (
		<PageStatus
			code={rateLimited ? '429' : '500'}
			scope={scope}
			title={copy.title}
			description={rateLimited ? copy.rateLimited : copy.description}
			alert
		>
			<Button
				className={actionClassName}
				disabled={loading}
				onClick={() => {
					reset()
					void router.invalidate()
				}}
			>
				<IconRefresh data-icon="inline-start" aria-hidden="true" />
				{loading ? copy.retrying : copy.retry}
			</Button>
			<PageLink to={backTo}>
				{backTo === '/blog' ? copy.blog : copy.home}
			</PageLink>
		</PageStatus>
	)
}

function TextSkeleton() {
	return (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-5/6" />
		</div>
	)
}

function HeadingSkeleton() {
	return (
		<div className="screen-line-bottom flex flex-col gap-3 px-4 py-4">
			<Skeleton className="h-8 w-5/6" />
			<Skeleton className="h-8 w-3/5" />
		</div>
	)
}

function PostCardSkeleton() {
	return (
		<Card variant="ghost" className="pointer-events-none gap-2 p-2">
			<CardContent className="px-0">
				<Skeleton className="aspect-1200/630 w-full rounded-xl" />
			</CardContent>
			<CardHeader className="gap-2 p-2">
				<CardTitle>
					<Skeleton className="h-5 w-5/6" />
				</CardTitle>
				<CardDescription>
					<Skeleton className="h-4 w-24" />
				</CardDescription>
			</CardHeader>
		</Card>
	)
}

export function PagePending({
	layout = 'page',
}: {
	layout?: 'page' | 'posts' | 'post'
}) {
	const label = {
		page: 'Loading page…',
		posts: 'Memuat daftar tulisan…',
		post: 'Memuat tulisan…',
	}[layout]
	return (
		<PageFrame id="pending-content">
			<h1 className="screen-line-bottom screen-line-top px-4 py-3 font-mono text-sm font-normal text-muted-foreground">
				<output>{label}</output>
			</h1>
			<section aria-label="Page content" aria-busy="true" className="pb-8">
				<div aria-hidden="true">
					<HeadingSkeleton />
					{layout === 'posts' ? (
						<>
							<div className="screen-line-bottom p-2">
								<Skeleton className="h-12 w-full rounded-lg md:pointer-fine:h-9" />
							</div>
							<div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
								<PostCardSkeleton />
								<PostCardSkeleton />
								<PostCardSkeleton />
								<PostCardSkeleton />
							</div>
						</>
					) : (
						<div className="flex flex-col gap-8 px-4 pt-8">
							<TextSkeleton />
							{layout === 'post' && (
								<Skeleton className="aspect-video w-full rounded-xl" />
							)}
							<TextSkeleton />
							<TextSkeleton />
						</div>
					)}
				</div>
			</section>
		</PageFrame>
	)
}
