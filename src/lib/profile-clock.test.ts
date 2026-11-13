import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { formatProfileClock } from './profile-clock'

afterEach(() => vi.restoreAllMocks())

describe('formatProfileClock', () => {
	it('uses the profile time zone across a date boundary', () => {
		vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0)
		const clock = formatProfileClock(
			Date.parse('2026-11-14T23:35:00Z'),
			'Asia/Jakarta'
		)
		expect(clock).toEqual({ time: '06:35 AM', difference: '// 7h ahead' })
	})

	it('reports the same time when the viewer shares the UTC offset', () => {
		vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420)
		expect(formatProfileClock(0, 'Asia/Jakarta').difference).toBe(
			'// same time'
		)
	})

	it('preserves fractional differences for other viewer time zones', () => {
		vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-345)
		expect(formatProfileClock(0, 'UTC').difference).toBe('// 5.75h behind')
	})
})
