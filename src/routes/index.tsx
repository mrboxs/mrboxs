import { createFileRoute } from '@tanstack/react-router'

import { About } from '#/components/portfolio/about'
import {
	FrameWidthDimension,
	ProfileSeparator,
	SectionSeparator,
} from '#/components/portfolio/dimensions'
import { GitHubContributions } from '#/components/portfolio/github-contributions'
import {
	PersonalInformation,
	SocialLinks,
} from '#/components/portfolio/personal-information'
import { ProfileHeader } from '#/components/portfolio/profile-header'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
	return (
		<main id="main-content" className="portfolio-page min-h-dvh pt-14">
			<div className="mx-auto max-w-3xl">
				<FrameWidthDimension />
				<ProfileHeader />
				<ProfileSeparator />
				<PersonalInformation />
				<SocialLinks />
				<SectionSeparator />
				<About />
				<SectionSeparator />
				<GitHubContributions />
				<SectionSeparator />
			</div>
		</main>
	)
}
