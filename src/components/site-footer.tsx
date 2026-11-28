import { Link } from '@tanstack/react-router'

import type { ReactNode } from 'react'

import { IconBrandCloudflare } from '@tabler/icons-react'

import wordmark from '#/assets/mrboxs-wordmark.svg?url'
import voidWordmark from '#/assets/void-wordmark.svg?url'
import { MrBoxsMark } from '#/components/custom/mrboxs-mark'
import { profile } from '#/data/profile'

const repository = 'https://github.com/mrboxs/mrboxs'
const footerLink =
	'rounded-sm underline decoration-border underline-offset-3 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const platforms = [
	'TanStack Start',
	'React',
	'Base UI',
	'shadcn/ui',
	'Tailwind CSS',
]

function FooterField({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) {
	return (
		<div className="min-w-0">
			<dt className="mb-1 text-[0.6875rem]/4 tracking-wider text-muted-foreground uppercase">
				{label}
			</dt>
			<dd className="text-sm/6 wrap-anywhere">{children}</dd>
		</div>
	)
}

export function SiteFooter() {
	return (
		<footer className="overflow-x-clip border-y border-line">
			<div className="relative isolate mx-auto max-w-3xl border-x border-line">
				<div
					aria-hidden="true"
					className="stripe-divider screen-line-bottom h-12 [&::before]:[mask-image:linear-gradient(to_bottom,black_25%,transparent)]"
				/>
				<div className="screen-line-bottom flex flex-col gap-2 px-4 pt-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
					<Link
						to="/"
						aria-label={`${profile.displayName} home`}
						className="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						<img
							src={wordmark}
							alt=""
							width={354}
							height={100}
							className="h-9 w-auto dark:invert"
						/>
					</Link>
					<p className="text-sm text-muted-foreground">{profile.taglines[0]}</p>
				</div>

				<div className="grid grid-cols-1 font-mono sm:grid-cols-2">
					<dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line p-4 sm:border-r">
						<FooterField label="Crafted by">
							<a
								href={`https://github.com/${profile.githubUsername}`}
								className={footerLink}
							>
								@{profile.githubUsername}
							</a>
						</FooterField>
						<FooterField label="Source code">
							<a href={repository} className={footerLink}>
								GitHub
							</a>
						</FooterField>
					</dl>
					<dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line p-4">
						<FooterField label="Based in">{profile.location}</FooterField>
						<FooterField label="Content">
							<Link to="/blog" className={footerLink}>
								Blog
							</Link>
						</FooterField>
					</dl>

					<dl className="grid grid-cols-2 content-start gap-x-4 gap-y-5 border-b border-line p-4 sm:border-r">
						<FooterField label="Deploy on">
							<a
								href="https://workers.cloudflare.com/"
								aria-label="Cloudflare Workers"
								className="inline-flex min-h-6 items-center rounded-sm hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								<IconBrandCloudflare className="size-5" aria-hidden="true" />
							</a>
						</FooterField>
						<FooterField label="Deploy with">
							<a
								href="https://void.cloud/"
								aria-label="Void"
								className="inline-flex min-h-6 items-center rounded-sm hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								<img
									src={voidWordmark}
									alt=""
									width={270}
									height={58}
									className="h-3 w-auto dark:invert"
								/>
							</a>
						</FooterField>
						<FooterField label="Stack">
							<ul>
								{platforms.map((platform) => (
									<li key={platform}>{platform}</li>
								))}
							</ul>
						</FooterField>
						<FooterField label="Builds">
							<a href={`${repository}/actions`} className={footerLink}>
								GitHub Actions
							</a>
						</FooterField>
					</dl>
					<dl className="grid grid-cols-2 content-start gap-x-4 gap-y-5 border-b border-line p-4">
						<FooterField label="Typeface">
							<ul>
								<li>Geist</li>
								<li>Paper Mono</li>
							</ul>
						</FooterField>
						<FooterField label="Site index">
							<a href="/sitemap.xml" className={footerLink}>
								sitemap.xml
							</a>
						</FooterField>
						<FooterField label="For agents">
							<ul>
								<li>
									<a href="/llms.txt" className={footerLink}>
										llms.txt
									</a>
								</li>
								<li>
									<a href="/llms-full.txt" className={footerLink}>
										llms-full.txt
									</a>
								</li>
							</ul>
						</FooterField>
						<FooterField label="Contact">
							<a href={`mailto:${profile.email}`} className={footerLink}>
								Email
							</a>
						</FooterField>
					</dl>

					<dl className="border-b border-line p-4 sm:border-r sm:border-b-0">
						<FooterField label="Design credit">
							<a href="https://chanhdai.com/" className={footerLink}>
								chanhdai
							</a>
						</FooterField>
					</dl>
					<dl className="grid grid-cols-2 gap-x-4 p-4">
						<FooterField label="Links">
							<ul>
								{profile.socials
									.filter(({ name }) => name !== 'linkedin')
									.map(({ name, label, href }) => (
										<li key={name}>
											<a href={href} className={footerLink}>
												{label}
											</a>
										</li>
									))}
							</ul>
						</FooterField>
						<FooterField label="Approved by">
							<MrBoxsMark className="mt-2 size-12" />
							<span className="block border-t border-line pt-1 font-sans text-xs uppercase">
								{profile.displayName}
							</span>
						</FooterField>
					</dl>
				</div>
			</div>
		</footer>
	)
}
