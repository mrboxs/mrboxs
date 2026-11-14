import { createServerFn } from '@tanstack/react-start'
import {
	setResponseHeader,
	setResponseStatus,
} from '@tanstack/react-start/server'

import { profile } from '#/data/profile'

import { parseGitHubContributions } from './github-contributions'

export const getGitHubContributions = createServerFn({ method: 'GET' }).handler(
	async () => {
		try {
			const response = await fetch(
				`https://github-contributions-api.jogruber.de/v4/${profile.githubUsername}?y=last`,
				{
					signal: AbortSignal.timeout(8000),
					headers: { Accept: 'application/json' },
				}
			)
			if (!response.ok) {
				throw new Error('GitHub contributions could not be fetched')
			}
			const payload: unknown = await response.json()
			const data = parseGitHubContributions(payload)
			setResponseHeader(
				'Cache-Control',
				'public, max-age=3600, stale-while-revalidate=86400'
			)
			return data
		} catch {
			setResponseStatus(502)
			setResponseHeader('Cache-Control', 'no-store')
			throw new Error('GitHub activity is temporarily unavailable.')
		}
	}
)
