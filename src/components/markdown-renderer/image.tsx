import { useState } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from 'cn'

import { markdownAssetUrl } from '#/components/markdown-renderer/asset'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '#/components/ui/dialog'
import type { BlogPost } from '#/lib/blog'

function imageSource(src: string | undefined, assets: BlogPost['assets']) {
	if (!src) return undefined
	const assetUrl = markdownAssetUrl(src, assets)
	if (assetUrl) return assetUrl
	if (src.startsWith('/')) return src
	try {
		const url = new URL(src)
		if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
	} catch {
		return undefined
	}
	return undefined
}

export function ContentImage({
	src: reference,
	alt = '',
	title,
	assets,
	preview = true,
	loading = 'lazy',
	fetchPriority,
	width,
	height,
	className,
}: {
	src?: string
	alt?: string
	title?: string
	assets: BlogPost['assets']
	preview?: boolean
} & Pick<
	ComponentPropsWithoutRef<'img'>,
	'loading' | 'fetchPriority' | 'width' | 'height' | 'className'
>) {
	const src = imageSource(reference, assets)
	const [failedSource, setFailedSource] = useState<string>()
	if (!src || failedSource === src) {
		return (
			<span className="text-muted-foreground">
				{alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
			</span>
		)
	}
	const image = (
		<img
			src={src}
			alt={alt}
			title={title}
			loading={loading}
			fetchPriority={fetchPriority}
			width={width}
			height={height}
			decoding="async"
			className={cn('mx-auto h-auto max-w-full object-contain', className)}
			ref={(element) => {
				if (element?.complete) {
					void element.decode().catch(() => setFailedSource(src))
				}
			}}
			onError={() => setFailedSource(src)}
		/>
	)
	return preview ? (
		<ImagePreview key={src} src={src} alt={alt} title={title}>
			{image}
		</ImagePreview>
	) : (
		image
	)
}

function ImagePreview({
	src,
	alt,
	title,
	children,
}: {
	src: string
	alt: string
	title?: string
	children: ReactNode
}) {
	const [failed, setFailed] = useState(false)
	const label = title?.trim() ? title : alt.trim() ? alt : 'Article image'
	return (
		<Dialog
			onOpenChange={(open) => {
				if (open) setFailed(false)
			}}
		>
			<DialogTrigger
				type="button"
				aria-label={`Enlarge image: ${label}`}
				className="not-prose mx-auto block w-fit max-w-full cursor-zoom-in rounded-sm align-middle transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"
			>
				{children}
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
				<DialogHeader className="pr-8">
					<DialogTitle>{label}</DialogTitle>
					<DialogDescription className="sr-only">
						Full-size image preview.
					</DialogDescription>
				</DialogHeader>
				{failed ? (
					<output>
						{alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
					</output>
				) : (
					<img
						src={src}
						alt={alt}
						decoding="async"
						className="mx-auto h-auto max-h-[calc(100dvh-10rem)] max-w-full object-contain"
						onError={() => setFailed(true)}
					/>
				)}
			</DialogContent>
		</Dialog>
	)
}
