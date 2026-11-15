import { oc } from '@orpc/contract'

import { ORPC_ERRORS } from '#/constants/orpc-errors'

export const baseContract = oc.errors(ORPC_ERRORS)
