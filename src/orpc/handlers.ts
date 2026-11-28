import '@tanstack/react-start/server-only'
import { SmartCoercionHandlerPlugin } from '@orpc/json-schema'
import { getOpenAPIMeta, OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { OpenAPIReferenceHandlerPlugin } from '@orpc/openapi/plugins'
import type { ORPCError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { RPC_DEFAULT_ALLOW_METHODS } from '@orpc/server/standard'
import { ZodToJsonSchemaConverter } from '@orpc/zod'
import { toMiddlewareOptions } from 'evlog'
import { withEvlog } from 'evlog/orpc'

import '#/lib/evlog.server'
import { ERROR_STATUS_MAP } from '#/orpc/openapi-errors'
import { routers } from '#/orpc/routers'

import config from '../../evlog.config'

const logging = toMiddlewareOptions(config)

export const rpcHandler = withEvlog(
	new RPCHandler(routers, {
		allowMethods: ['QUERY', ...RPC_DEFAULT_ALLOW_METHODS],
	}),
	logging
)

const generator = new OpenAPIGenerator({
	converters: [new ZodToJsonSchemaConverter()],
})

const openApi = new OpenAPIHandler(routers, {
	errorStatusMap: ERROR_STATUS_MAP,
	// Expose only explicitly mapped REST procedures. RPC-only compatibility
	// procedures must not acquire fallback paths in the matcher or reference.
	filter: (procedure) => getOpenAPIMeta(procedure)?.path !== undefined,
	plugins: [
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),

		new OpenAPIReferenceHandlerPlugin({
			provider: 'scalar',
			spec: () =>
				generator.generate(routers, {
					errorStatusMap: ERROR_STATUS_MAP,
					filter: (procedure) => getOpenAPIMeta(procedure)?.path !== undefined,
					base: {
						info: {
							title: 'MrBoxs API',
							version: '0.0.0',
							description: 'API Reference for MrBoxs',
						},
						components: {
							securitySchemes: {
								bearerAuth: {
									type: 'http',
									scheme: 'bearer',
								},
							},
						},
						servers: [{ url: '/api/reference' }],
					},
				}),
		}),
	],

	errorResponseBodyEncoder: (error: ORPCError<string, unknown>) => {
		return {
			...error.toJSON(),
			status: ERROR_STATUS_MAP[error.code] ?? 400,
		}
	},
})

export const openApiHandler = withEvlog(openApi, logging)
