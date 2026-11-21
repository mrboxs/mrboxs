import { useEffect } from 'react'

import { useTheme } from '#/components/theme-provider'

export function ThemeFavicon() {
	const { resolvedTheme } = useTheme()
	useEffect(() => {
		if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return
		const icon = document.getElementById('theme-favicon')
		const color = document.getElementById('theme-color')
		icon?.setAttribute('href', `/brand/favicon-${resolvedTheme}.svg`)
		color?.setAttribute(
			'content',
			resolvedTheme === 'dark' ? '#080808' : '#ffffff'
		)
		return () => {
			icon?.setAttribute('href', '/favicon.svg')
			color?.setAttribute('content', '#080808')
		}
	}, [resolvedTheme])
	return null
}
