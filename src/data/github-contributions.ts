import { queryOptions } from '@tanstack/react-query'

import { getGitHubContributions } from '#/lib/github-contributions.functions'

import { profile } from './profile'

export const githubContributionsQuery = queryOptions({
	queryKey: ['github-contributions', profile.githubUsername],
	queryFn: ({ signal }) => getGitHubContributions({ signal }),
	staleTime: 60 * 60 * 1000,
	retry: 1,
})
