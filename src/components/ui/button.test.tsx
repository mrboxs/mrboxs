import { expect, it } from 'vite-plus/test'

import { renderToStaticMarkup } from 'react-dom/server'

import { Button } from './button'

it.each([false, true])(
	'passes disabled=%s to className callbacks',
	(disabled) => {
		const markup = renderToStaticMarkup(
			<Button
				disabled={disabled}
				variant="outline"
				size="lg"
				className={(state) => (state.disabled ? 'w-full' : 'w-auto')}
			>
				Save
			</Button>
		)

		expect(markup).toContain(disabled ? 'w-full' : 'w-auto')
		expect(markup).toContain('inline-flex')
		expect(markup).toContain('border-border')
		expect(markup).toContain('h-9')
	}
)

it('preserves string class names and their overrides', () => {
	const markup = renderToStaticMarkup(
		<Button className="h-12 w-full">Save</Button>
	)

	expect(markup).toContain('w-full')
	expect(markup).toContain('h-12')
	expect(markup).not.toContain('h-8')
	expect(markup).toContain('bg-primary')
})

it('keeps variant styles when a className callback returns undefined', () => {
	const markup = renderToStaticMarkup(
		<Button className={() => undefined}>Save</Button>
	)

	expect(markup).toContain('inline-flex')
	expect(markup).toContain('bg-primary')
	expect(markup).toContain('h-8')
})
