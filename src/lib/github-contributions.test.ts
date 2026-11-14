import { describe, expect, it } from 'vite-plus/test'

import { parseGitHubContributions } from './github-contributions'

describe('parseGitHubContributions', () => {
	it('sorts days and derives the total from the actual displayed range', () => {
		expect(
			parseGitHubContributions({
				total: { lastYear: 999 },
				contributions: [
					{ date: '2026-11-13', count: 9, level: 2 },
					{ date: '2026-11-12', count: 1, level: 1 },
				],
			})
		).toEqual({
			contributions: [
				{ date: '2026-11-12', count: 1, level: 1 },
				{ date: '2026-11-13', count: 9, level: 2 },
			],
			total: 10,
			from: '2026-11-12',
			to: '2026-11-13',
		})
	})

	it('represents an empty result without inventing dates', () => {
		expect(parseGitHubContributions({ contributions: [] })).toEqual({
			contributions: [],
			total: 0,
			from: null,
			to: null,
		})
	})

	it.each([
		null,
		{},
		{ contributions: 'not an array' },
		{ contributions: [{ date: '2026-02-30', count: 1, level: 1 }] },
		{ contributions: [{ date: '2026-11-13', count: -1, level: 1 }] },
		{ contributions: [{ date: '2026-11-13', count: 1.5, level: 1 }] },
		{ contributions: [{ date: '2026-11-13', count: 1, level: 5 }] },
		{ contributions: [{ date: '2026-11-13', count: 1, level: 1.5 }] },
	])('rejects malformed upstream data: %j', (payload) => {
		expect(() => parseGitHubContributions(payload)).toThrow()
	})

	it('rejects duplicate dates rather than double-counting contributions', () => {
		const day = { date: '2026-11-13', count: 9, level: 2 }
		expect(() =>
			parseGitHubContributions({ contributions: [day, day] })
		).toThrow()
	})

	it('bounds the range before the graph fills calendar gaps', () => {
		expect(() =>
			parseGitHubContributions({
				contributions: [
					{ date: '2000-01-01', count: 1, level: 1 },
					{ date: '2026-11-13', count: 1, level: 1 },
				],
			})
		).toThrow()
	})
})
