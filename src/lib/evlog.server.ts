import '@tanstack/react-start/server-only'
import { EvlogError, initLogger, toLoggerConfig } from 'evlog'
import type { RequestLogger } from 'evlog'

import config, { orpcPrefixes } from '../../evlog.config'

initLogger(toLoggerConfig(config))

export { createWorkersLogger as requestLogger } from 'evlog/workers'

export function isOrpcRequest(request: Request): boolean {
	const { pathname } = new URL(request.url)
	return orpcPrefixes.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	)
}

export function structuredErrorResponse(
	error: unknown,
	log: RequestLogger
): Response | undefined {
	if (!EvlogError.isEvlogError(error)) return undefined

	log.error(error)
	return Response.json(
		{
			message: error.message,
			status: error.status,
			data: {
				code: error.code,
				why: error.why,
				fix: error.fix,
				link: error.link,
			},
		},
		{
			status: error.status,
			headers: { 'Cache-Control': 'no-store' },
		}
	)
}
