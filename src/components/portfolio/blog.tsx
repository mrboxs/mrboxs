import { useQuery } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'

import { IconArrowRight } from '@tabler/icons-react'
import { cn } from 'cn'

import { BlogPostCard } from '#/components/blog/blog-post-card'
import { Button, buttonVariants } from '#/components/ui/button'
import { useBlogUpdates } from '#/hooks/use-blog-updates'
import type { PostMetadata } from '#/lib/blog'

function LatestPosts({ posts }: { posts: Array<PostMetadata> }) {
	useBlogUpdates(posts[0]?.cover.src.commit)

	return (
		<div className="relative -mx-px py-4">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-1 grid grid-cols-2 gap-4 max-sm:hidden"
			>
				<div className="border-r border-line" />
				<div className="border-l border-line" />
			</div>
			<ul
				aria-label="Latest blog posts"
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
			>
				{posts.slice(0, 4).map((post) => (
					<li
						key={post.slug}
						className="max-sm:screen-line-bottom max-sm:screen-line-top sm:nth-[2n+1]:screen-line-bottom sm:nth-[2n+1]:screen-line-top"
					>
						<BlogPostCard post={post} headingAs="h3" />
					</li>
				))}
				{posts.length === 0 && (
					<li className="screen-line-bottom screen-line-top col-span-full p-4">
						<p className="font-mono text-sm">
							Belum ada tulisan yang dipublikasikan.
						</p>
					</li>
				)}
			</ul>
		</div>
	)
}

export function Blog() {
	const { orpc } = useRouter().options.context
	const {
		data: posts,
		isPending,
		isFetching,
		refetch,
	} = useQuery(
		orpc.blog.list.queryOptions({ input: {}, retry: false, staleTime: 30_000 })
	)

	return (
		<section
			id="blog"
			aria-labelledby="blog-title"
			aria-busy={isPending}
			className="screen-line-bottom screen-line-top relative isolate scroll-mt-14 border-x border-line"
		>
			<header className="screen-line-bottom px-4">
				<h2
					id="blog-title"
					className="font-heading text-3xl font-medium tracking-tight text-balance"
				>
					Blog
					{posts !== undefined && (
						<sup className="top-[-0.75em] ml-1 text-sm font-medium tracking-normal text-muted-foreground">
							({posts.length})
						</sup>
					)}
				</h2>
			</header>
			{posts !== undefined ? (
				<LatestPosts posts={posts} />
			) : isPending ? (
				<div className="p-4">
					<output className="font-mono text-sm text-muted-foreground">
						Memuat tulisan…
					</output>
				</div>
			) : (
				<div className="flex flex-col items-start gap-3 p-4">
					<p role="alert" className="text-sm text-muted-foreground">
						Tulisan belum bisa dimuat.
					</p>
					<Button
						variant="secondary"
						size="sm"
						className="min-h-11 md:pointer-fine:min-h-7"
						disabled={isFetching}
						onClick={() => void refetch()}
					>
						{isFetching ? 'Memuat…' : 'Coba lagi'}
					</Button>
				</div>
			)}
			<div className="screen-line-top flex justify-center py-4">
				<Link
					to="/blog"
					className={cn(
						buttonVariants({ variant: 'secondary' }),
						'min-h-11 gap-2 pr-2.5 pl-3 shadow-[inset_0_0_1px] shadow-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground focus-visible:outline-solid has-data-[icon=inline-end]:pr-2.5 motion-reduce:transition-none md:pointer-fine:min-h-8'
					)}
				>
					All posts
					<IconArrowRight data-icon="inline-end" aria-hidden="true" />
				</Link>
			</div>
		</section>
	)
}
