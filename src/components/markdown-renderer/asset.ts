import { getPostAssetUrl, resolvePostAsset } from '#/lib/blog'
import type { BlogPost } from '#/lib/blog'

export function markdownAssetUrl(
	reference: string,
	assets: BlogPost['assets']
) {
	try {
		const suffixStart = reference.search(/[?#]/)
		const path =
			suffixStart === -1 ? reference : reference.slice(0, suffixStart)
		const suffix = suffixStart === -1 ? '' : reference.slice(suffixStart)
		// Markdown serializes spaces and Unicode as escapes before calling renderers.
		// Decode once, then apply the same path and inventory checks as other assets.
		const asset = resolvePostAsset({ assets }, decodeURIComponent(path))
		const url = asset && getPostAssetUrl(asset)
		return url ? `${url}${suffix}` : undefined
	} catch {
		return undefined
	}
}
