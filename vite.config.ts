import { defineConfig, lazyPlugins } from 'vite-plus'

import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import babel from '@rolldown/plugin-babel'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

import { nitro } from 'nitro/vite'

const ignorePatterns = [
	'**/node_modules/**',
	'**/dist/**',
	'**/dist-ssr/**',
	'**/build/**',
	'**/coverage/**',
	'**/.output/**',
	'**/.nitro/**',
	'**/.vinxi/**',
	'**/.tanstack/**',
	'**/.vite/**',
	'**/.wrangler/**',
	'**/routeTree.gen.ts',
]

const config = defineConfig({
	staged: {
		'*': 'vp check --fix',
	},
	fmt: {
		ignorePatterns,
		endOfLine: 'lf',
		semi: false,
		singleQuote: true,
		useTabs: true,
		tabWidth: 2,
		trailingComma: 'es5',
		printWidth: 80,
		sortPackageJson: {
			sortScripts: true,
		},
		sortImports: {
			newlinesBetween: true,
			customGroups: [
				{
					groupName: 'vite-plus',
					elementNamePattern: ['vite-plus', 'vite-plus/**'],
				},
				{ groupName: 'tanstack', elementNamePattern: ['@tanstack/**'] },
				{
					groupName: 'react',
					elementNamePattern: ['react', 'react/**', 'react-**', 'react-*/**'],
				},
				{
					groupName: 'vite-tooling',
					elementNamePattern: ['vite', 'vite/**', '@vitejs/**', '@rolldown/**'],
				},
				{
					groupName: 'tailwind',
					elementNamePattern: [
						'tailwindcss',
						'tailwindcss/**',
						'@tailwindcss/**',
					],
				},
				{ groupName: 'nitro', elementNamePattern: ['nitro', 'nitro/**'] },
				{ groupName: 'local-libs', elementNamePattern: ['#/**', '@/**'] },
			],
			groups: [
				'vite-plus',
				'tanstack',
				'react',
				'vite-tooling',
				'tailwind',
				'nitro',
				'builtin',
				'external',
				'local-libs',
				['internal', 'subpath'],
				['parent', 'sibling', 'index'],
				'style',
				'unknown',
			],
			internalPattern: ['#/', '@/'],
		},
	},
	lint: {
		ignorePatterns,
		jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
		rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
		options: { typeAware: true, typeCheck: true },
	},
	resolve: { tsconfigPaths: true },
	plugins: lazyPlugins(() => [
		devtools(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart({
			router: {
				quoteStyle: 'double',
				semicolons: true,
			},
		}),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	]),
})

export default config
