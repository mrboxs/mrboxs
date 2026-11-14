import { about } from '#/data/about'

export function About() {
	return (
		<section
			id="about"
			className="screen-line-bottom relative isolate border-x border-line"
			aria-labelledby="about-title"
		>
			<header className="screen-line-bottom px-4">
				<h2
					id="about-title"
					className="screen-line-top font-heading text-3xl font-medium tracking-tight text-balance"
				>
					{about.title}
				</h2>
			</header>
			<div className="flex flex-col gap-4 p-4 text-base/7">
				{about.paragraphs.map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
				<p>
					<strong className="font-semibold">{about.closing}</strong>
				</p>
			</div>
		</section>
	)
}
