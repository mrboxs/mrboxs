Welcome to your new TanStack Start app!

# Getting Started

Install the [global Vite+ CLI](https://viteplus.dev/guide/#install-vp-globally) before running project commands. On macOS or Linux:

```bash
curl -fsSL https://vite.plus | bash
```

For Windows, use the PowerShell installer in the linked installation guide. Open a new terminal after installation and run `vp help` to verify that the CLI is available.

Then, from the project directory:

```bash
vp install
vp run dev
```

## Editor Setup (TSRS)

Run `vp install` before opening the project so both editors can use the TSRS version pinned in the lockfile.

- **VS Code:** Install the recommended [TypeScript 7 extension](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview). The workspace points its native SDK at `node_modules/tsrs/tsdk` on macOS/Linux. Trust the workspace and allow the workspace SDK when prompted, then run **TypeScript 7: Restart Server** or reload the window.
- **Zed:** Install [TypeScript Language Server](https://zed.dev/extensions/tsgo) (extension ID `tsgo`). The workspace configures its `typescript-ls` server to run `node_modules/.bin/tsrs --lsp --stdio` for JavaScript, JSX, TypeScript, and TSX, and disables `vtsls` and `typescript-language-server` for those languages. Run **editor: restart language server** after changing the settings.

Oxc remains the formatter and linter in both editors. See the [TSRS language server documentation](https://github.com/oxc-project/tsrs/blob/main/docs/LSP.md) for platform-specific setup and troubleshooting.

# Building For Production

To build this application for production:

```bash
vp run build
```

## Vite+ Tasks

Run project tasks with `vp run <name>`. Built-in commands such as `vp build` and `vp check` run their tools directly and bypass these task definitions and their cache.

| Task               | Purpose                                                 | Cache                                                       |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| `vp run dev`       | Start development on port 3000                          | Off                                                         |
| `vp run build`     | Build the client and Nitro server; generate route types | Project inputs; production output and generated route types |
| `vp run preview`   | Build if needed, then preview the production output     | Server off; build cached                                    |
| `vp run format`    | Format source files in place                            | Off                                                         |
| `vp run lint`      | Lint and type-check through Oxlint                      | Automatic                                                   |
| `vp run check`     | Check formatting, lint, and types                       | Automatic                                                   |
| `vp run typecheck` | Run the project's TSRS compiler only                    | Automatic inputs; no restored outputs                       |
| `vp run test`      | Run Vitest; supports forwarded options such as `watch`  | Off                                                         |
| `vp run verify`    | Run build, check, and test in sequence                  | Reuses each task's policy                                   |

`verify` builds first because TanStack generates route types during development/build. `check` already includes type-checking, so it does not run the standalone TSRS task again. The old `generate-routes` script was a full production build; use `vp run build` or `vp run dev` to generate routes.

The build task fingerprints project files, including configuration, the lockfile, and `.env*`, while excluding generated files and dependencies in `node_modules`. On a cache hit, it restores `.output/` for the default build or `dist/` for the `cloudflare-pages` and `cloudflare-pages-static` presets, plus `src/routeTree.gen.ts` in either case. This avoids Nitro's read/write artifacts and directory probes invalidating the cache when output is removed. Dependency versions are tracked through the lockfile; run `vp install` after changing dependencies.

Vite+ tracks `VITE_*` and `NODE_ENV` automatically. The build task additionally fingerprints Nitro environment settings, including `NITRO_PRESET`, its `SERVER_PRESET` fallback, and the compatibility date. The TSRS task fingerprints `TSRS_*` settings. Package-manager lifecycle scripts such as `prepare` remain uncached by default.

The build command clears `CODEX_TOOL_CALL_ID` for its child process: Vite+ 1.5.1 otherwise fingerprints this per-invocation agent metadata and unnecessarily rebuilds between agent commands.

Vitest enables the React plugin without starting Nitro, TanStack Start, or devtools servers. This keeps unit tests from running the application's server lifecycle.

Use `vp run --no-cache <name>` to force an execution, `vp run -v <name>` for cache details, and `vp cache clean` to clear the task cache. A failed task is not cached. The repository currently has no test files; `test` and `verify` report that failure instead of treating missing tests as success.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
vp run build
node .output/server/index.mjs
```

The build output is a self-contained Node server. To deploy, push the `.output/` directory to your host (Render, Fly.io, your own VPS, etc.) and run the server command above.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see https://v3.nitro.build/deploy.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'My App' },
		],
	}),
	shellComponent: ({ children }) => (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<header>
					<nav>
						<Link to="/">Home</Link>
						<Link to="/about">About</Link>
					</nav>
				</header>
				{children}
				<Scripts />
			</body>
		</html>
	),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
	method: 'GET',
}).handler(async () => {
	return new Date().toISOString()
})

// Use in a component
function MyComponent() {
	const [time, setTime] = useState('')

	useEffect(() => {
		getServerTime().then(setTime)
	}, [])

	return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
	server: {
		handlers: {
			GET: () => json({ message: 'Hello, World!' }),
		},
	},
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
	loader: async () => {
		const response = await fetch('https://swapi.dev/api/people')
		return response.json()
	},
	component: PeopleComponent,
})

function PeopleComponent() {
	const data = Route.useLoaderData()
	return (
		<ul>
			{data.results.map((person) => (
				<li key={person.name}>{person.name}</li>
			))}
		</ul>
	)
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
