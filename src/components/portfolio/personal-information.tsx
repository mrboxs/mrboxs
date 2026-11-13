import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'

import {
	IconBrandGithub,
	IconBrandLinkedin,
	IconBrandX,
	IconClock,
	IconCode,
	IconMail,
	IconMapPin,
	IconPhone,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { Button } from '#/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import { profile } from '#/data/profile'
import { formatProfileClock } from '#/lib/profile-clock'

import { HandwrittenArrow, HandwrittenNote } from './dimensions'

function InfoItem({
	icon,
	children,
	className,
}: {
	icon: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				'flex min-w-0 items-center gap-4 font-mono text-sm',
				className
			)}
		>
			<span className="info-icon" aria-hidden="true">
				{icon}
			</span>
			<div className="min-w-0 text-pretty">{children}</div>
		</div>
	)
}

function subscribeToClock(onChange: () => void) {
	const interval = setInterval(onChange, 1000)
	return () => clearInterval(interval)
}

function getMinute() {
	return Math.floor(Date.now() / 60000)
}

function getServerMinute() {
	return null
}

function LocalTime() {
	const minute = useSyncExternalStore(
		subscribeToClock,
		getMinute,
		getServerMinute
	)
	const clock =
		minute === null
			? null
			: formatProfileClock(minute * 60000, profile.timeZone)

	return (
		<InfoItem icon={<IconClock />}>
			<span
				className="inline-flex flex-wrap gap-x-2 tabular-nums"
				aria-label="Current time in Jakarta"
			>
				<time>{clock?.time ?? '--:-- --'}</time>
				<span className="text-muted-foreground">
					{clock?.difference ?? '// Jakarta'}
				</span>
			</span>
		</InfoItem>
	)
}

export function PersonalInformation() {
	return (
		<section
			id="personal-information"
			className="screen-line-bottom screen-line-top relative isolate border-x border-line"
			aria-labelledby="personal-information-title"
		>
			<h2 id="personal-information-title" className="sr-only">
				Personal information
			</h2>
			<div className="grid gap-x-4 gap-y-2.5 p-4 sm:grid-cols-2">
				<InfoItem icon={<IconCode />} className="relative z-1 sm:col-span-2">
					{profile.role} <span className="font-medium">@{profile.company}</span>
				</InfoItem>
				<InfoItem icon={<IconMapPin />}>
					<a
						className="profile-link"
						href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.location)}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						{profile.location}
					</a>
				</InfoItem>
				<LocalTime />
				<InfoItem icon={<IconMail />}>
					<a
						className="profile-link break-all"
						href={`mailto:${profile.email}`}
					>
						{profile.email}
					</a>
				</InfoItem>
				<InfoItem icon={<IconPhone />}>
					<span aria-label="Phone number placeholder">{profile.phone}</span>
				</InfoItem>
			</div>
			<div
				className="pointer-events-none absolute top-12 right-1/2 bottom-4 -z-1 hidden w-px -translate-x-2.25 border-r border-dashed border-line sm:block"
				aria-hidden="true"
			/>
		</section>
	)
}

const socialIcons = {
	x: IconBrandX,
	github: IconBrandGithub,
	linkedin: IconBrandLinkedin,
}

export function SocialLinks() {
	return (
		<section
			className="screen-line-bottom relative border-x border-line p-4"
			aria-label="Social links"
		>
			<ul className="flex flex-wrap gap-2">
				{profile.socials.map((social) => {
					const Icon = socialIcons[social.name]
					return (
						<li key={social.name}>
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											className="social-link"
											variant="outline"
											size="icon"
											nativeButton={false}
											render={
												<a
													href={social.href}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={social.label}
												/>
											}
										/>
									}
								>
									<Icon aria-hidden="true" />
								</TooltipTrigger>
								<TooltipContent>{social.label}</TooltipContent>
							</Tooltip>
						</li>
					)
				})}
			</ul>
			<HandwrittenNote className="-top-7 right-full mr-4 hidden w-20 flex-col items-end lg:flex">
				<span className="-rotate-6">follow me</span>
				<HandwrittenArrow className="size-7 translate-x-3 -scale-x-100 -rotate-6" />
			</HandwrittenNote>
		</section>
	)
}
