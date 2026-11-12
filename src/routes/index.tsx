import { createFileRoute } from '@tanstack/react-router'

import { MrBoxsSpotlightLogo } from '#/components/custom/mrboxs-spotlight-logo'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
	return (
		<div className="p-8">
			<div className="size-250">
				<MrBoxsSpotlightLogo />
			</div>
		</div>
	)
}
