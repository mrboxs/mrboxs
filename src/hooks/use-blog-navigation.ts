import { useHotkeys } from '@tanstack/react-hotkeys'
import { useRouter } from '@tanstack/react-router'

import type { PostMetadata } from '#/lib/blog'

export const blogNavigationShortcuts = {
	previous: 'ArrowLeft',
	next: 'ArrowRight',
} as const

export function useBlogNavigation(
	previous?: PostMetadata,
	next?: PostMetadata
) {
	const router = useRouter()
	function navigate(post: PostMetadata | undefined, event: KeyboardEvent) {
		// Article widgets keep horizontal scrolling; open dialogs stay in place.
		if (
			event.target instanceof Element &&
			event.target.closest(
				'pre, [role="region"][tabindex], dialog, [role="dialog"], [role="alertdialog"]'
			)
		) {
			return
		}
		if (post) {
			void router.navigate({ to: '/blog/$slug', params: { slug: post.slug } })
		}
	}
	useHotkeys(
		[
			{
				hotkey: blogNavigationShortcuts.previous,
				callback: (event) => navigate(previous, event),
				options: {
					enabled: !!previous,
					requireReset: true,
					meta: { name: 'Previous post' },
				},
			},
			{
				hotkey: blogNavigationShortcuts.next,
				callback: (event) => navigate(next, event),
				options: {
					enabled: !!next,
					requireReset: true,
					meta: { name: 'Next post' },
				},
			},
		],
		{
			ignoreInputs: true,
			ignoreDefaultPrevented: true,
			preventDefault: false,
		}
	)
}
