import { createIsomorphicFn } from '@tanstack/react-start'

import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createRouterClient } from '@orpc/server'
import {
	createTanstackQueryUtils,
	TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL,
} from '@orpc/tanstack-query'

import { routers } from '#/orpc/routers'
import type { ORPCClientContext, ORPCRouterClient } from '#/orpc/routers'

const readOperations = new Set(['query', 'streamed', 'live', 'infinite'])

const getORPCClient = createIsomorphicFn()
	.server(() => createRouterClient(routers, { context: {} }))
	.client((): ORPCRouterClient => {
		const link = new RPCLink<ORPCClientContext>({
			url: `/api/rpc`,
			method: ({ context }, path) => {
				const operation = context[TANSTACK_QUERY_OPERATION_CONTEXT_SYMBOL]?.type
				if (operation) {
					return readOperations.has(operation) ? 'QUERY' : 'POST'
				}

				if (path.at(-1)?.match(/^(?:get|find|list|search)(?:[A-Z].*)?$/)) {
					return 'QUERY'
				}

				return 'POST'
			},
			fetch(url, options, { context }) {
				return fetch(url, {
					...options,
					credentials: 'include',
					cache: context.cache,
				})
			},
		})

		return createORPCClient(link)
	})

export const client: ORPCRouterClient = getORPCClient()
export const orpc = createTanstackQueryUtils(client)

export const blogORPC = createTanstackQueryUtils(client.blog, {
	prefix: 'blogs',
})
