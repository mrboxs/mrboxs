import { profile } from '#/data/profile'
import { productionSiteUrl } from '#/data/site'

export const site = {
	name: profile.displayName,
	origin: new URL(productionSiteUrl).origin,
	description: profile.taglines.join(' '),
	blogDescription: "Things I've built, tried, and figured out.",
	language: 'en',
	locale: 'en_US',
	socials: profile.socials
		.filter((social) => social.name === 'github' || social.name === 'x')
		.map((social) => social.href),
} as const

export function publicUrl(path: string): string {
	return new URL(path, site.origin).href
}

export function postPath(slug: string): string {
	return `/blog/${encodeURIComponent(slug)}`
}

export function postOgPath(slug: string, revision: string): string {
	return `/og/blog/${encodeURIComponent(slug)}.png?v=${encodeURIComponent(revision)}`
}
