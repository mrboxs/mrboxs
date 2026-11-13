import {
	IconRosetteDiscountCheckFilled,
	IconVolume2,
} from '@tabler/icons-react'

import { MrBoxsMark } from '#/components/custom/mrboxs-mark'
import { MrBoxsSpotlightLogo } from '#/components/custom/mrboxs-spotlight-logo'
import { Button } from '#/components/ui/button'
import { toast } from '#/components/ui/toast'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import { profile } from '#/data/profile'

import {
	AvatarDiameterDimension,
	HandwrittenArrow,
	HandwrittenNote,
} from './dimensions'

function PronounceName() {
	const pronounce = () => {
		if (!('speechSynthesis' in window)) {
			toast.add({
				title: 'Pronunciation is unavailable in this browser.',
				description: `Pronounced: ${profile.pronunciation}.`,
				type: 'info',
			})
			return
		}

		window.speechSynthesis.cancel()
		const utterance = new SpeechSynthesisUtterance(profile.pronunciation)
		utterance.lang = 'en-US'
		window.speechSynthesis.speak(utterance)
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						className="profile-pronunciation"
						variant="ghost"
						size="icon-xs"
						onClick={pronounce}
						aria-label={`Pronounce ${profile.displayName}`}
					/>
				}
			>
				<IconVolume2 aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent>Pronounce my name</TooltipContent>
		</Tooltip>
	)
}

export function ProfileHeader() {
	return (
		<section
			className="screen-line-bottom relative isolate grid grid-cols-[auto_1fr] grid-rows-[1fr_auto] overflow-y-clip border-x border-line"
			aria-labelledby="profile-name"
		>
			<figure className="relative col-span-2 p-2 sm:col-span-1 sm:col-start-2 sm:p-4">
				<MrBoxsSpotlightLogo />
				<HandwrittenNote className="bottom-20 left-full hidden w-36 flex-col items-start pointer-fine:xl:flex">
					<HandwrittenArrow className="-scale-y-100 -rotate-6" />
					<span className="ml-3 -rotate-6">
						follows your cursor
						<br />
						click for a sound
					</span>
				</HandwrittenNote>
			</figure>

			<div className="flex flex-col sm:row-span-2 sm:row-start-1">
				<div className="screen-line-top mt-auto shrink-0 border-r border-line">
					<div className="relative -mx-px size-30 min-[24rem]:size-32 sm:size-40">
						<div className="relative z-10 size-full overflow-hidden rounded-full border border-line bg-muted">
							<MrBoxsMark className="absolute inset-0 m-auto size-20 text-muted-foreground" />
							<img
								src={profile.avatar}
								alt={`${profile.displayName}'s GitHub avatar`}
								width="160"
								height="160"
								fetchPriority="high"
								className="relative block size-full rounded-full object-cover grayscale select-none"
								onError={(event) => {
									event.currentTarget.style.visibility = 'hidden'
								}}
							/>
						</div>
						<AvatarDiameterDimension />
					</div>
				</div>
			</div>

			<div className="flex min-w-0 flex-col">
				<div className="z-1 mt-auto border-t border-line">
					<div className="flex min-h-8 -translate-x-px items-center gap-2 pl-3 sm:pl-4">
						<h1
							id="profile-name"
							className="-translate-y-px font-heading text-[clamp(1.5rem,4vw,2rem)]/none font-medium tracking-tight"
						>
							{profile.displayName}
						</h1>
						<IconRosetteDiscountCheckFilled
							className="size-4.5 shrink-0"
							aria-hidden="true"
						/>
						<PronounceName />
					</div>
					<p className="min-h-12.5 border-t border-line py-1 pr-3 pl-3 font-mono text-sm/6 text-muted-foreground sm:min-h-9 sm:pl-4">
						{profile.tagline}
					</p>
				</div>
			</div>
		</section>
	)
}
