import { createFileRoute } from '@tanstack/react-router'

import {
	FrameWidthDimension,
	ProfileSeparator,
} from '#/components/portfolio/dimensions'
import {
	PersonalInformation,
	SocialLinks,
} from '#/components/portfolio/personal-information'
import { ProfileHeader } from '#/components/portfolio/profile-header'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
	return (
		<main id="main-content" className="portfolio-page min-h-dvh pt-15">
			<div className="mx-auto max-w-3xl">
				<FrameWidthDimension />
				<ProfileHeader />
				<ProfileSeparator />
				<PersonalInformation />
				<SocialLinks />
			</div>
		</main>
	)
}
