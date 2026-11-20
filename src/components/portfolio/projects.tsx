import { useState } from 'react'

import { IconChevronDown, IconInfinity, IconLink } from '@tabler/icons-react'

import { MrBoxsMark } from '#/components/custom/mrboxs-mark'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#/components/ui/tooltip'
import { projects, type Project } from '#/data/projects'

const panelMotion =
	'h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none'

function monthLabel(date: string) {
	const [year, month] = date.split('-')
	return `${month}.${year}`
}

function ProjectPeriod({ period }: Pick<Project, 'period'>) {
	return (
		<dl className="text-sm text-muted-foreground">
			<dt className="sr-only">Period</dt>
			<dd className="flex flex-wrap items-center gap-0.5">
				<time dateTime={period.start}>{monthLabel(period.start)}</time>
				{period.end !== period.start && (
					<>
						<span aria-hidden="true" className="font-mono">
							-
						</span>
						<span className="sr-only"> to </span>
						{period.end ? (
							<time dateTime={period.end}>{monthLabel(period.end)}</time>
						) : (
							<>
								<IconInfinity
									aria-hidden="true"
									className="size-4.5 translate-y-px"
								/>
								<span className="sr-only">Present</span>
							</>
						)}
					</>
				)}
			</dd>
		</dl>
	)
}

function ProjectItem({ project }: { project: Project }) {
	const [open, setOpen] = useState(false)

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<div className="relative flex items-center transition-colors focus-within:bg-muted/40 hover:bg-muted/40 motion-reduce:transition-none">
				<div className="info-icon mx-4" aria-hidden="true">
					<MrBoxsMark />
				</div>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 border-l border-dashed border-line p-4">
					<div className="min-w-0 flex-1 basis-28">
						<h3 className="mb-1 leading-snug font-medium text-balance wrap-anywhere">
							<CollapsibleTrigger className="group/project-trigger cursor-pointer text-left outline-none">
								<span
									aria-hidden="true"
									className="absolute inset-0 group-focus-visible/project-trigger:outline-2 group-focus-visible/project-trigger:-outline-offset-2 group-focus-visible/project-trigger:outline-foreground"
								/>
								{project.title}
							</CollapsibleTrigger>
						</h3>
						<ProjectPeriod period={project.period} />
					</div>
					<Tooltip>
						<TooltipTrigger
							render={
								<a
									href={project.link}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`Open ${project.title} on GitHub`}
									className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none md:pointer-fine:size-6"
								>
									<IconLink
										aria-hidden="true"
										className="pointer-events-none size-4"
									/>
								</a>
							}
						/>
						<TooltipContent className="motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none">
							Open project
						</TooltipContent>
					</Tooltip>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
						className="pointer-events-none size-4 shrink-0 text-muted-foreground"
					>
						<path d={open ? 'm7 4 5 5 5-5' : 'm7 9 5-5 5 5'} />
						<path d={open ? 'm7 20 5-5 5 5' : 'm7 15 5 5 5-5'} />
					</svg>
				</div>
			</div>
			<CollapsibleContent className={panelMotion}>
				<div className="flex flex-col gap-4 border-t border-line p-4">
					<p className="text-sm/6 wrap-anywhere">{project.description}</p>
					{project.skills.length > 0 && (
						<ul
							aria-label={`${project.title} technologies`}
							className="flex flex-wrap gap-1.5"
						>
							{project.skills.map((skill) => (
								<li key={skill} className="flex max-w-full min-w-0">
									<Badge
										variant="secondary"
										className="h-auto min-h-5 max-w-full rounded-sm wrap-anywhere whitespace-normal"
									>
										{skill}
									</Badge>
								</li>
							))}
						</ul>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

export function Projects({
	items = projects,
}: {
	items?: ReadonlyArray<Project>
}) {
	const [showAll, setShowAll] = useState(false)

	return (
		<section
			id="projects"
			aria-labelledby="projects-title"
			className="screen-line-bottom screen-line-top relative isolate scroll-mt-14 border-x border-line"
		>
			<header className="screen-line-bottom border-line px-4">
				<h2
					id="projects-title"
					className="font-heading text-3xl font-medium tracking-tight text-balance wrap-anywhere"
				>
					Projects
					<sup className="top-[-0.75em] ml-1 text-sm font-medium tracking-normal text-muted-foreground">
						({items.length})
					</sup>
				</h2>
			</header>
			<Collapsible
				open={showAll}
				onOpenChange={setShowAll}
				className="group/project-list"
			>
				<ul aria-label="Projects">
					{items.slice(0, 4).map((project) => (
						<li key={project.id} className="border-b border-line">
							<ProjectItem project={project} />
						</li>
					))}
				</ul>
				{items.length === 0 && (
					<p className="p-4 text-sm text-muted-foreground">No projects yet.</p>
				)}
				{items.length > 4 && (
					<>
						<CollapsibleContent
							render={<ul aria-label="More projects" />}
							className={panelMotion}
						>
							{items.slice(4).map((project) => (
								<li key={project.id} className="border-b border-line">
									<ProjectItem project={project} />
								</li>
							))}
						</CollapsibleContent>
						<div className="screen-line-top -mt-px flex justify-center py-4">
							<CollapsibleTrigger
								render={
									<Button
										variant="secondary"
										className="min-h-11 gap-2 pr-2.5 pl-3 shadow-[inset_0_0_1px] shadow-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground focus-visible:outline-solid has-data-[icon=inline-end]:pr-2.5 motion-reduce:transition-none md:pointer-fine:min-h-8"
									/>
								}
							>
								{showAll ? 'Show less' : 'Show more'}
								<IconChevronDown
									aria-hidden="true"
									data-icon="inline-end"
									className="group-data-open/project-list:rotate-180"
								/>
							</CollapsibleTrigger>
						</div>
					</>
				)}
			</Collapsible>
		</section>
	)
}
