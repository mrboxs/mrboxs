import { createIsomorphicFn } from '@tanstack/react-start'

import { env } from 'void/env'

import { profile } from '#/data/profile'

const getAppOrigin = createIsomorphicFn()
	.server(() => {
		const origin = new URL(env.APP_URL).origin
		if (origin !== new URL(env.VITE_APP_URL).origin) {
			throw new Error(
				'APP_URL and VITE_APP_URL must use the same public origin.'
			)
		}
		return origin
	})
	.client(() => new URL(env.VITE_APP_URL).origin)

export const site = {
	name: profile.displayName,
	get origin() {
		return getAppOrigin()
	},
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
