TanStack Start app with Void on Cloudflare Workers, using Vite+ and Bun.

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

Vite+ uses Node.js from `.node-version` and Bun from `devEngines.packageManager` in `package.json`. Installation configures Git hooks and runs `void prepare` to generate the ignored `.void/tsconfig.json` and Void types. The Void CLI requires Node.js 24.22+ or 26.12+.

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

| Task               | Purpose                                                | Cache                                             |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------- |
| `vp run dev`       | Start development on port 3000                         | Off                                               |
| `vp run build`     | Build the client and Cloudflare Worker; generate types | Project inputs; Worker output and generated types |
| `vp run deploy`    | Build and deploy through Void to Cloudflare Workers    | Off                                               |
| `vp run preview`   | Build if needed, then preview the production output    | Server off; build cached                          |
| `vp run format`    | Format source files in place                           | Off                                               |
| `vp run lint`      | Lint and type-check through Oxlint                     | Automatic                                         |
| `vp run check`     | Check formatting, lint, and types                      | Automatic                                         |
| `vp run typecheck` | Run the project's TSRS compiler only                   | Automatic inputs; no restored outputs             |
| `vp run types`     | Regenerate Void types and TypeScript configuration     | Off                                               |
| `vp run test`      | Run Vitest; supports forwarded options such as `watch` | Off                                               |
| `vp run verify`    | Run build, check, and test in sequence                 | Reuses each task's policy                         |
| `vp run doctor`    | Run the installed React Doctor version                 | Off                                               |

`verify` builds first because TanStack generates route types during development/build. `check` already includes type-checking, so it does not run the standalone TSRS task again. The old `generate-routes` script was a full production build; use `vp run build` or `vp run dev` to generate routes.

Task definitions live in `vite.config.ts`; `package.json` keeps only the `prepare` lifecycle script and the `doctor` command. Vite+ rejects duplicate task/script names, so do not add a second `dev` or `build` script.

The build task fingerprints project files, including configuration, `void.lock.json`, the dependency lockfile, and `.env*`, while excluding generated files and dependencies. On a cache hit, it restores `dist/client/`, `dist/server/`, `.cloudflare/output/`, generated Void configuration and declarations, the preview pointer, and `src/routeTree.gen.ts`. It excludes local databases, login files, and deployment state from cached outputs. Run `vp install` after changing dependencies.

Vite+ tracks `VITE_*` and `NODE_ENV` automatically. The build task also fingerprints `VOID_*` and `CLOUDFLARE_*`, excluding `CLOUDFLARE_API_TOKEN`. The TSRS task fingerprints `TSRS_*`. The `check`, `lint`, and `typecheck` tasks run `types` first so Void declarations stay current. Package-manager lifecycle scripts such as `prepare` remain uncached by default.

The build command clears `CODEX_TOOL_CALL_ID` for its child process: Vite+ 1.5.1 otherwise fingerprints this per-invocation agent metadata and unnecessarily rebuilds between agent commands.

Vitest enables the React plugin without starting Void, TanStack Start, or devtools servers. These unit tests run in Node.js; Worker bindings need mocks or a separate runtime test setup.

Use `vp run --no-cache <name>` to force an execution, `vp run -v <name>` for cache details, and `vp cache clean` to clear the task cache. A failed task is not cached. Button regression tests cover state-dependent class-name callbacks and string overrides; `test` and `verify` run them through Vitest.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Deploy to Cloudflare Workers

Void provides the Cloudflare adapter. `voidPlugin()` must precede `tanstackStart()` in `vite.config.ts`. Worker settings live in `void.config.ts`; commit `void.lock.json` to preserve the selected account and resource identities. Generated `.void-wrangler.jsonc`, `.cloudflare/`, `.void/`, and `.wrangler/` stay ignored.

```bash
vp run deploy
```

This task explicitly selects `--platform cloudflare`, including on a fresh clone without `.void/project.json`. Void builds the Worker, provisions required resources, and publishes it. No separate build step is needed. To inspect the production build locally, use `vp run preview`.

`.github/workflows/void-deploy.yml` installs Vite+ and the pinned Node.js/Bun versions, installs frozen dependencies, runs `check` and `test`, then deploys pushes to `main`. Deployments are serialized so a running release isn't cancelled midway through provisioning or publishing.

Add `CLOUDFLARE_API_TOKEN` to the repository's Actions secrets. The token needs Workers Scripts edit permission and access to any resources the app uses or provisions. Set `CLOUDFLARE_WORKERS_SUBDOMAIN` as an Actions variable if workers.dev readiness needs the account subdomain. The workflow also accepts `DATABASE_URL` for PostgreSQL/MySQL and `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` for Access-protected readiness checks when those features are used.

For production server values, declare keys in `env.ts` and set secrets with `vpx void secret put <NAME>`. Local `.env` files are not uploaded. See [Void's Cloudflare guide](https://void.cloud/integrations/cloudflare) for deployment, readiness, and token permissions.

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
