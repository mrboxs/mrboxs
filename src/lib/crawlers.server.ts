import '@tanstack/react-start/server-only'
import { about } from '#/data/about'
import { projects } from '#/data/projects'
import { getPostAssetUrl, getPostMarkdown } from '#/lib/blog'
import type { PostMetadata } from '#/lib/blog'
import { BlogSourceError, getPostBySlug, listPosts } from '#/lib/blog.server'
import { postPath, publicUrl, site } from '#/lib/site'

export type CrawlerDocument = 'robots' | 'sitemap' | 'llms' | 'llms-full'

function xml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;')
}

function markdownLabel(value: string): string {
	return value.replace(/\s+/g, ' ').replace(/[\\[\]]/g, '\\$&')
}

export function sitemap(posts: Array<PostMetadata>): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${xml(publicUrl('/'))}</loc></url>
<url><loc>${xml(publicUrl('/blog'))}</loc></url>
${posts
	.map((post) => {
		const cover = getPostAssetUrl(post.cover.src)
		return `<url><loc>${xml(publicUrl(postPath(post.slug)))}</loc>${cover ? `<image:image><image:loc>${xml(publicUrl(cover))}</image:loc></image:image>` : ''}</url>`
	})
	.join('\n')}
</urlset>`
}

function siteSummary(): string {
	return `# ${site.name}

> ${site.description}

${site.name}'s personal portfolio and blog. The portfolio covers web development, creative work, and things learned along the way.

## About

${about.paragraphs.join('\n\n')}

${about.closing}

## Projects

${projects.map((project) => `- [${markdownLabel(project.title)}](${project.link}): ${project.description}`).join('\n')}

## Links

- [Portfolio](${publicUrl('/')})
- [Blog](${publicUrl('/blog')}): ${site.blogDescription}
${site.socials.map((url) => `- ${url}`).join('\n')}`
}

export function llmsIndex(posts: Array<PostMetadata>): string {
	return `${siteSummary()}

## Blog posts

${posts.map((post) => `- [${markdownLabel(post.title)}](${publicUrl(`${postPath(post.slug)}.md`)}): ${post.description.replace(/\s+/g, ' ')} Published ${post.publishedAt}. Written by ${markdownLabel(post.author.name)}.`).join('\n') || 'No published posts yet.'}

## Optional

- [Full text](${publicUrl('/llms-full.txt')}): Portfolio information and the full text of currently published posts.
- [Sitemap](${publicUrl('/sitemap.xml')}): Canonical public page URLs.
`
}

export async function handleCrawlerRequest(
	request: Request,
	document: CrawlerDocument
): Promise<Response> {
	const headers = new Headers({
		'Cache-Control': 'no-store',
		'Content-Type':
			document === 'sitemap'
				? 'application/xml; charset=utf-8'
				: 'text/plain; charset=utf-8',
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
	if (document === 'robots') {
		return respond(
			`User-agent: *\nAllow: /\nDisallow: /api/rpc\nDisallow: /api/blog/updates\nDisallow: /api/blog/webhook\nDisallow: /__debug\n\nSitemap: ${publicUrl('/sitemap.xml')}\n`
		)
	}
	try {
		const posts = await listPosts()
		if (document === 'sitemap') return respond(sitemap(posts))
		if (document === 'llms') return respond(llmsIndex(posts))
		const articles = await Promise.all(
			posts.map(async (metadata) => {
				const post = await getPostBySlug(metadata.slug)
				return `Source: ${publicUrl(postPath(post.slug))}\nPublished: ${post.publishedAt}\nAuthor: ${post.author.name} (${post.author.url})\n\n${getPostMarkdown(post)}`
			})
		)
		return respond(
			`${siteSummary()}\n\n## Published articles\n\n${articles.join('\n\n---\n\n') || 'No published posts yet.'}\n`
		)
	} catch (error) {
		const status =
			error instanceof BlogSourceError && error.kind === 'configuration'
				? 500
				: 503
		headers.set('X-Robots-Tag', 'noindex')
		headers.set('Retry-After', '60')
		return respond('Site information temporarily unavailable', status)
	}
}
