import { createFileRoute } from '@tanstack/react-router'

import { About } from '#/components/portfolio/about'
import { Blog } from '#/components/portfolio/blog'
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
import { Projects } from '#/components/portfolio/projects'
import { homeHead } from '#/lib/seo'

export const Route = createFileRoute('/')({ head: homeHead, component: Home })

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
				<Projects />
				<SectionSeparator />
				<Blog />
			</div>
		</main>
	)
}
