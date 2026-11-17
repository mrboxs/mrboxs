import { noop, useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { useEffect, useRef } from 'react'

import { ORPCError } from '@orpc/client'

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
		const detailQueries = { queryKey: orpc.blog.getBySlug.key() }
		async function refresh() {
			await queryClient.cancelQueries(detailQueries)
			await Promise.all([
				queryClient.invalidateQueries(
					{ queryKey: orpc.blog.list.key() },
					{ throwOnError: true }
				),
				queryClient.invalidateQueries({
					...detailQueries,
					refetchType: 'none',
				}),
			])
			try {
				await queryClient.refetchQueries(
					{ ...detailQueries, type: 'active' },
					{ throwOnError: true }
				)
			} catch (error) {
				// The loader translates terminal post errors into the not-found boundary.
				if (
					!(error instanceof ORPCError) ||
					(error.code !== 'NOT_FOUND' && error.code !== 'BAD_REQUEST')
				) {
					throw error
				}
			}
			await router.invalidate({ sync: true })
			if (router.state.matches.every((match) => match.status === 'success')) {
				appliedRevision.current = revision
			}
		}
		void refresh()
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
