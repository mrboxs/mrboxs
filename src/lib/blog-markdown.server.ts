import '@tanstack/react-start/server-only'
import { getPostMarkdown } from '#/lib/blog'
import {
	BlogSourceError,
	getPostBySlug,
	PostNotFoundError,
} from '#/lib/blog.server'
import { postPath, publicUrl } from '#/lib/site'

export async function handleBlogMarkdownRequest(
	request: Request,
	slug: string
): Promise<Response> {
	const headers = new Headers({
		'Cache-Control': 'no-store',
		'Content-Type': 'text/plain; charset=utf-8',
		'X-Content-Type-Options': 'nosniff',
		'Content-Security-Policy': "default-src 'none'; sandbox",
	})
	function respond(body: string, status = 200) {
		return new Response(request.method === 'HEAD' ? null : body, {
			status,
			headers,
		})
	}
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		headers.set('Allow', 'GET, HEAD')
		return respond('Method not allowed', 405)
	}
	try {
		const post = await getPostBySlug(slug)
		headers.set('Link', `<${publicUrl(postPath(post.slug))}>; rel="canonical"`)
		return respond(getPostMarkdown(post))
	} catch (error) {
		if (error instanceof PostNotFoundError) return respond('Not found', 404)
		if (error instanceof BlogSourceError) {
			if (error.kind === 'rate-limit') {
				return respond('Article temporarily unavailable', 503)
			}
			if (error.kind !== 'configuration') {
				return respond('Article temporarily unavailable', 502)
			}
		}
		return respond('Article temporarily unavailable', 500)
	}
}
