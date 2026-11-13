import { useHotkey } from '@tanstack/react-hotkeys'

import type { ComponentProps } from 'react'
import { flushSync } from 'react-dom'

import { mergeProps } from '@base-ui/react/merge-props'
import { IconBrightness } from '@tabler/icons-react'
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'

import { useTheme } from '#/components/theme-provider'
import { Button } from '#/components/ui/button'

export const ThemeSwitcher = (props: ComponentProps<typeof Button>) => {
	const { resolvedTheme, setTheme } = useTheme()
	const shouldReduceMotion = useReducedMotion()

	const switchTheme = () => {
		const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

		if (
			shouldReduceMotion ||
			typeof document.startViewTransition !== 'function'
		) {
			setTheme(nextTheme)
			return
		}

		document.startViewTransition(() => {
			flushSync(() => setTheme(nextTheme))
		})
	}

	useHotkey('D', () => switchTheme())

	return (
		<Button
			{...mergeProps<typeof Button>(
				{
					variant: 'ghost',
					size: 'icon',
					'aria-label': 'Theme Toggle',
					onClick: switchTheme,
				},
				props
			)}
		>
			<LazyMotion features={domAnimation} strict>
				<m.span
					aria-hidden="true"
					className="inline-flex"
					initial={{ rotate: 0 }}
					animate={{ rotate: resolvedTheme === 'light' ? -180 : 0 }}
					transition={{
						duration: shouldReduceMotion ? 0 : 0.3,
						ease: 'easeInOut',
					}}
				>
					<IconBrightness />
				</m.span>
			</LazyMotion>
		</Button>
	)
}
