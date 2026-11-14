import { useQuery } from '@tanstack/react-query'

import type { KeyboardEvent } from 'react'
import { useId, useState } from 'react'

import {
	type Activity,
	ContributionGraph,
	ContributionGraphBlock,
	ContributionGraphCalendar,
	ContributionGraphFooter,
	ContributionGraphLegend,
} from '#/components/custom/github-contribution-graph'
import { Button } from '#/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import { githubContributionsQuery } from '#/data/github-contributions'
import { profile } from '#/data/profile'
import type { GitHubContributionData } from '#/lib/github-contributions'

const dateFormat = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
})
const countFormat = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
})
const githubUrl = `https://github.com/${profile.githubUsername}`

function formatDate(date: string) {
	return dateFormat.format(new Date(date))
}

function navigateDays(event: KeyboardEvent<HTMLElement>) {
	const figure = event.currentTarget.closest('figure')
	if (!figure) return
	const cells = Array.from(
		figure.querySelectorAll<SVGElement>('[data-contribution-day]')
	)
	const currentIndex = cells.findIndex(
		(cell) => cell === document.activeElement
	)
	if (currentIndex < 0) return

	const moves: Partial<Record<string, number>> = {
		ArrowLeft: -7,
		ArrowRight: 7,
		ArrowUp: -1,
		ArrowDown: 1,
		Home: -cells.length,
		End: cells.length,
	}
	const movement = moves[event.key]
	if (movement === undefined) return
	event.preventDefault()
	cells[
		Math.max(0, Math.min(cells.length - 1, currentIndex + movement))
	]?.focus()
}

function ContributionDay({
	activity,
	dayIndex,
	weekIndex,
	isTabStop,
	onFocus,
}: {
	activity: Activity
	dayIndex: number
	weekIndex: number
	isTabStop: boolean
	onFocus: () => void
}) {
	const label = `${activity.count} contribution${activity.count === 1 ? '' : 's'} on ${formatDate(activity.date)}`
	const triggerId = useId()
	const [open, setOpen] = useState(false)

	return (
		<Tooltip open={open} onOpenChange={setOpen} triggerId={triggerId}>
			<TooltipTrigger
				id={triggerId}
				render={<g />}
				className="contribution-day"
				tabIndex={isTabStop ? 0 : -1}
				aria-label={label}
				aria-describedby={open ? `${triggerId}-description` : undefined}
				data-contribution-day={activity.date}
				onFocus={onFocus}
				onKeyDown={navigateDays}
				onPointerUp={(event) => {
					if (event.pointerType === 'touch') {
						event.currentTarget.focus()
						setOpen(true)
					}
				}}
				closeOnClick={false}
			>
				<ContributionGraphBlock
					activity={activity}
					dayIndex={dayIndex}
					weekIndex={weekIndex}
					style={{ fill: `var(--contribution-${activity.level})` }}
				/>
			</TooltipTrigger>
			<TooltipContent
				id={`${triggerId}-description`}
				role="tooltip"
				collisionAvoidance={{ side: 'flip', align: 'shift' }}
				collisionPadding={8}
				className="motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
			>
				{label}
			</TooltipContent>
		</Tooltip>
	)
}

function ActivityGraph({ data }: { data: GitHubContributionData }) {
	const [focusedDate, setFocusedDate] = useState<string | null>(null)
	const tabStop = focusedDate ?? data.to
	const total = countFormat.format(data.total)
	const from = data.from ? formatDate(data.from) : ''
	const to = data.to ? formatDate(data.to) : ''

	return (
		<figure>
			<p className="sr-only" id="contribution-instructions">
				Use the arrow keys to explore daily contributions. Left and right move
				by a week. Home and End move to the first and last days.
			</p>
			<ContributionGraph
				className="w-full gap-4"
				data={data.contributions}
				blockSize={12}
				blockMargin={2}
				blockRadius={0}
				fontSize={14}
				aria-label={`GitHub activity for ${profile.githubUsername}`}
				aria-describedby="contribution-instructions"
			>
				<ContributionGraphCalendar className="contribution-calendar text-muted-foreground">
					{({ activity, dayIndex, weekIndex }) => (
						<ContributionDay
							activity={activity}
							dayIndex={dayIndex}
							weekIndex={weekIndex}
							isTabStop={activity.date === tabStop}
							onFocus={() => setFocusedDate(activity.date)}
						/>
					)}
				</ContributionGraphCalendar>
				<ContributionGraphFooter className="items-center justify-between gap-y-2 text-sm text-muted-foreground">
					<figcaption className="min-w-0 whitespace-normal tabular-nums">
						<span title={`${data.total.toLocaleString('en-US')} contributions`}>
							{total} contributions
						</span>
						, {from} – {to}. Source:{' '}
						<a
							className="profile-link underline decoration-current/50"
							href={githubUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
						.
					</figcaption>
					<ContributionGraphLegend aria-hidden="true">
						{({ level }) => (
							<svg width="12" height="12" viewBox="0 0 12 12">
								<rect
									width="12"
									height="12"
									style={{ fill: `var(--contribution-${level})` }}
								/>
							</svg>
						)}
					</ContributionGraphLegend>
				</ContributionGraphFooter>
			</ContributionGraph>
		</figure>
	)
}

export function GitHubContributions() {
	const { data, isPending, isFetching, refetch } = useQuery(
		githubContributionsQuery
	)

	return (
		<section
			id="github-contributions"
			className="screen-line-bottom screen-line-top relative isolate border-x border-line p-4"
			aria-labelledby="github-contributions-title"
			aria-busy={isPending}
		>
			<h2 id="github-contributions-title" className="sr-only">
				GitHub contributions
			</h2>
			{data && data.contributions.length > 0 ? (
				<ActivityGraph data={data} />
			) : (
				<div
					className="flex min-h-37 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground"
					aria-live="polite"
				>
					{isPending ? (
						<p>Loading GitHub activity…</p>
					) : data ? (
						<>
							<p>No GitHub activity to display yet.</p>
							<a
								className="profile-link underline underline-offset-3"
								href={githubUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								View GitHub profile
							</a>
						</>
					) : (
						<>
							<p>Couldn't load GitHub activity.</p>
							<Button
								className="contribution-retry"
								variant="outline"
								size="sm"
								disabled={isFetching}
								onClick={() => {
									void refetch()
								}}
							>
								{isFetching ? 'Retrying…' : 'Try again'}
							</Button>
						</>
					)}
				</div>
			)}
		</section>
	)
}
