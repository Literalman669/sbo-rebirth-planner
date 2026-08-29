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

## Repository rules

- Never edit `client/src/module_bindings/` manually; regenerate it.
- `spacetime.local.json`, `spacetime.*.local.json`, `.env.local`, and `.env.*.local` are ignored.
- Never commit SpacetimeAuth ID tokens, server-issued tokens, Maincloud login tokens, or OIDC client secrets.
- The OIDC client ID is public configuration, but it is added only when authentication work begins.
- Visual references live in `design/concepts/`; production background assets live in `client/public/assets/`.
