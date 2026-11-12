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

const lintPlugins = [
	'typescript',
	'unicorn',
	'oxc',
	'react',
	'jsx-a11y',
	'import',
	'promise',
] as const

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
		env: {
			node: true,
		},
		categories: {
			correctness: 'error',
		},
		plugins: [...lintPlugins],
		jsPlugins: [
			{
				name: 'vite-plus',
				specifier: 'vite-plus/oxlint-plugin',
			},
			{
				name: 'react-hooks-js',
				specifier: 'eslint-plugin-react-hooks',
			},
			{
				name: 'eslint-tanstack-router',
				specifier: '@tanstack/eslint-plugin-router',
			},
			{
				name: 'eslint-tanstack-query',
				specifier: '@tanstack/eslint-plugin-query',
			},
		],
		rules: {
			// Vite+
			'vite-plus/prefer-vite-plus-imports': 'error',

			// TanStack Router and Query
			'eslint-tanstack-query/exhaustive-deps': 'error',
			'eslint-tanstack-query/infinite-query-property-order': 'error',
			'eslint-tanstack-query/mutation-property-order': 'error',
			'eslint-tanstack-query/no-rest-destructuring': 'error',
			'eslint-tanstack-query/no-unstable-deps': 'error',
			'eslint-tanstack-query/prefer-query-options': 'warn',
			'eslint-tanstack-query/stable-query-client': 'error',
			'eslint-tanstack-router/create-route-property-order': 'error',
			'eslint-tanstack-router/route-param-names': 'error',

			// React
			// Keep the JS plugin only for compiler checks not implemented natively.
			'react-hooks-js/config': 'error',
			'react-hooks-js/gating': 'error',
			'react/exhaustive-deps': 'warn',
			'react/jsx-fragments': ['error', 'syntax'],
			'react/no-unknown-property': 'error',
			'react/rules-of-hooks': 'error',
			'react/set-state-in-effect': 'warn',
			'react/unsupported-syntax': 'error',

			// Accessibility
			'jsx-a11y/no-aria-hidden-on-focusable': 'error',
			'jsx-a11y/no-redundant-roles': 'error',

			// JavaScript
			'eslint/array-callback-return': 'error',
			'eslint/curly': ['error', 'multi-line'],
			'eslint/eqeqeq': ['error', 'always', { null: 'ignore' }],
			'eslint/no-array-constructor': 'error',
			'eslint/no-case-declarations': 'error',
			'eslint/no-console': ['warn', { allow: ['debug', 'warn', 'error'] }],
			'eslint/no-else-return': 'error',
			'eslint/no-empty-function': 'error',
			'eslint/no-fallthrough': 'error',
			'eslint/no-regex-spaces': 'error',
			'eslint/no-shadow': 'warn',
			'eslint/no-undef': 'error',
			'eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'eslint/no-var': 'error',
			'eslint/prefer-const': 'error',
			'eslint/prefer-object-spread': 'error',
			'eslint/prefer-rest-params': 'error',
			'eslint/prefer-spread': 'error',
			'eslint/yoda': 'warn',

			// Imports
			'import/first': 'error',
			'import/no-commonjs': 'error',
			'import/no-duplicates': 'error',

			// TypeScript
			'typescript/adjacent-overload-signatures': 'error',
			'typescript/array-type': [
				'error',
				{ default: 'generic', readonly: 'generic' },
			],
			'typescript/ban-ts-comment': [
				'error',
				{
					'ts-expect-error': 'allow-with-description',
					'ts-ignore': 'allow-with-description',
				},
			],
			'typescript/ban-tslint-comment': 'error',
			'typescript/class-literal-property-style': 'error',
			'typescript/consistent-generic-constructors': 'error',
			'typescript/consistent-indexed-object-style': ['error', 'record'],
			'typescript/consistent-type-assertions': 'error',
			'typescript/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports' },
			],
			'typescript/dot-notation': 'error',
			'typescript/no-confusing-non-null-assertion': 'error',
			'typescript/no-deprecated': 'warn',
			'typescript/no-empty-object-type': 'error',
			'typescript/no-explicit-any': ['error', { ignoreRestArgs: true }],
			'typescript/no-inferrable-types': ['error', { ignoreParameters: true }],
			'typescript/no-misused-promises': 'error',
			'typescript/no-namespace': 'error',
			'typescript/no-require-imports': 'error',
			'typescript/no-unnecessary-condition': 'error',
			'typescript/no-unnecessary-type-assertion': 'error',
			'typescript/no-unnecessary-type-constraint': 'error',
			'typescript/no-unsafe-argument': 'error',
			'typescript/no-unsafe-assignment': 'error',
			'typescript/no-unsafe-call': 'error',
			'typescript/no-unsafe-enum-comparison': 'error',
			'typescript/no-unsafe-function-type': 'error',
			'typescript/no-unsafe-member-access': 'error',
			'typescript/no-unsafe-return': 'error',
			'typescript/non-nullable-type-assertion-style': 'error',
			'typescript/only-throw-error': 'error',
			'typescript/prefer-find': 'error',
			'typescript/prefer-for-of': 'warn',
			'typescript/prefer-function-type': 'error',
			'typescript/prefer-includes': 'error',
			'typescript/prefer-nullish-coalescing': 'error',
			'typescript/prefer-optional-chain': 'error',
			'typescript/prefer-promise-reject-errors': 'error',
			'typescript/prefer-regexp-exec': 'error',
			'typescript/prefer-string-starts-ends-with': 'error',
			'typescript/require-await': 'warn',
			'typescript/restrict-plus-operands': 'error',
			'typescript/switch-exhaustiveness-check': 'error',

			// Unicorn
			'unicorn/escape-case': 'warn',
			'unicorn/explicit-length-check': 'warn',
			'unicorn/no-array-reverse': 'warn',
			'unicorn/no-array-sort': 'warn',
			'unicorn/prefer-array-flat-map': 'error',
			'unicorn/switch-case-braces': ['error', 'avoid'],
			'unicorn/throw-new-error': 'error',
		},
		overrides: [
			{
				files: ['src/**/*.{js,jsx,ts,tsx,mjs,mts}'],
				env: {
					browser: true,
				},
			},
			{
				files: ['**/*.{ts,tsx,mts,cts}'],
				// These diagnostics are already covered by typeCheck for TypeScript.
				rules: {
					'eslint/constructor-super': 'off',
					'eslint/getter-return': 'off',
					'eslint/no-const-assign': 'off',
					'eslint/no-dupe-class-members': 'off',
					'eslint/no-dupe-keys': 'off',
					'eslint/no-func-assign': 'off',
					'eslint/no-import-assign': 'off',
					'eslint/no-new-native-nonconstructor': 'off',
					'eslint/no-obj-calls': 'off',
					'eslint/no-setter-return': 'off',
					'eslint/no-this-before-super': 'off',
					'eslint/no-undef': 'off',
					'eslint/no-unsafe-negation': 'off',
				},
			},
			{
				files: [
					'**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts}',
					'**/__tests__/**/*.{js,jsx,ts,tsx}',
				],
				plugins: [...lintPlugins, 'vitest'],
				rules: {
					'vitest/consistent-test-it': [
						'error',
						{
							fn: 'it',
						},
					],
					'vitest/no-focused-tests': 'error',
					'vitest/valid-expect': 'error',
					'vitest/valid-title': 'error',
				},
			},
			{
				files: [
					'*.config.{js,ts,mjs,mts,cjs,cts}',
					'scripts/**/*.{js,ts,mjs,mts,cjs,cts}',
				],
				rules: {
					'eslint/no-console': 'off',
				},
			},
		],
		options: {
			typeAware: true,
			typeCheck: true,
		},
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
