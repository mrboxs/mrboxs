import { noop, useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { useEffect, useRef } from 'react'

export function useBlogUpdates(initialRevision: string | undefined) {
	const router = useRouter()
	const { queryClient, orpc } = router.options.context
	const appliedRevision = useRef(initialRevision)
	const refreshing = useRef(false)
	const { data, dataUpdatedAt, isFetching, isSuccess } = useQuery(
		orpc.blog.revision.queryOptions({
			input: {},
			enabled: typeof window !== 'undefined',
			staleTime: 0,
			refetchInterval: (query) =>
				query.state.status === 'error' ? 60_000 : 5_000,
			refetchIntervalInBackground: false,
			retry: false,
		})
	)
	const revision = data?.revision

	// Each successful probe can retry an unapplied revision even when its SHA is unchanged.
	useEffect(() => {
		if (
			isFetching ||
			!isSuccess ||
			!revision ||
			revision === appliedRevision.current ||
			refreshing.current
		) {
			return
		}
		refreshing.current = true
		void Promise.all([
			queryClient.invalidateQueries(
				{ queryKey: orpc.blog.list.key() },
				{ throwOnError: true }
			),
			queryClient.invalidateQueries({
				queryKey: orpc.blog.getBySlug.key(),
				refetchType: 'none',
			}),
		])
			.then(() => router.invalidate({ sync: true }))
			.then(() => {
				if (router.state.matches.every((match) => match.status === 'success')) {
					appliedRevision.current = revision
				}
			})
			.catch(noop)
			.finally(() => {
				refreshing.current = false
			})
	}, [
		revision,
		dataUpdatedAt,
		isFetching,
		isSuccess,
		orpc,
		queryClient,
		router,
	])
}
