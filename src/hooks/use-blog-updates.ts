import { noop, useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { useEffect, useRef } from 'react'

export function useBlogUpdates(initialRevision: string | undefined) {
	const router = useRouter()
	const { queryClient, orpc } = router.options.context
	const appliedRevision = useRef(initialRevision)
	const { data, isFetching, isSuccess } = useQuery(
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

	useEffect(() => {
		if (
			isFetching ||
			!isSuccess ||
			!revision ||
			revision === appliedRevision.current
		) {
			return
		}
		appliedRevision.current = revision
		void Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.blog.list.key() }),
			queryClient.invalidateQueries({
				queryKey: orpc.blog.getBySlug.key(),
				refetchType: 'none',
			}),
		])
			.then(() => router.invalidate())
			.catch(noop)
	}, [revision, isFetching, isSuccess, orpc, queryClient, router])
}
