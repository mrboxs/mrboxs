import { QueryClient } from '@tanstack/react-query'

import { orpc } from '#/orpc/client'

export function getContext() {
	const queryClient = new QueryClient()

	return {
		queryClient,
		orpc,
	}
}
