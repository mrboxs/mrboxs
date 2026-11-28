import { TanStackDevtools } from '@tanstack/react-devtools'
import { HotkeysDevtoolsPanel } from '@tanstack/react-hotkeys-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { NavigationProgress } from '#/components/navigation-progress'
import { PageError, PageNotFound } from '#/components/route-feedback'
import { SiteFooter } from '#/components/site-footer'
import { SiteHeader } from '#/components/site-header'
import { ThemeFavicon } from '#/components/theme-favicon'
import { ThemeProvider } from '#/components/theme-provider'
import { Toaster } from '#/components/ui/toast'
import { TooltipProvider } from '#/components/ui/tooltip'
import TanStackQueryDevtools from '#/integrations/tanstack-query/devtools'
import { evlogErrorHandler } from '#/lib/evlog-middleware'
import { unavailableHead } from '#/lib/seo'
import type { orpc } from '#/orpc/client'
import appCss from '#/styles.css?url'

interface MyRouterContext {
	queryClient: QueryClient
	orpc: typeof orpc
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	server: { middleware: [evlogErrorHandler] },
	head: () => ({
		...unavailableHead(),
		meta: [
			...unavailableHead().meta,
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{ name: 'theme-color', content: '#080808', id: 'theme-color' },
		],
		links: [
			{
				rel: 'icon',
				type: 'image/x-icon',
				href: '/favicon.ico',
				sizes: '16x16 32x32 48x48',
			},
			{
				id: 'theme-favicon',
				rel: 'icon',
				type: 'image/svg+xml',
				href: '/favicon.svg',
			},
			{
				rel: 'apple-touch-icon',
				href: '/apple-touch-icon.png',
				sizes: '180x180',
			},
			{
				rel: 'manifest',
				href: '/manifest.json',
			},
			{
				rel: 'alternate',
				type: 'text/plain',
				href: '/llms.txt',
				title: 'Site information for language models',
			},
			{
				rel: 'stylesheet',
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
	component: Outlet,
	errorComponent: PageError,
	notFoundComponent: () => <PageNotFound />,
})

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en"
			className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent scrollbar-gutter-stable selection:bg-primary selection:text-primary-foreground"
			suppressHydrationWarning
		>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					disableTransitionOnChange
					storageKey="theme"
				>
					<ThemeFavicon />
					<TooltipProvider>
						<NavigationProgress />
						<SiteHeader />
						{children}
						<SiteFooter />
					</TooltipProvider>
					<Toaster />
				</ThemeProvider>
				<TanStackDevtools
					config={{
						position: 'bottom-right',
					}}
					plugins={[
						{
							name: 'Tanstack Router',
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
						{
							name: 'Tanstack Hotkeys',
							render: <HotkeysDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	)
}
