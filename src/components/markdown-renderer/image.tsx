import { useRef, useState } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from 'cn'

import {
	Lightbox,
	LightboxCaption,
	LightboxClose,
	LightboxContent,
	LightboxFooter,
	LightboxHeader,
	LightboxItem,
	LightboxMedia,
	LightboxSlide,
	LightboxSlides,
	LightboxTrigger,
	LightboxZoom,
	LightboxZoomIn,
	LightboxZoomOut,
} from '#/components/custom/lightbox'
import { markdownAssetUrl } from '#/components/markdown-renderer/asset'
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
	const image = (imageRef?: (node: HTMLImageElement | null) => void) => (
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
				imageRef?.(element)
				if (element?.complete) {
					void element.decode().catch(() => setFailedSource(src))
				}
			}}
			onError={() => setFailedSource(src)}
		/>
	)
	return preview ? (
		<ImagePreview
			key={src}
			src={src}
			alt={alt}
			title={title}
			width={width}
			height={height}
		>
			{image}
		</ImagePreview>
	) : (
		image()
	)
}

function ImagePreview({
	src,
	alt,
	title,
	width,
	height,
	children,
}: {
	src: string
	alt: string
	title?: string
	children: (imageRef: (node: HTMLImageElement | null) => void) => ReactNode
} & Pick<ComponentPropsWithoutRef<'img'>, 'width' | 'height'>) {
	const [failed, setFailed] = useState(false)
	const [dimensions, setDimensions] = useState<{
		width: number
		height: number
	}>()
	const thumbnailRef = useRef<HTMLImageElement | null>(null)
	const label = title?.trim() ? title : alt.trim() ? alt : 'Article image'
	return (
		<Lightbox
			onOpenChange={(open) => {
				if (open) {
					setFailed(false)
					const thumbnail = thumbnailRef.current
					if (thumbnail?.naturalWidth && thumbnail.naturalHeight) {
						setDimensions({
							width: thumbnail.naturalWidth,
							height: thumbnail.naturalHeight,
						})
					}
				}
			}}
		>
			<LightboxTrigger
				index={0}
				type="button"
				aria-label={`Enlarge image: ${label}`}
				className="not-prose mx-auto block w-fit max-w-full cursor-zoom-in rounded-sm align-middle transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"
			>
				{({ imageRef }) =>
					children((element) => {
						imageRef(element)
						thumbnailRef.current = element
					})
				}
			</LightboxTrigger>
			<LightboxContent aria-label={label} className="not-prose">
				<LightboxSlides>
					<LightboxSlide>
						<LightboxItem index={0} caption={label} aria-label="Image 1 of 1">
							{failed ? (
								<div className="flex h-full items-center justify-center px-4 text-center">
									<output>
										{alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
									</output>
								</div>
							) : (
								<LightboxZoom maxZoom={4} scrollToZoom>
									<LightboxMedia
										width={dimensions?.width ?? (Number(width) || undefined)}
										height={dimensions?.height ?? (Number(height) || undefined)}
									>
										<img
											src={src}
											alt={alt}
											title={title}
											width={dimensions?.width ?? width}
											height={dimensions?.height ?? height}
											decoding="async"
											draggable={false}
											className="object-contain"
											onLoad={({ currentTarget }) => {
												if (
													currentTarget.naturalWidth &&
													currentTarget.naturalHeight
												) {
													setDimensions({
														width: currentTarget.naturalWidth,
														height: currentTarget.naturalHeight,
													})
												}
											}}
											onError={() => setFailed(true)}
										/>
									</LightboxMedia>
								</LightboxZoom>
							)}
						</LightboxItem>
					</LightboxSlide>
				</LightboxSlides>
				<LightboxHeader className="*:size-11 md:*:size-8">
					<LightboxZoomOut />
					<LightboxZoomIn />
					<LightboxClose />
				</LightboxHeader>
				<LightboxFooter>
					<LightboxCaption />
				</LightboxFooter>
			</LightboxContent>
		</Lightbox>
	)
}
