import '@tanstack/react-start/server-only'
import { ImageResponse } from '@vercel/og'

import type { PostMetadata } from '#/lib/blog'
import {
	BlogSourceError,
	getPostBySlug,
	PostNotFoundError,
} from '#/lib/blog.server'
import { OgCard, ogSize } from '#/lib/og/card'
import { site } from '#/lib/site'

const renderedImages = new Map<
	string,
	{ image: Promise<ArrayBuffer>; expiresAt: number }
>()
let activeRenders = 0

export async function handleOgRequest(
	request: Request,
	slug?: string
): Promise<Response> {
	const headers = new Headers({
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
	})
	function errorResponse(message: string, status: number) {
		headers.set('X-Robots-Tag', 'noindex')
		return new Response(request.method === 'HEAD' ? null : message, {
			status,
			headers,
		})
	}
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		headers.set('Allow', 'GET, HEAD')
		return errorResponse('Method not allowed', 405)
	}
	let post: PostMetadata | undefined
	try {
		if (slug !== undefined) post = await getPostBySlug(slug)
	} catch (error) {
		if (error instanceof PostNotFoundError) {
			return errorResponse('Not found', 404)
		}
		const status =
			error instanceof BlogSourceError && error.kind !== 'configuration'
				? error.kind === 'rate-limit'
					? 503
					: 502
				: 500
		return errorResponse('Image temporarily unavailable', status)
	}
	if (request.method === 'HEAD') {
		headers.set('Content-Type', 'image/png')
		return new Response(null, { headers })
	}
	try {
		// Publication is checked above on every request, including cache hits.
		const key = JSON.stringify([
			site.origin,
			post?.slug,
			post?.title ?? site.name,
			post?.description ?? site.description,
			post?.author.name,
			post?.publishedAt,
		])
		let entry = renderedImages.get(key)
		if (entry && entry.expiresAt <= Date.now()) {
			renderedImages.delete(key)
			entry = undefined
		}
		if (!entry) {
			if (activeRenders >= 2) {
				headers.set('Retry-After', '5')
				return errorResponse('Image temporarily unavailable', 503)
			}
			if (renderedImages.size >= 16) {
				const oldest = renderedImages.keys().next().value
				if (oldest !== undefined) renderedImages.delete(oldest)
			}
			activeRenders++
			const image = (async () => {
				const response = new ImageResponse(<OgCard post={post} />, {
					...ogSize,
					headers,
				})
				// Consume the stream so a failed render returns a failed HTTP response.
				return response.arrayBuffer()
			})().finally(() => {
				activeRenders--
			})
			entry = { image, expiresAt: Date.now() + 60_000 }
			renderedImages.set(key, entry)
			image.catch(() => {
				if (renderedImages.get(key)?.image === image) renderedImages.delete(key)
			})
		}
		const bytes = await entry.image
		headers.set('Content-Type', 'image/png')
		return new Response(bytes, { headers })
	} catch (error) {
		console.error('Open Graph image rendering failed', error)
		headers.set('Retry-After', '30')
		return errorResponse('Image temporarily unavailable', 503)
	}
}
