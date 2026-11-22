import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { z } from 'zod'

import {
	blogIndexHead,
	blogPostHead,
	homeHead,
	jsonLd,
	unavailableHead,
} from '#/lib/seo'
import { publicUrl, site } from '#/lib/site'

import { blogMetadata } from '../helpers/blog'

const urls = vi.hoisted(() => ({
	APP_URL: 'https://portfolio.example.test',
	VITE_APP_URL: 'https://portfolio.example.test',
}))
vi.mock('void/env', () => ({ env: urls }))

afterEach(() => {
	urls.APP_URL = 'https://portfolio.example.test'
	urls.VITE_APP_URL = 'https://portfolio.example.test'
})

function parseGraph(value: string): Array<Record<string, unknown>> {
	const parsed: unknown = JSON.parse(value)
	return z
		.object({ '@graph': z.array(z.record(z.string(), z.unknown())) })
		.parse(parsed)['@graph']
}

describe('page metadata', () => {
	it('uses the configured origin and the existing profile for home previews', () => {
		const head = homeHead()
		expect(head.links).toContainEqual({
			rel: 'canonical',
			href: 'https://portfolio.example.test/',
		})
		expect(head.meta).toEqual(
			expect.arrayContaining([
				{ title: "MrBoxs | Things I've built, tried, and figured out." },
				{ name: 'description', content: site.description },
				{ property: 'og:image', content: publicUrl('/og/default.png') },
				{ property: 'og:image:width', content: '1200' },
				{ property: 'og:image:height', content: '630' },
				{ name: 'twitter:card', content: 'summary_large_image' },
				{ name: 'twitter:url', content: publicUrl('/') },
			])
		)
		const graph = parseGraph(head.scripts[0].children)
		const person = graph.find(
			(entity: Record<string, unknown>) => entity['@type'] === 'Person'
		)
		expect(person).toMatchObject({
			name: 'MrBoxs',
			sameAs: ['https://x.com/isntboxs', 'https://github.com/mrboxs'],
		})
		expect(person).not.toHaveProperty('telephone')
		expect(person).not.toHaveProperty('jobTitle')
		expect(person).not.toHaveProperty('worksFor')
		expect(graph).toContainEqual(
			expect.objectContaining({
				'@type': 'ProfilePage',
				mainEntity: { '@id': publicUrl('/#person') },
			})
		)
	})

	it('reads server URL configuration at request time and normalizes it to an origin', () => {
		urls.APP_URL = 'https://staging.example.test/ignored/path'
		urls.VITE_APP_URL = 'https://staging.example.test/'
		expect(publicUrl('/blog')).toBe('https://staging.example.test/blog')
	})

	it('rejects configuration that would produce different server and client metadata', () => {
		urls.APP_URL = 'https://different.example.test'
		expect(() => homeHead()).toThrow(
			'APP_URL and VITE_APP_URL must use the same public origin.'
		)
	})

	it('uses current article data, a revisioned image, breadcrumbs, and a Markdown alternate', () => {
		const head = blogPostHead(blogMetadata)
		expect(head.links).toEqual(
			expect.arrayContaining([
				{ rel: 'canonical', href: publicUrl('/blog/tulisan-pertama') },
				expect.objectContaining({
					rel: 'alternate',
					href: publicUrl('/blog/tulisan-pertama.md'),
				}),
			])
		)
		expect(head.meta).toEqual(
			expect.arrayContaining([
				{ title: 'Tulisan Pertama | MrBoxs' },
				{ property: 'og:type', content: 'article' },
				{ property: 'og:url', content: publicUrl('/blog/tulisan-pertama') },
				{ name: 'twitter:url', content: publicUrl('/blog/tulisan-pertama') },
				{
					property: 'og:image',
					content: publicUrl(
						`/og/blog/tulisan-pertama.png?v=${blogMetadata.cover.src.commit}`
					),
				},
				{ property: 'article:published_time', content: '2026-11-15' },
			])
		)
		const graph = parseGraph(head.scripts[0].children)
		const article = graph.find(
			(entity: Record<string, unknown>) => entity['@type'] === 'BlogPosting'
		)
		expect(article).toMatchObject({
			headline: blogMetadata.title,
			author: { name: blogMetadata.author.name, url: blogMetadata.author.url },
			keywords: 'personal',
			datePublished: '2026-11-15',
		})
		expect(article?.image).toContain(
			publicUrl('/api/blog/assets/tulisan-pertama/cover.png')
		)
		expect(article).not.toHaveProperty('dateModified')
		const breadcrumb = graph.find(
			(entity) => entity['@type'] === 'BreadcrumbList'
		)
		expect(breadcrumb?.itemListElement).toContainEqual(
			expect.objectContaining({
				position: 3,
				item: publicUrl('/blog/tulisan-pertama'),
			})
		)
	})

	it('allows indexing an empty blog, but excludes missing and failed routes', () => {
		const robots = blogIndexHead([]).meta.find((meta) => meta.name === 'robots')
		expect(robots?.content).toContain('index, follow,')
		for (const head of [blogPostHead(), blogIndexHead(), unavailableHead()]) {
			expect(head.meta).toContainEqual({
				name: 'robots',
				content: 'noindex, follow',
			})
			expect(head.links).toEqual([])
			expect(head.scripts).toEqual([])
		}
	})

	it('lists only the supplied public articles in the blog schema', () => {
		const graph = parseGraph(blogIndexHead([blogMetadata]).scripts[0].children)
		expect(
			graph.find(
				(entity: Record<string, unknown>) => entity['@type'] === 'Blog'
			)?.blogPost
		).toEqual([
			expect.objectContaining({
				url: publicUrl('/blog/tulisan-pertama'),
				headline: blogMetadata.title,
			}),
		])
	})

	it('prevents article text from breaking out of a JSON-LD script', () => {
		const hostile = '</script><script>alert("x")</script> & > \u2028\u2029'
		const encoded = jsonLd({ headline: hostile })
		expect(encoded).not.toMatch(/[<>&\u2028\u2029]/)
		expect(JSON.parse(encoded)).toEqual({ headline: hostile })
		const head = blogPostHead({ ...blogMetadata, title: hostile })
		expect(head.scripts[0].children).not.toContain('</script>')
		expect(parseGraph(head.scripts[0].children)).toContainEqual(
			expect.objectContaining({ headline: hostile })
		)
	})
})
