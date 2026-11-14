import { Link } from '@tanstack/react-router'

import { IconBrandGithub } from '@tabler/icons-react'

import logomarkSVG from '#/assets/mrboxs-symbol.svg?raw'
import logotypeSVG from '#/assets/mrboxs-wordmark.svg?raw'
import { BrandAssetsMenu } from '#/components/custom/brand-assets-menu'
import { MrBoxsMark } from '#/components/custom/mrboxs-mark'
import { ThemeSwitcher } from '#/components/theme-switcher'
import { Button } from '#/components/ui/button'
import { Kbd } from '#/components/ui/kbd'
import { Separator } from '#/components/ui/separator'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'

export const SiteHeader = () => {
	return (
		<header className="site-header fixed top-0 z-50 h-14 w-full border-y border-line bg-background">
			<div className="mx-auto flex h-full w-full max-w-3xl items-center justify-between border-x border-line px-4">
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

				<div className="flex items-center justify-end gap-2">
					<Button
						variant="ghost"
						size="icon"
						aria-label="GitHub repository"
						nativeButton={false}
						render={
							<a
								href={'https://github.com/mrboxs/mrboxs'}
								aria-label="GitHub repository"
								target="_blank"
								rel="noopener noreferrer"
							/>
						}
					>
						<IconBrandGithub />
					</Button>

					<Separator
						orientation="vertical"
						className="h-6 data-vertical:self-center"
					/>

					<Tooltip>
						<TooltipTrigger render={<ThemeSwitcher />} />

						<TooltipContent>
							Toggle Mode <Kbd>D</Kbd>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</header>
	)
}
