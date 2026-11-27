import { queryOptions, useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { useState } from 'react'

import { IconWorld } from '@tabler/icons-react'
import { cn } from 'cn'
import { z } from 'zod'

import favicon from '#/assets/mrboxs-symbol.svg?url'
import { Skeleton } from '#/components/ui/skeleton'
import { postOgPath, postPath, site } from '#/lib/site'

const assetSchema = z.object({ url: z.string().nullish() }).nullish()
const metadataSchema = z.object({
	status: z.literal('success'),
	data: z.object({
		title: z.string().nullish(),
		description: z.string().nullish(),
		image: assetSchema,
		logo: assetSchema,
	}),
})

export function canPreviewExternal(url: URL) {
	return (
		(url.protocol === 'https:' || url.protocol === 'http:') &&
		!url.username &&
		!url.password &&
		!url.port &&
		/\.[a-z][a-z\d-]*$/i.test(url.hostname) &&
		!/\.(?:localhost|local|internal|test|invalid|example|onion|lan|home|arpa)$/i.test(
			url.hostname
		)
	)
}

function publicImage(value?: string | null) {
	if (!value) return undefined
	try {
		const url = new URL(value)
		if (url.protocol === 'https:' && canPreviewExternal(url)) return url.href
	} catch {
		return undefined
	}
}

async function getExternalPreview(url: string) {
	const endpoint = new URL('https://api.microlink.io')
	endpoint.searchParams.set('url', url)
	const response = await fetch(endpoint, {
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
		signal: AbortSignal.timeout(6000),
	})
	if (!response.ok) throw new Error('Link preview unavailable')
	const { data } = metadataSchema.parse(await response.json())
	const title = data.title?.trim().slice(0, 200)
	return {
		title: title?.length ? title : undefined,
		description: data.description?.trim().slice(0, 400),
		logo: publicImage(data.logo?.url),
		image: publicImage(data.image?.url),
	}
}

export function ExternalLinkPreview({ url }: { url: URL }) {
	const target = url.origin + url.pathname
	const { data, isPending } = useQuery(
		queryOptions({
			queryKey: ['markdown-link-preview', target],
			queryFn: () => getExternalPreview(target),
			staleTime: 1000 * 60 * 30,
			retry: false,
			retryOnMount: false,
			refetchOnWindowFocus: false,
		})
	)
	return <PreviewCardBody domain={url.hostname} pending={isPending} {...data} />
}

export function InternalLinkPreview({ url }: { url: URL }) {
	const { orpc } = useRouter().options.context
	const isArticle =
		url.pathname.startsWith('/blog/') && url.pathname !== '/blog/'
	const { data, isPending } = useQuery(
		orpc.blog.list.queryOptions({
			input: {},
			enabled: isArticle,
			staleTime: 30_000,
			retry: false,
		})
	)
	const post = data?.find(
		(item) => postPath(item.slug) === url.pathname.replace(/\/$/, '')
	)
	const isBlog = url.pathname === '/blog' || url.pathname === '/blog/'
	return (
		<PreviewCardBody
			domain={url.hostname}
			title={post?.title ?? (isBlog ? `Blog | ${site.name}` : site.name)}
			description={
				post?.description ?? (isBlog ? site.blogDescription : site.description)
			}
			image={
				post ? postOgPath(post.slug, post.cover.src.commit) : '/og/default.png'
			}
			logo={favicon}
			pending={isArticle && isPending}
		/>
	)
}

function PreviewCardBody({
	domain,
	title,
	description,
	image,
	logo,
	pending,
}: {
	domain: string
	title?: string
	description?: string
	image?: string
	logo?: string
	pending?: boolean
}) {
	const [failedImage, setFailedImage] = useState<string>()
	const [failedLogo, setFailedLogo] = useState<string>()
	const showBanner = !!image && failedImage !== image

	return (
		<div className="overflow-hidden rounded-lg" aria-busy={pending}>
			{showBanner ? (
				<img
					src={image}
					alt=""
					referrerPolicy="no-referrer"
					className="aspect-video w-full bg-muted object-cover"
					onError={() => setFailedImage(image)}
				/>
			) : pending ? (
				<Skeleton className="aspect-video w-full rounded-none" />
			) : null}
			<div className="relative px-3 pt-3 pb-3.5">
				<div
					className={cn(
						'mb-2 grid size-10 place-items-center rounded-full border border-border bg-popover',
						(showBanner || pending) && '-mt-8'
					)}
				>
					{logo && failedLogo !== logo ? (
						<img
							src={logo}
							alt=""
							width={24}
							height={24}
							referrerPolicy="no-referrer"
							className={cn(
								'size-6 rounded-sm object-contain',
								logo === favicon && 'dark:invert'
							)}
							onError={() => setFailedLogo(logo)}
						/>
					) : (
						<IconWorld
							className="size-5 text-muted-foreground"
							aria-hidden="true"
						/>
					)}
				</div>
				<p className="line-clamp-2 font-medium wrap-anywhere">
					{title ?? domain}
				</p>
				{title && (
					<p className="truncate text-xs text-muted-foreground">{domain}</p>
				)}
				{description && (
					<p className="mt-2 line-clamp-3 wrap-anywhere text-muted-foreground">
						{description}
					</p>
				)}
			</div>
		</div>
	)
}
