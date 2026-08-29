# SBO:Rebirth Build Optimizer V2

Fresh React and SpacetimeDB implementation of the focused SBO:Rebirth build optimizer.

## Pinned toolchain

- Node.js 22.x (`22.22.2` in the initial development environment)
- npm 10.9.7
- SpacetimeDB CLI, TypeScript server package, client SDK, and generated bindings 2.8.3
- React 19.2.8
- Vite 8.2.2
- TypeScript 7.0.2

## Install and verify

```powershell
npm ci
npm run check:toolchain
npm run test:unit
npm run typecheck
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
git diff --exit-code -- client/src/module_bindings
npm run test:integration
npm run build
```

The root install intentionally runs a separate `npm ci` inside `spacetimedb/`. SpacetimeDB's TypeScript builder resolves the compiler from the module-local `node_modules`, while the React client remains an npm workspace.

## Local development

In the first terminal:

```powershell
spacetime start --listen-addr 127.0.0.1:3000
```

In the second terminal:

```powershell
spacetime publish sbo-rebirth-optimizer-v2-dev --server local --module-path ./spacetimedb
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run dev
```

The client runs at `http://localhost:5173` and connects to `http://127.0.0.1:3000` by default.

## Optional SpacetimeAuth

Guest mode is the default and retains the complete optimizer, IndexedDB drafts, and local saved builds. To enable optional sign-in, create a public browser client in SpacetimeAuth, register the application's `/auth/callback` URL, and supply its public ID as `VITE_SPACETIMEAUTH_CLIENT_ID`.

The browser uses OIDC Authorization Code with PKCE against `https://auth.spacetimedb.com/oidc` and requests only `openid profile`. It does not use a client secret. The resulting ID token is passed to the SpacetimeDB connection builder so private views and reducers use the authenticated identity.

Production cloud mutations remain locked until the database owner configures:

- mode: `production`
- issuer: `https://auth.spacetimedb.com/oidc`
- audience: the application audience configured for the deployment

The module rejects production configuration with a different issuer or an empty/short audience. Private tables are never public; signed-in clients receive only identity-filtered views.

Local automated integration tests use owner-enabled `development` auth only on `http://127.0.0.1:3000` and only for `sbo-rebirth-optimizer-v2-test`. The runner creates disposable server-issued owner/player credentials, places CLI state in a temporary `--config-path`, and removes it with the temporary server data. The browser-only test adapter is compiled only by the Vite development server for that exact loopback database target; production builds ignore it.

Never put an OIDC client secret, ID token, server-issued identity token, Maincloud login token, or test token in git. The SpacetimeAuth client ID is public configuration; all tokens remain ephemeral or browser-session data.

## Repository rules

- Never edit `client/src/module_bindings/` manually; regenerate it.
- `spacetime.local.json`, `spacetime.*.local.json`, `.env.local`, and `.env.*.local` are ignored.
- Never commit SpacetimeAuth ID tokens, server-issued tokens, Maincloud login tokens, or OIDC client secrets.
- The OIDC client ID is public configuration and must be supplied per deployment.
- Visual references live in `design/concepts/`; production background assets live in `client/public/assets/`.

## Verified release and fallback

`client/src/data/fallback-release.json` is generated from a locally published,
typed SpacetimeDB release. Rebuild it with `npm run build:fallback:local`; this
stages the pinned canonical wiki revisions, records private review decisions,
publishes atomically to a disposable local database, exports the public rows,
and runs `npm run validate:coverage`.

The three-points-per-level rule is stored separately from wiki-derived formulas
as `owner-gameplay-attestation:2026-08-29`, linked to the official Roblox
experience. Only the module owner can submit that narrowly scoped attestation.

## Production deployment

Production routing is checked into `spacetime.production.json` without
credentials. The manual `Deploy Optimizer V2` workflow refuses to deploy unless:

- `SPACETIMEDB_LOGIN_TOKEN` exists as a GitHub Actions secret;
- `SPACETIMEAUTH_CLIENT_ID` exists as a GitHub Actions variable and begins with
  `client_`;
- Maincloud auth is locked to `production`, issuer
  `https://auth.spacetimedb.com/oidc`, and that exact client ID;
- the module, generated bindings, tests, integration suite, fallback coverage,
  and production client build all pass.

The workflow publishes the Maincloud module before uploading only
`optimizer-v2/client/dist` to GitHub Pages. It never passes a data-deletion flag.
Automatic deployment from `main` remains disabled until the first manual
production smoke test passes.
