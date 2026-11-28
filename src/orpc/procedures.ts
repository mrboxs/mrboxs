import { implement } from '@orpc/server'
import { evlog } from 'evlog/orpc'
import type { EvlogOrpcContext } from 'evlog/orpc'

import { contracts } from '#/orpc/contracts'

// The HTTP handlers inject the logger. The in-process SSR client has no HTTP event.
type ProcedureContext = Partial<EvlogOrpcContext>

export const publicProcedures = implement(contracts)
	.$context<ProcedureContext>()
	.use(evlog<ProcedureContext>())
