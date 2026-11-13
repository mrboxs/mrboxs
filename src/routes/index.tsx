import { createFileRoute, Link } from '@tanstack/react-router'

import logomarkSVG from '#/assets/mrboxs-symbol.svg?raw'
import logotypeSVG from '#/assets/mrboxs-wordmark.svg?raw'
import { BrandAssetsMenu } from '#/components/custom/brand-assets-menu'
import { MrBoxsMark } from '#/components/custom/mrboxs-mark'
import { MrBoxsSpotlightLogo } from '#/components/custom/mrboxs-spotlight-logo'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
	return (
		<div className="flex flex-col items-center gap-12 p-8">
			<div className="flex flex-col items-center gap-4">
				<BrandAssetsMenu
					logomark={<MrBoxsMark />}
					logomarkSVG={logomarkSVG}
					logotypeSVG={logotypeSVG}
					brandGuidelinesURL="https://github.com/mrboxs/mrboxs-brandkit/blob/main/05-guidelines/brand-guidelines.md"
					brandAssetsURL="https://github.com/mrboxs/mrboxs-brandkit/releases/download/v1.0.0/mrboxs-brandkit-v1.0.0.zip"
				>
					<Link
						to="/"
						aria-label="Home"
						aria-describedby="brand-assets-hint"
						className="rounded-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
					>
						<MrBoxsMark className="size-12" />
					</Link>
				</BrandAssetsMenu>
				<p id="brand-assets-hint" className="text-sm text-muted-foreground">
					<span className="hidden pointer-fine:inline-block">
						Right-click the logo
					</span>
					<span className="hidden pointer-coarse:inline-block">
						Press &amp; hold the logo
					</span>
					<span className="sr-only">Open the logo menu with Shift+F10.</span>
				</p>
			</div>
			<div className="w-full max-w-250">
				<MrBoxsSpotlightLogo />
			</div>
		</div>
	)
}
