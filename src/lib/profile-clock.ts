export function formatProfileClock(timestamp: number, timeZone: string) {
	const date = new Date(timestamp)
	const time = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
	}).format(date)
	const zone =
		new Intl.DateTimeFormat('en-US', {
			timeZone,
			timeZoneName: 'longOffset',
		})
			.formatToParts(date)
			.find((part) => part.type === 'timeZoneName')?.value ?? ''
	const offset = /GMT([+-])(\d{2}):(\d{2})/.exec(zone)
	const targetMinutes = offset
		? (Number(offset[2]) * 60 + Number(offset[3])) *
			(offset[1] === '+' ? 1 : -1)
		: 0
	const difference = targetMinutes + date.getTimezoneOffset()
	const hours = Math.abs(difference) / 60

	return {
		time,
		difference:
			difference === 0
				? '// same time'
				: `// ${hours}h ${difference > 0 ? 'ahead' : 'behind'}`,
	}
}
