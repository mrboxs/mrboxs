import { Link } from '@tanstack/react-router'

import { ContentImage } from '#/components/markdown-renderer/image'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '#/components/ui/card'
import { getPostAssetUrl } from '#/lib/blog'
import type { PostMetadata } from '#/lib/blog'

const dateFormat = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
})

export function BlogPostCard({
	post,
	eager = false,
	priority = false,
}: {
	post: PostMetadata
	eager?: boolean
	priority?: boolean
}) {
	return (
		<Card variant="ghost" className="relative h-full gap-2 p-2">
			<CardContent className="px-0">
				<div className="relative flex aspect-1200/630 items-center justify-center overflow-hidden rounded-xl wrap-anywhere select-none">
					<ContentImage
						src={getPostAssetUrl(post.cover.src)}
						alt={post.cover.alt}
						assets={{}}
						preview={false}
						loading={eager ? 'eager' : 'lazy'}
						fetchPriority={priority ? 'high' : undefined}
						width={1200}
						height={630}
						className="h-full w-full object-cover grayscale transition-[filter] duration-300 group-focus-within/card:grayscale-0 group-hover/card:grayscale-0 motion-reduce:transition-none"
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 rounded-xl inset-ring-1 inset-ring-foreground/15"
					/>
				</div>
			</CardContent>
			<CardHeader className="gap-1 p-2">
				<CardTitle>
					<h2 className="text-lg/snug font-medium text-balance wrap-anywhere">
						<Link
							to="/blog/$slug"
							params={{ slug: post.slug }}
							className="group/link cursor-pointer outline-none"
						>
							<span
								aria-hidden="true"
								className="absolute inset-0 rounded-sm group-focus-visible/link:outline-2 group-focus-visible/link:-outline-offset-2 group-focus-visible/link:outline-foreground"
							/>
							{post.title}
						</Link>
					</h2>
				</CardTitle>
				<CardDescription>
					<time dateTime={post.publishedAt}>
						{dateFormat.format(new Date(post.publishedAt))}
					</time>
				</CardDescription>
			</CardHeader>
		</Card>
	)
}
