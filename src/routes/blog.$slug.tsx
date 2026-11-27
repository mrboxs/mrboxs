import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import { ORPCError } from '@orpc/client'

import {
	BlogError,
	BlogNotFound,
	BlogPending,
} from '#/components/blog/blog-feedback'
import { BlogPostSidebar } from '#/components/blog/blog-post-sidebar'
import { BlogPostToolbar } from '#/components/blog/blog-post-toolbar'
import { TOCMinimap } from '#/components/custom/toc-minimap'
import { MarkdownRenderer } from '#/components/markdown-renderer'
import { ContentImage } from '#/components/markdown-renderer/image'
import { articleHeadings } from '#/constants/headings'
import { useBlogNavigation } from '#/hooks/use-blog-navigation'
import { useBlogUpdates } from '#/hooks/use-blog-updates'
import { getPostAssetUrl } from '#/lib/blog'
import { blogPostHead } from '#/lib/seo'

export const Route = createFileRoute('/blog/$slug')({
	loader: async ({ context, params }) => {
		try {
			const post = await context.queryClient.query(
				context.orpc.blog.getBySlug.queryOptions({
					input: { params: { slug: params.slug } },
					retry: false,
					staleTime: 30_000,
				})
			)
			return {
				title: post.title,
				slug: post.slug,
				description: post.description,
				publishedAt: post.publishedAt,
				tags: post.tags,
				author: post.author,
				cover: post.cover,
			}
		} catch (error) {
			if (
				error instanceof ORPCError &&
				(error.code === 'NOT_FOUND' || error.code === 'BAD_REQUEST')
			) {
				notFound({ throw: true })
			}
			throw error
		}
	},
	head: ({ loaderData }) => blogPostHead(loaderData),
	headers: () => ({ 'Cache-Control': 'no-store' }),
	pendingComponent: BlogPending,
	notFoundComponent: BlogNotFound,
	errorComponent: BlogError,
	component: BlogDetailPage,
})

function BlogDetailPage() {
	const { slug } = Route.useParams()
	const { orpc } = Route.useRouteContext()
	const { data: post } = useSuspenseQuery(
		orpc.blog.getBySlug.queryOptions({
			input: { params: { slug } },
			retry: false,
			staleTime: 30_000,
		})
	)
	const {
		data: posts,
		isPending: navigationPending,
		isFetching: navigationFetching,
		refetch: refetchNavigation,
	} = useQuery(
		orpc.blog.list.queryOptions({ input: {}, retry: false, staleTime: 30_000 })
	)
	const [readingTop, setReadingTop] = useState<number>()
	const attachPostHeader = useCallback((header: HTMLElement | null) => {
		if (!header) return
		const measure = () =>
			setReadingTop(header.getBoundingClientRect().bottom + window.scrollY)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(header)
		return () => observer.disconnect()
	}, [])
	useBlogUpdates(post.cover.src.commit)
	const postIndex = posts?.findIndex((item) => item.slug === slug) ?? -1
	const previous = postIndex > 0 ? posts?.[postIndex - 1] : undefined
	const next = postIndex >= 0 ? posts?.[postIndex + 1] : undefined
	useBlogNavigation(previous, next)
	const tocItems = useMemo(
		() =>
			articleHeadings(post.body).map(({ id, title, depth }) => ({
				title,
				depth,
				url: `#${id}`,
			})),
		[post.body]
	)

	return (
		<main
			id="main-content"
			data-rails-ready={readingTop !== undefined}
			className="overflow-x-clip pt-14"
			style={
				{
					'--post-reading-top':
						readingTop === undefined ? undefined : `${readingTop}px`,
				} as CSSProperties
			}
		>
			<div
				data-slot="post-layout"
				className="mx-auto grid w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]"
			>
				<aside
					aria-label="Blog posts sidebar"
					className="relative z-10 col-start-1 row-start-1 min-w-0 pt-12 pb-4 pl-1 max-xl:hidden"
				>
					<BlogPostSidebar
						posts={posts}
						slug={slug}
						loading={navigationPending}
						refreshing={navigationFetching}
						onRetry={() => {
							void refetchNavigation()
						}}
					/>
				</aside>
				<div className="col-start-1 row-start-1 mx-auto w-full max-w-3xl min-w-0 lg:col-start-2">
					<div className="relative isolate border-x border-line">
						<div className="h-12" aria-hidden="true" />
						<article aria-labelledby="post-title">
							<header ref={attachPostHeader}>
								<div className="screen-line-bottom h-px" aria-hidden="true" />
								<BlogPostToolbar
									key={post.slug}
									post={post}
									previous={previous}
									next={next}
									loading={navigationPending}
								/>
								<div
									className="screen-line-bottom screen-line-top py-px"
									aria-hidden="true"
								>
									<div className="h-4" />
								</div>
								<h1
									id="post-title"
									className="screen-line-bottom px-4 text-4xl font-medium tracking-tight text-balance wrap-anywhere"
								>
									{post.title}
								</h1>
							</header>
							<div data-slot="post-reading" className="relative px-4 pt-8 pb-5">
								<p className="mb-5 text-base/7 wrap-anywhere text-muted-foreground">
									{post.description}
								</p>
								<div data-slot="post-cover" className="mb-6 aspect-video">
									<ContentImage
										src={getPostAssetUrl(post.cover.src)}
										alt={post.cover.alt}
										assets={post.assets}
										loading="eager"
										fetchPriority="high"
										width={1200}
										height={675}
										className="aspect-video w-full rounded-xl"
									/>
								</div>
								{tocItems.length > 0 && (
									<div
										data-slot="toc-rail"
										className="mb-4 flex justify-end lg:pointer-events-none lg:absolute lg:inset-x-[calc((100%-100vw)/2)] lg:top-3 lg:bottom-0 lg:mb-0 lg:items-start lg:opacity-0 in-data-[rails-ready=true]:lg:opacity-100"
									>
										<TOCMinimap
											key={post.slug}
											items={tocItems}
											className="pointer-events-auto self-start lg:sticky lg:translate-x-1"
											style={{
												top: 'calc(var(--post-reading-top, 0px) + 0.75rem)',
											}}
											maxHeight={`max(0px, calc(100dvh - ${readingTop ?? 0}px - 6rem))`}
										/>
									</div>
								)}
								<MarkdownRenderer
									className="typeset typeset-docs max-w-[37em]"
									slug={post.slug}
									content={post.body}
									assets={post.assets}
									prepared={post.prepared}
								/>
							</div>
							<div className="screen-line-top h-4" aria-hidden="true" />
						</article>
					</div>
				</div>
			</div>
			<div
				className="screen-line-bottom screen-line-top relative isolate mx-auto w-full max-w-3xl border-x border-line"
				aria-hidden="true"
				data-slot="article-end"
			>
				<div className="stripe-divider h-12" />
			</div>
		</main>
	)
}
