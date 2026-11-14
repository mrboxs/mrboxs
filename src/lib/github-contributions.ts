import type { Activity } from '#/components/custom/github-contribution-graph'

function isActivity(value: unknown): value is Activity {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	if (!('date' in value) || !('count' in value) || !('level' in value)) {
		return false
	}
	if (
		typeof value.date !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
		typeof value.count !== 'number' ||
		!Number.isSafeInteger(value.count) ||
		value.count < 0 ||
		typeof value.level !== 'number' ||
		!Number.isInteger(value.level) ||
		value.level < 0 ||
		value.level > 4
	) {
		return false
	}

	const timestamp = Date.parse(value.date)
	return (
		Number.isFinite(timestamp) &&
		new Date(timestamp).toISOString().slice(0, 10) === value.date
	)
}

export function parseGitHubContributions(payload: unknown) {
	if (
		typeof payload !== 'object' ||
		payload === null ||
		!('contributions' in payload) ||
		!Array.isArray(payload.contributions) ||
		payload.contributions.length > 371
	) {
		throw new Error('Invalid GitHub contribution response')
	}

	const contributions: Array<Activity> = []
	const dates = new Set<string>()
	for (const activity of payload.contributions) {
		if (!isActivity(activity) || dates.has(activity.date)) {
			throw new Error('Invalid GitHub contribution day')
		}
		dates.add(activity.date)
		contributions.push({
			date: activity.date,
			count: activity.count,
			level: activity.level,
		})
	}
	contributions.sort((a, b) => a.date.localeCompare(b.date))
	const from = contributions.at(0)?.date ?? null
	const to = contributions.at(-1)?.date ?? null
	if (from && to && Date.parse(to) - Date.parse(from) > 370 * 86400000) {
		throw new Error('GitHub contribution range exceeds one calendar year')
	}

	return {
		contributions,
		total: contributions.reduce((sum, activity) => sum + activity.count, 0),
		from,
		to,
	}
}

export type GitHubContributionData = ReturnType<typeof parseGitHubContributions>
