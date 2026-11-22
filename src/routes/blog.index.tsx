import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { useRef, useState } from 'react'

import { IconSearch, IconX } from '@tabler/icons-react'

import { BlogError, BlogPending } from '#/components/blog/blog-feedback'
import { BlogPostCard } from '#/components/blog/blog-post-card'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '#/components/ui/input-group'
import { useBlogUpdates } from '#/hooks/use-blog-updates'
import { blogIndexHead } from '#/lib/seo'

const description = `Things I've built, tried, and figured out.`

export const Route = createFileRoute('/blog/')({
	loader: async ({ context }) => {
		return context.queryClient.query(
			context.orpc.blog.list.queryOptions({
				input: {},
				retry: false,
				staleTime: 30_000,
			})
		)
	},
	head: ({ loaderData }) => blogIndexHead(loaderData),
	headers: () => ({ 'Cache-Control': 'no-store' }),
	pendingComponent: BlogPending,
	errorComponent: BlogError,
	component: BlogListPage,
})

function BlogListPage() {
	const { orpc } = Route.useRouteContext()
	const { data: posts } = useSuspenseQuery(
		orpc.blog.list.queryOptions({ input: {}, retry: false, staleTime: 30_000 })
	)
	useBlogUpdates(posts[0]?.cover.src.commit)
	const [query, setQuery] = useState('')
	const input = useRef<HTMLInputElement>(null)
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
	const filteredPosts = posts.filter((post) => {
		const text =
			`${post.title} ${post.description} ${post.tags.join(' ')}`.toLowerCase()
		return terms.every((term) => text.includes(term))
	})

	function clearSearch() {
		setQuery('')
		input.current?.focus()
	}

	return (
		<main id="main-content" className="overflow-x-clip pt-14">
			<div className="mx-auto w-full max-w-3xl">
				<div className="relative isolate border-x border-line pt-12">
					<header>
						<p className="px-4 pb-2 text-sm/none font-medium tracking-wider text-muted-foreground">
							Blog
						</p>
						<h1 className="screen-line-bottom screen-line-top -translate-x-px px-4 text-4xl font-medium tracking-tight text-balance wrap-anywhere">
							{description}
						</h1>
					</header>
					<div className="h-4" aria-hidden="true" />
					<search
						aria-label="Blog"
						className="screen-line-bottom screen-line-top -mx-px p-2"
					>
						<label htmlFor="blog-search" className="sr-only">
							Search blog
						</label>
						<InputGroup className="h-12 shadow-none has-[[data-slot=input-group-control]:focus-visible]:outline-2 has-[[data-slot=input-group-control]:focus-visible]:outline-offset-2 has-[[data-slot=input-group-control]:focus-visible]:outline-foreground has-[[data-slot=input-group-control]:focus-visible]:outline-solid md:pointer-fine:h-9">
							<InputGroupInput
								ref={input}
								id="blog-search"
								type="search"
								placeholder="Search blog…"
								aria-controls="blog-post-list"
								autoComplete="off"
								spellCheck={false}
								value={query}
								className="h-12 md:pointer-fine:h-9 [&::-webkit-search-cancel-button]:hidden"
								onChange={(event) => setQuery(event.target.value)}
								onKeyDown={(event) => {
									if (
										event.key === 'Escape' &&
										!event.nativeEvent.isComposing
									) {
										event.preventDefault()
										clearSearch()
									}
								}}
							/>
							<InputGroupAddon align="inline-start">
								<label
									htmlFor="blog-search"
									aria-hidden="true"
									className="flex cursor-text items-center [&>svg]:size-4"
								>
									<IconSearch aria-hidden="true" />
								</label>
							</InputGroupAddon>
							{query.length > 0 && (
								<InputGroupAddon align="inline-end" className="py-0 pr-1">
									<InputGroupButton
										size="icon-xs"
										aria-label="Clear search"
										className="size-11 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground focus-visible:outline-solid md:pointer-fine:size-6"
										onClick={clearSearch}
									>
										<IconX aria-hidden="true" />
									</InputGroupButton>
								</InputGroupAddon>
							)}
						</InputGroup>
					</search>
					<output
						htmlFor="blog-search"
						aria-live="polite"
						aria-atomic="true"
						className="sr-only"
					>
						{filteredPosts.length} tulisan
						{terms.length > 0 ? ' ditemukan.' : ''}
					</output>
					<div className="relative -mx-px pt-4">
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 -z-1 grid grid-cols-2 gap-4 max-sm:hidden"
						>
							<div className="border-r border-line" />
							<div className="border-l border-line" />
						</div>
						<ul
							id="blog-post-list"
							aria-label="Blog posts"
							className="grid grid-cols-1 gap-4 sm:grid-cols-2"
						>
							{filteredPosts.map((post, index) => (
								<li
									key={post.slug}
									className="max-sm:screen-line-bottom max-sm:screen-line-top sm:nth-[2n+1]:screen-line-bottom sm:nth-[2n+1]:screen-line-top"
								>
									<BlogPostCard
										post={post}
										eager={index < 4}
										priority={index === 0}
									/>
								</li>
							))}
							{filteredPosts.length === 0 && (
								<li className="screen-line-bottom screen-line-top col-span-full p-4">
									<p className="font-mono text-sm">
										{posts.length === 0
											? 'Belum ada tulisan yang dipublikasikan.'
											: 'No posts found.'}
									</p>
								</li>
							)}
						</ul>
					</div>
					<div className="h-4" aria-hidden="true" />
				</div>
				<div
					data-slot="blog-list-end"
					aria-hidden="true"
					className="screen-line-bottom screen-line-top relative isolate border-x border-line"
				>
					<div className="stripe-divider h-12" />
				</div>
			</div>
		</main>
	)
}
