import { useRouterState } from '@tanstack/react-router'

import { useEffect } from 'react'

import NProgress from 'nprogress'

const displayDelay = 150

export function NavigationProgress() {
	const isLoading = useRouterState({ select: (state) => state.isLoading })

	useEffect(() => {
		if (!isLoading) return

		const timer = window.setTimeout(() => {
			const reducedMotion = window.matchMedia(
				'(prefers-reduced-motion: reduce)'
			).matches
			NProgress.configure({
				showSpinner: false,
				trickle: !reducedMotion,
				speed: reducedMotion ? 0 : 200,
				barSelector: '[data-navigation-bar]',
				template:
					'<div class="bar" data-navigation-bar aria-hidden="true"></div>',
			})
			NProgress.start()
		}, displayDelay)

		return () => {
			window.clearTimeout(timer)
			NProgress.done()
		}
	}, [isLoading])

	return null
}
