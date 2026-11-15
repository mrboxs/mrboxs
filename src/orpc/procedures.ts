import { implement } from '@orpc/server'

import { contracts } from '#/orpc/contracts'

const o = implement(contracts)

export const publicProcedures = o
