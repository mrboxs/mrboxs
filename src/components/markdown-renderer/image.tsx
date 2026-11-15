import { useState } from 'react'

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
}: {
	src?: string
	alt?: string
	title?: string
	assets: BlogPost['assets']
}) {
	const src = imageSource(reference, assets)
	const [failedSource, setFailedSource] = useState<string>()
	if (!src || failedSource === src) {
		return (
			<span className="text-muted-foreground">
				{alt ? `Image unavailable: ${alt}` : 'Image unavailable'}
			</span>
		)
	}
	return (
		<img
			src={src}
			alt={alt}
			title={title}
			loading="lazy"
			decoding="async"
			className="h-auto max-w-full object-contain"
			ref={(element) => {
				if (element?.complete) {
					void element.decode().catch(() => setFailedSource(src))
				}
			}}
			onError={() => setFailedSource(src)}
		/>
	)
}
