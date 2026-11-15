import { getPostAssetUrl, resolvePostAsset } from '#/lib/blog'
import type { BlogPost } from '#/lib/blog'

export function markdownAssetUrl(
	reference: string,
	assets: BlogPost['assets']
) {
	try {
		// Markdown serializes spaces and Unicode as escapes before calling renderers.
		// Decode once, then apply the same path and inventory checks as other assets.
		const asset = resolvePostAsset({ assets }, decodeURIComponent(reference))
		return asset ? getPostAssetUrl(asset) : undefined
	} catch {
		return undefined
	}
}
