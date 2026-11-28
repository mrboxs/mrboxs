import { defineEvlog } from 'evlog'

export const orpcPrefixes = ['/api/rpc', '/api/reference']

export default defineEvlog({
	service: 'my-rpc',
	include: orpcPrefixes.flatMap((prefix) => [prefix, `${prefix}/**`]),
	enrich: ({ event }) => {
		event.framework = 'orpc'
	},
	keep: (context) => {
		if ((context.status ?? 0) >= 500) context.shouldKeep = true
	},
})
