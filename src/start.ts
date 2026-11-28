import { createStart } from '@tanstack/react-start'

import { evlogRequest } from '#/lib/evlog-middleware'

export const startInstance = createStart(() => ({
	requestMiddleware: [evlogRequest],
}))
