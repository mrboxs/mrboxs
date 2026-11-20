export interface Project {
	id: string
	title: string
	link: string
	period: { start: string; end?: string }
	description: string
	skills: ReadonlyArray<string>
}

export const projects = [
	{
		id: 'mrboxs',
		title: 'mrboxs',
		link: 'https://github.com/mrboxs/mrboxs',
		period: { start: '2026-11' },
		description:
			'My personal portfolio and blog, built with React and TanStack Start. It includes a GitHub contribution graph, searchable Markdown posts, a table of contents, and image previews.',
		skills: [
			'TypeScript',
			'React',
			'TanStack Start',
			'TanStack Query',
			'Void',
			'Tailwind CSS',
			'shadcn/ui',
			'Vite+',
			'Cloudflare Workers',
		],
	},
] as const satisfies ReadonlyArray<Project>
