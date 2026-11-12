import type { ComponentProps, FC } from 'react'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export const ThemeProvider: FC<ComponentProps<typeof NextThemesProvider>> = ({
	children,
	...props
}) => <NextThemesProvider {...props}>{children}</NextThemesProvider>

export { useTheme } from 'next-themes'
