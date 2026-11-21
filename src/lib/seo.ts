import { profile } from '#/data/profile'
import { getPostAssetUrl } from '#/lib/blog'
import type { PostMetadata } from '#/lib/blog'
import { postOgPath, postPath, publicUrl, site } from '#/lib/site'

export function jsonLd(value: unknown): string {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003c')
		.replaceAll('>', '\\u003e')
		.replaceAll('&', '\\u0026')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029')
}

function siteGraph() {
	return [
		{
			'@type': 'Person',
			'@id': publicUrl('/#person'),
			name: site.name,
			url: publicUrl('/'),
			image: profile.avatar,
			description: site.description,
			sameAs: site.socials,
		},
		{
			'@type': 'WebSite',
			'@id': publicUrl('/#website'),
			url: publicUrl('/'),
			name: site.name,
			description: site.description,
			publisher: { '@id': publicUrl('/#person') },
			inLanguage: site.language,
		},
	]
}

export function seoHead(options: {
	title: string
	description: string
	path?: string
	image?: string
	imageAlt?: string
	type?: 'website' | 'article'
	noindex?: boolean
	entities?: Array<Record<string, unknown>>
}) {
	const image = publicUrl(options.image ?? '/og/default.png')
	const imageAlt = options.imageAlt ?? `${site.name}. ${site.description}`
	return {
		meta: [
			{ title: options.title },
			{ name: 'description', content: options.description },
			{ name: 'author', content: site.name },
			{
				name: 'robots',
				content: options.noindex
					? 'noindex, follow'
					: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
			},
			{ property: 'og:type', content: options.type ?? 'website' },
			{ property: 'og:site_name', content: site.name },
			{ property: 'og:locale', content: site.locale },
			{ property: 'og:title', content: options.title },
			{ property: 'og:description', content: options.description },
			...(options.path
				? [{ property: 'og:url', content: publicUrl(options.path) }]
				: []),
			{ property: 'og:image', content: image },
			{ property: 'og:image:type', content: 'image/png' },
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ property: 'og:image:alt', content: imageAlt },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:site', content: '@isntboxs' },
			{ name: 'twitter:creator', content: '@isntboxs' },
			{ name: 'twitter:title', content: options.title },
			{ name: 'twitter:description', content: options.description },
			{ name: 'twitter:image', content: image },
			{ name: 'twitter:image:alt', content: imageAlt },
		],
		links: options.path
			? [{ rel: 'canonical', href: publicUrl(options.path) }]
			: [],
		scripts: options.entities
			? [
					{
						type: 'application/ld+json',
						children: jsonLd({
							'@context': 'https://schema.org',
							'@graph': [...siteGraph(), ...options.entities],
						}),
					},
				]
			: [],
	}
}

export function unavailableHead() {
	return seoHead({
		title: `Page unavailable | ${site.name}`,
		description: `This page is unavailable. Visit ${site.name}'s portfolio and blog.`,
		noindex: true,
	})
}

export function homeHead() {
	return seoHead({
		title: `${site.name} | Portfolio`,
		description: site.description,
		path: '/',
		entities: [
			{
				'@type': 'ProfilePage',
				'@id': publicUrl('/#profile'),
				url: publicUrl('/'),
				name: `${site.name} | Portfolio`,
				description: site.description,
				mainEntity: { '@id': publicUrl('/#person') },
				isPartOf: { '@id': publicUrl('/#website') },
			},
		],
	})
}

export function blogIndexHead(posts?: Array<PostMetadata>) {
	if (!posts) return unavailableHead()
	return seoHead({
		title: `Blog | ${site.name}`,
		description: site.blogDescription,
		path: '/blog',
		entities: [
			{
				'@type': 'Blog',
				'@id': publicUrl('/blog#blog'),
				url: publicUrl('/blog'),
				name: `Blog | ${site.name}`,
				description: site.blogDescription,
				isPartOf: { '@id': publicUrl('/#website') },
				blogPost: posts.map((post) => ({
					'@type': 'BlogPosting',
					'@id': publicUrl(`${postPath(post.slug)}#article`),
					url: publicUrl(postPath(post.slug)),
					headline: post.title,
					datePublished: post.publishedAt,
					author: {
						'@type': 'Person',
						name: post.author.name,
						url: post.author.url,
					},
				})),
			},
		],
	})
}

export function blogPostHead(post?: PostMetadata) {
	if (!post) return unavailableHead()
	const path = postPath(post.slug)
	const image = postOgPath(post.slug, post.cover.src.commit)
	const coverPath = getPostAssetUrl(post.cover.src)
	const head = seoHead({
		title: `${post.title} | ${site.name}`,
		description: post.description,
		path,
		type: 'article',
		image,
		imageAlt: `${post.title}. ${post.description}`,
		entities: [
			{
				'@type': 'BlogPosting',
				'@id': publicUrl(`${path}#article`),
				url: publicUrl(path),
				headline: post.title,
				description: post.description,
				datePublished: post.publishedAt,
				image: coverPath
					? [publicUrl(coverPath), publicUrl(image)]
					: [publicUrl(image)],
				author: {
					'@type': 'Person',
					name: post.author.name,
					url: post.author.url,
				},
				publisher: { '@id': publicUrl('/#person') },
				mainEntityOfPage: publicUrl(path),
				isPartOf: { '@id': publicUrl('/blog#blog') },
				keywords: post.tags.join(', '),
			},
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{
						'@type': 'ListItem',
						position: 1,
						name: site.name,
						item: publicUrl('/'),
					},
					{
						'@type': 'ListItem',
						position: 2,
						name: 'Blog',
						item: publicUrl('/blog'),
					},
					{
						'@type': 'ListItem',
						position: 3,
						name: post.title,
						item: publicUrl(path),
					},
				],
			},
		],
	})
	return {
		...head,
		meta: [
			...head.meta.filter((meta) => meta.name !== 'author'),
			{ name: 'author', content: post.author.name },
			{ property: 'article:published_time', content: post.publishedAt },
			{ property: 'article:author', content: post.author.url },
		],
		links: [
			...head.links,
			{
				rel: 'alternate',
				type: 'text/plain',
				href: publicUrl(`${path}.md`),
				title: 'View as Markdown',
			},
		],
	}
}
