import type { Plugin } from 'vite-plus'

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const virtualId = 'virtual:vercel-og-worker'
const resolvedId = `\0${virtualId}`
const entry = new URL(
	'../node_modules/@vercel/og/dist/index.edge.js',
	import.meta.url
)

// @vercel/og's edge entry fetches its fallback font at import time. Workers
// require request-time I/O, so use a local Data module and the compiled WASM.
export function vercelOgWorker(): Plugin {
	return {
		name: 'vercel-og-worker',
		enforce: 'pre',
		config: () => ({
			resolve: { alias: [{ find: '@vercel/og', replacement: virtualId }] },
			optimizeDeps: { exclude: ['@vercel/og', virtualId] },
		}),
		resolveId(source) {
			if (source === virtualId) return resolvedId
		},
		async load(id) {
			if (id !== resolvedId) return
			this.addWatchFile(fileURLToPath(entry))
			const source = await readFile(entry, 'utf8')
			const fallback =
				/var fallbackFont = fetch\(\s*new URL\("\.\/Geist-Regular\.ttf", import\.meta\.url\)\s*\)\.then\(\(res\) => res\.arrayBuffer\(\)\);/
			if (!fallback.test(source)) {
				this.error(
					'@vercel/og changed its font loader. Review the Worker adapter.'
				)
			}
			const font = fileURLToPath(
				new URL('../src/assets/og/geist-regular.bin', import.meta.url)
			)
			const resvg = `${fileURLToPath(new URL('./resvg.wasm', entry))}?module`
			const yoga = `${fileURLToPath(new URL('./yoga.wasm', entry))}?module`
			return source
				.replace(
					'import resvg_wasm from "./resvg.wasm?module";',
					`import resvg_wasm from ${JSON.stringify(resvg)};`
				)
				.replace(
					'import yoga_wasm from "./yoga.wasm?module";',
					`import yoga_wasm from ${JSON.stringify(yoga)};`
				)
				.replace(fallback, 'var fallbackFont = Promise.resolve(workerFont);')
				.replace(/^/, `import workerFont from ${JSON.stringify(font)};\n`)
		},
	}
}
