import type {
	InferRouterInputs,
	InferRouterOutputs,
	RouterClient,
} from '@orpc/server'
import type { TanstackQueryOperationContext } from '@orpc/tanstack-query'

import { blogRouter } from '#/orpc/routers/blog-router'

export const routers = {
	blog: blogRouter,
} as const

export interface ORPCClientContext extends TanstackQueryOperationContext {
	cache?: RequestCache
}

export type ORPCRouterClient = RouterClient<typeof routers, ORPCClientContext>

export type ORPCRouterInputs = InferRouterInputs<typeof routers>
export type ORPCRouterOutputs = InferRouterOutputs<typeof routers>
