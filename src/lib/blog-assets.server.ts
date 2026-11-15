import '@tanstack/react-start/server-only'
import {
	AssetNotFoundError,
	BlogAssetTooLargeError,
	BlogSourceError,
	getPostAsset,
	PostNotFoundError,
} from '#/lib/blog.server'

export async function handleBlogAssetRequest(
	request: Request,
	slug: string,
	path: string
): Promise<Response> {
	const headers = new Headers({
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
		'Cross-Origin-Resource-Policy': 'same-origin',
		// Also isolates an SVG when its URL is opened as a document.
		'Content-Security-Policy':
			"default-src 'none'; style-src 'unsafe-inline'; sandbox",
	})
	function failure(status: number, message: string) {
		headers.set('Content-Type', 'text/plain; charset=utf-8')
		return new Response(request.method === 'HEAD' ? null : message, {
			status,
			headers,
		})
	}
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		headers.set('Allow', 'GET, HEAD')
		return failure(405, 'Method not allowed')
	}
	try {
		const asset = await getPostAsset(slug, path)
		headers.set('Content-Type', asset.contentType)
		headers.set('Content-Length', String(asset.bytes.byteLength))
		return new Response(request.method === 'HEAD' ? null : asset.bytes, {
			headers,
		})
	} catch (error) {
		if (
			error instanceof AssetNotFoundError ||
			error instanceof PostNotFoundError
		) {
			return failure(404, 'Not found')
		}
		if (error instanceof BlogAssetTooLargeError) {
			return failure(413, 'Asset too large')
		}
		if (error instanceof BlogSourceError) {
			if (error.kind === 'rate-limit') {
				return failure(503, 'Asset temporarily unavailable')
			}
			if (error.kind !== 'configuration') {
				return failure(502, 'Asset temporarily unavailable')
			}
		}
		return failure(500, 'Asset temporarily unavailable')
	}
}
