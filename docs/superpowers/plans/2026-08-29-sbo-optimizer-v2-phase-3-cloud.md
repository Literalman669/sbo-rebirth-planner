# SBO:Rebirth Optimizer V2 Phase 3 Authentication and Cloud Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional SpacetimeAuth sign-in, identity-isolated cloud builds, immutable revision history, offline revision queuing, selective guest import, and revocable public build snapshots.

**Architecture:** Private SpacetimeDB tables store signed-in player data and expose identity-filtered views. React uses a replaceable generated connection builder keyed by the OIDC ID token; a repository layer coordinates IndexedDB drafts, pending revisions, reducers, and subscriptions without placing synchronization logic in screens.

**Tech Stack:** Phase 1–2 stack plus SpacetimeAuth OIDC, react-oidc-context 3.3.1, oidc-client-ts 3.5.0, SpacetimeDB private tables/views/reducers

**Spec:** `docs/superpowers/specs/2026-08-29-sbo-rebirth-optimizer-v2-design.md`

## Global Constraints

- Complete Phase 1 and Phase 2 completion gates first.
- Authentication remains optional; guests retain the complete local optimizer.
- Use Authorization Code + PKCE through SpacetimeAuth; never expose or request a client secret in browser code.
- Every cloud mutation must verify `ctx.sender`, OIDC issuer, and audience in the module.
- Private player tables are never marked public; clients read them only through identity-filtered views.
- Every accepted save creates an immutable revision; restoring creates a new revision.
- Latest accepted revision becomes current, but no prior revision is deleted by conflict resolution.
- Guest builds are imported only after explicit selection.
- Public shared snapshots contain no owner identity, private history, or client-supplied recommendation text.
- Local test mode is owner-configured and defaults to locked; production deployment must reject development auth mode.

## File Structure

```text
optimizer-v2/
├── spacetimedb/src/
│   ├── schema.ts
│   ├── auth.ts
│   ├── playerReducers.ts
│   ├── playerViews.ts
│   ├── sharing.ts
│   └── index.ts
├── client/src/
│   ├── app/providers/AuthProvider.tsx
│   ├── app/providers/CloudDataProvider.tsx
│   ├── config/authConfig.ts
│   ├── features/auth/AuthCallbackScreen.tsx
│   ├── features/auth/SignInControl.tsx
│   ├── features/builds/GuestImportDialog.tsx
│   ├── features/builds/BuildHistoryScreen.tsx
│   ├── features/builds/CloudBuildList.tsx
│   ├── features/share/SharedBuildScreen.tsx
│   ├── infrastructure/cloud/buildMappers.ts
│   ├── infrastructure/cloud/buildRepository.ts
│   ├── infrastructure/cloud/pendingRevisionQueue.ts
│   └── infrastructure/cloud/useCloudBuilds.ts
└── scripts/configure-local-auth.mjs
```

---

### Task 1: Add private player schema, authorization, views, and reducers

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Create: `optimizer-v2/spacetimedb/src/auth.ts`
- Create: `optimizer-v2/spacetimedb/src/playerViews.ts`
- Create: `optimizer-v2/spacetimedb/src/playerReducers.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Create: `optimizer-v2/scripts/configure-local-auth.mjs`
- Test: `optimizer-v2/scripts/run-local-integration.mjs`

**Interfaces:**
- Consumes: OIDC claims from `ctx.senderAuth.jwt` and owner identity captured in `app_config`.
- Produces: `my_profile`, `my_builds`, `my_build_revisions`, `my_revision_equipment`, `my_revision_owned_items`, `configure_auth`, `save_build_revision`, `complete_guest_import`, `restore_build_revision`, and `delete_build`.

- [ ] **Step 1: Write failing local integration assertions**

Extend the integration runner to publish the updated module and assert via generated client bindings that:

1. a caller cannot save while auth mode is `locked`;
2. the module owner can call `configureAuth({ mode: 'development', issuer: '', audience: '' })` on the fixed local test database;
3. two separate identities never see each other's build rows;
4. two saves create two revisions and the second becomes head;
5. restore creates a third revision whose payload matches the selected old revision.

Expected initial result: FAIL because the tables and reducers do not exist.

- [ ] **Step 2: Extend the schema with exact private tables**

```ts
export const authConfig = table({ name: 'auth_config' }, {
  key: t.string().primaryKey(),
  mode: t.string(),
  issuer: t.string(),
  audience: t.string(),
});

export const userProfile = table({ name: 'user_profile' }, {
  identity: t.identity().primaryKey(),
  guestImportCompletedAt: t.timestamp().optional(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
});

export const build = table({
  name: 'build',
  indexes: [{ name: 'build_owner', algorithm: 'btree', columns: ['owner'] }],
}, {
  id: t.string().primaryKey(),
  owner: t.identity(),
  name: t.string(),
  headRevisionId: t.string(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
});

export const buildRevision = table({
  name: 'build_revision',
  indexes: [
    { name: 'build_revision_owner', algorithm: 'btree', columns: ['owner'] },
    { name: 'build_revision_build_id', algorithm: 'btree', columns: ['buildId'] },
  ],
}, {
  id: t.string().primaryKey(),
  buildId: t.string(),
  owner: t.identity(),
  parentRevisionId: t.string().optional(),
  schemaVersion: t.u32(),
  level: t.u32(),
  maxFloor: t.u32(),
  weaponPath: t.string(),
  goal: t.string(),
  weaponSkill: t.u32().optional(),
  str: t.u32(), def: t.u32(), agi: t.u32(), vit: t.u32(), luk: t.u32(),
  datasetVersion: t.string(),
  createdAt: t.timestamp(),
});

export const revisionEquipment = table({
  name: 'revision_equipment',
  indexes: [
    { name: 'revision_equipment_revision_id', algorithm: 'btree', columns: ['revisionId'] },
    { name: 'revision_equipment_owner', algorithm: 'btree', columns: ['owner'] },
  ],
}, {
  id: t.string().primaryKey(),
  revisionId: t.string(),
  owner: t.identity(),
  slot: t.string(),
  itemId: t.string(),
});

export const revisionOwnedItem = table({
  name: 'revision_owned_item',
  indexes: [
    { name: 'revision_owned_item_revision_id', algorithm: 'btree', columns: ['revisionId'] },
    { name: 'revision_owned_item_owner', algorithm: 'btree', columns: ['owner'] },
  ],
}, {
  id: t.string().primaryKey(),
  revisionId: t.string(),
  owner: t.identity(),
  itemId: t.string(),
});
```

Add all tables to the single `schema({ ... })` export. In `init`, insert `auth_config` with `{ key: 'primary', mode: 'locked', issuer: '', audience: '' }` alongside the owner row.

- [ ] **Step 3: Implement server-side authorization helpers**

```ts
// spacetimedb/src/auth.ts
import { SenderError, type ReducerCtx } from 'spacetimedb/server';
import type { AppSchema } from './schema';

type AppReducerCtx = ReducerCtx<AppSchema>;

export function assertOwner(ctx: AppReducerCtx): void {
  const owner = ctx.db.appConfig.ownerIdentity.find(ctx.sender);
  if (!owner) {
    throw new SenderError('Owner authorization required');
  }
}

export function assertAppUser(ctx: AppReducerCtx): void {
  const config = ctx.db.authConfig.key.find('primary');
  if (!config || config.mode === 'locked') throw new SenderError('Cloud features are not configured');
  if (config.mode === 'development') return;
  const jwt = ctx.senderAuth.jwt;
  if (!jwt) throw new SenderError('Sign in required');
  if (jwt.issuer !== config.issuer) throw new SenderError('Invalid token issuer');
  if (!jwt.audience.includes(config.audience)) throw new SenderError('Invalid token audience');
}
```

Export this exact type from `schema.ts` after constructing the schema:

```ts
export type AppSchema = (typeof spacetimedb)['schemaType'];
```

- [ ] **Step 4: Implement owner-only auth configuration**

```ts
export const configureAuth = spacetimedb.reducer(
  { mode: t.string(), issuer: t.string(), audience: t.string() },
  (ctx, { mode, issuer, audience }) => {
    assertOwner(ctx);
    if (!['locked', 'development', 'production'].includes(mode)) throw new SenderError('Invalid auth mode');
    if (mode === 'production' && (issuer !== 'https://auth.spacetimedb.com/oidc' || audience.length < 10)) {
      throw new SenderError('Production auth requires the SpacetimeAuth issuer and audience');
    }
    const current = ctx.db.authConfig.key.find('primary');
    ctx.db.authConfig.key.update({ ...current!, mode, issuer, audience });
  },
);
```

- [ ] **Step 5: Implement identity-filtered views**

Each view returns only rows where `owner === ctx.sender`, using owner indexes rather than table scans. `my_profile` uses the identity primary key and returns zero or one row. Export:

```ts
export const myBuilds = spacetimedb.view(
  { name: 'my_builds', public: true },
  t.array(build.rowType),
  (ctx) => [...ctx.db.build.build_owner.filter(ctx.sender)],
);

export const myProfile = spacetimedb.view(
  { name: 'my_profile', public: true },
  t.array(userProfile.rowType),
  (ctx) => {
    const row = ctx.db.userProfile.identity.find(ctx.sender);
    return row ? [row] : [];
  },
);

export const myBuildRevisions = spacetimedb.view(
  { name: 'my_build_revisions', public: true },
  t.array(buildRevision.rowType),
  (ctx) => [...ctx.db.buildRevision.build_revision_owner.filter(ctx.sender)],
);

export const myRevisionEquipment = spacetimedb.view(
  { name: 'my_revision_equipment', public: true },
  t.array(revisionEquipment.rowType),
  (ctx) => [...ctx.db.revisionEquipment.revision_equipment_owner.filter(ctx.sender)],
);

export const myRevisionOwnedItems = spacetimedb.view(
  { name: 'my_revision_owned_items', public: true },
  t.array(revisionOwnedItem.rowType),
  (ctx) => [...ctx.db.revisionOwnedItem.revision_owned_item_owner.filter(ctx.sender)],
);
```

- [ ] **Step 6: Implement transactional save, restore, and delete reducers**

Define reducer parameters with `t.object`/`t.array` and these client-facing shapes:

```ts
type SaveBuildRevisionArgs = {
  buildId: string;
  revisionId: string;
  name: string;
  parentRevisionId?: string;
  profile: {
    schemaVersion: number; level: number; maxFloor: number; weaponPath: string; goal: string;
    weaponSkill?: number; str: number; def: number; agi: number; vit: number; luk: number;
    datasetVersion: string;
  };
  equipment: Array<{ slot: string; itemId: string }>;
  ownedItemIds: string[];
};
```

`saveBuildRevision` must call `assertAppUser`, create `user_profile` on the caller's first cloud mutation, validate ID lengths, enforce stat/floor/level bounds from the client schema, reject a build owned by another identity, insert the immutable revision rows, and update the build head in the same transaction. `completeGuestImport` records `guestImportCompletedAt` only after all selected imports are accepted. `restoreBuildRevision` copies an owned prior revision into a caller-provided new revision ID. `deleteBuild` deletes only the caller's build and all of its revision child rows.

- [ ] **Step 7: Run module and isolation tests**

Run:

```powershell
cd optimizer-v2
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run test:integration
```

Expected: PASS for lock, owner configuration, cross-identity isolation, revision creation, restore, and deletion.

- [ ] **Step 8: Commit private cloud persistence**

```powershell
git diff --check
git add optimizer-v2/spacetimedb optimizer-v2/client/src/module_bindings optimizer-v2/scripts optimizer-v2/package-lock.json
git commit -m "feat: store identity-scoped build revisions"
```

---

### Task 2: Integrate optional SpacetimeAuth and token-aware connections

**Files:**
- Modify: `optimizer-v2/client/package.json`
- Create: `optimizer-v2/client/src/config/authConfig.ts`
- Create: `optimizer-v2/client/src/app/providers/AuthProvider.tsx`
- Create: `optimizer-v2/client/src/app/providers/CloudDataProvider.tsx`
- Create: `optimizer-v2/client/src/features/auth/AuthCallbackScreen.tsx`
- Create: `optimizer-v2/client/src/features/auth/SignInControl.tsx`
- Create: `optimizer-v2/client/src/features/auth/authScreens.test.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Modify: `optimizer-v2/client/src/main.tsx`

**Interfaces:**
- Consumes: `VITE_SPACETIMEAUTH_CLIENT_ID`, OIDC ID token, Maincloud/local database config.
- Produces: `useAuthSession()` and a SpacetimeDB provider that reconnects with the current ID token.

- [ ] **Step 1: Add the OIDC dependencies**

Add exact client dependencies:

```json
"oidc-client-ts": "3.5.0",
"react-oidc-context": "3.3.1"
```

Run `npm install` from `optimizer-v2/`.

- [ ] **Step 2: Write failing guest, callback, and sign-out tests**

Mock `react-oidc-context` and prove that guest mode renders the optimizer, Sign In calls `signinRedirect`, `/auth/callback` shows progress and returns Home, an auth error preserves guest state, and Sign Out calls `removeUser` without deleting local builds.

- [ ] **Step 3: Implement strict public auth configuration**

```ts
// client/src/config/authConfig.ts
import { WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';

export function createAuthSettings(clientId: string): UserManagerSettings {
  if (!clientId) throw new Error('VITE_SPACETIMEAUTH_CLIENT_ID is required to enable sign-in');
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return {
    authority: 'https://auth.spacetimedb.com/oidc',
    client_id: clientId,
    redirect_uri: new URL('auth/callback', base).toString(),
    post_logout_redirect_uri: base.toString(),
    response_type: 'code',
    scope: 'openid profile',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  };
}
```

Do not request the `email` scope because the application does not need email.

- [ ] **Step 4: Implement optional provider behavior**

When `VITE_SPACETIMEAUTH_CLIENT_ID` is absent in local guest-only development, `AuthProvider` supplies `{ status: 'guest', signInUnavailableReason: 'Authentication is not configured' }` and does not throw during app startup. When configured, wrap the app with `AuthProvider` from `react-oidc-context` and expose only `status`, `preferredUsername`, `idToken`, `signIn`, and `signOut` through the application context.

- [ ] **Step 5: Replace the public-only connection with token-aware connection creation**

```ts
export function createConnectionBuilder(idToken?: string) {
  const builder = DbConnection.builder()
    .withUri(appEnv.spacetimeUri)
    .withDatabaseName(appEnv.databaseName);
  return idToken ? builder.withToken(idToken) : builder;
}
```

Memoize the builder by `idToken`. Keep public dataset subscriptions active in both modes. Subscribe to private views only while authenticated.

- [ ] **Step 6: Run auth component and connection tests**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- authScreens CloudDataProvider`

Expected: PASS without a real redirect or token in automated tests.

- [ ] **Step 7: Commit optional authentication**

```powershell
git diff --check
git add optimizer-v2/client optimizer-v2/package-lock.json
git commit -m "feat: add optional SpacetimeAuth sign in"
```

---

### Task 3: Synchronize builds, queue offline revisions, and import guest data

**Files:**
- Create: `optimizer-v2/client/src/infrastructure/cloud/buildMappers.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/pendingRevisionQueue.test.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/buildRepository.test.ts`
- Create: `optimizer-v2/client/src/infrastructure/cloud/useCloudBuilds.ts`
- Create: `optimizer-v2/client/src/features/builds/GuestImportDialog.tsx`
- Create: `optimizer-v2/client/src/features/builds/CloudBuildList.tsx`
- Create: `optimizer-v2/client/src/features/builds/BuildHistoryScreen.tsx`
- Modify: `optimizer-v2/client/src/features/home/HomeScreen.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`

**Interfaces:**
- Consumes: GuestBuildStore, authenticated private-view rows, and generated reducers.
- Produces: `BuildRepository.save`, `BuildRepository.importGuestBuilds`, `BuildRepository.restore`, and a durable pending queue.

- [ ] **Step 1: Extend IndexedDB with a pending-revision store and failing tests**

Bump the guest database to version 2 and create `pending-revisions`. Test enqueue, ordered list, acknowledgement, retry count, and persistence after a new adapter instance.

```ts
export interface PendingRevision {
  revisionId: string;
  buildId: string;
  profile: CharacterProfile;
  parentRevisionId?: string;
  enqueuedAt: string;
  attempts: number;
}
```

- [ ] **Step 2: Implement generated-row mappers**

`buildMappers.ts` converts private view rows into `CharacterProfile` and converts a profile into the exact `saveBuildRevision` reducer argument. Convert every `u64/u32` value deliberately and never pass BigInt into JSON serialization.

- [ ] **Step 3: Write failing repository tests**

Prove that:

- guest save remains local;
- signed-in save writes local first, enqueues, calls the reducer, then acknowledges;
- reducer failure leaves the pending item and increments attempts;
- subscribed cloud head replaces the displayed head only after it is validated;
- two cloud heads remain visible in history;
- guest import sends only selected IDs;
- restoring a revision creates a new revision ID using `crypto.randomUUID()`.

- [ ] **Step 4: Implement `BuildRepository`**

```ts
export interface BuildRepository {
  save(profile: CharacterProfile): Promise<{ revisionId?: string; location: 'local' | 'cloud-pending' | 'cloud' }>;
  importGuestBuilds(ids: readonly string[]): Promise<void>;
  retryPending(): Promise<void>;
  restore(buildId: string, revisionId: string): Promise<string>;
  delete(buildId: string): Promise<void>;
}
```

Run `retryPending` on authenticated connection readiness and browser `online` events. Process in enqueue order, one reducer call at a time. While signed in, debounced active-draft changes use the draft's stable build ID and flow through the same pending revision queue, so the active draft is native cloud data rather than a separate JSON document. Do not delete guest builds after import; show an explicit separate cleanup action.

- [ ] **Step 5: Implement import, cloud list, and history UI**

On first authenticated session, show `GuestImportDialog` only when local builds exist and the identity-specific `user_profile` has not recorded import completion. The dialog uses checkboxes and an `Import selected` action. History lists revision timestamp, dataset version, and summary; Restore confirms the selected revision and returns to Results after the new head arrives via subscription.

- [ ] **Step 6: Add repository and component tests**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- pendingRevisionQueue buildRepository GuestImport BuildHistory`

Expected: PASS.

- [ ] **Step 7: Run local cross-session integration tests**

Configure the fixed local test database to development auth mode using the owner connection. Open two isolated browser contexts, save from each, and verify latest accepted head plus two recoverable revisions.

- [ ] **Step 8: Commit synchronization and history**

```powershell
git diff --check
git add optimizer-v2/client optimizer-v2/scripts optimizer-v2/package-lock.json
git commit -m "feat: sync and restore cloud build revisions"
```

---

### Task 4: Add revocable public build snapshots

**Files:**
- Modify: `optimizer-v2/spacetimedb/src/schema.ts`
- Create: `optimizer-v2/spacetimedb/src/sharing.ts`
- Modify: `optimizer-v2/spacetimedb/src/index.ts`
- Regenerate: `optimizer-v2/client/src/module_bindings/`
- Create: `optimizer-v2/client/src/features/share/SharedBuildScreen.tsx`
- Create: `optimizer-v2/client/src/features/share/SharedBuildScreen.test.tsx`
- Modify: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Modify: `optimizer-v2/client/src/app/router.tsx`

**Interfaces:**
- Consumes: An owned build head and a published dataset version.
- Produces: `createBuildShare({ buildId, shareId })`, `revokeBuildShare({ shareId })`, and `/shared/:shareId`.

- [ ] **Step 1: Write failing module tests for privacy and revocation**

Assert that a non-owner cannot share or revoke a build, public rows contain no `owner` column, the snapshot copies only validated profile fields and item IDs, no recommendation text is accepted, duplicate share IDs fail, and revocation removes every public child row.

- [ ] **Step 2: Add private ownership and public snapshot tables**

Define:

- private `build_share_owner(shareId primary key, owner, buildId, createdAt)` with owner index;
- public `shared_build(shareId primary key, schemaVersion, level, maxFloor, weaponPath, goal, weaponSkill?, str, def, agi, vit, luk, datasetVersion, createdAt)`;
- public `shared_build_equipment(id primary key, shareId indexed, slot, itemId)`;
- public `shared_build_owned_item(id primary key, shareId indexed, itemId)`.

Do not include build name unless it passes a 1–60 character plain-text validator; do not include owner identity under any alias.

- [ ] **Step 3: Implement create and revoke reducers**

`createBuildShare` validates `shareId` against `/^[a-zA-Z0-9_-]{22,64}$/`, verifies build ownership, reads the current revision and children, and copies them transactionally. `revokeBuildShare` verifies the private ownership row and deletes public child rows, snapshot, and ownership row.

- [ ] **Step 4: Regenerate bindings and run sharing integration tests**

Run:

```powershell
cd optimizer-v2
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
npm run test:integration
```

Expected: privacy, create, anonymous read, and revocation tests PASS.

- [ ] **Step 5: Implement the public shared route**

Generate 32 random bytes in the browser with `crypto.getRandomValues`, encode base64url without padding, and pass that 43-character identifier to the reducer. The shared route subscribes by share ID, reconstructs the profile, loads the referenced historical published dataset, calls `optimizeBuild` locally, and labels the dataset version. Missing or revoked IDs render `This shared build is unavailable.`

- [ ] **Step 6: Test tamper resistance**

Create a component test that injects fake recommendation text into the URL and prove it is ignored. The rendered recommendation must equal local `optimizeBuild(snapshot, referencedDataset)` output.

- [ ] **Step 7: Commit public sharing**

```powershell
git diff --check
git add optimizer-v2/spacetimedb optimizer-v2/client optimizer-v2/package-lock.json
git commit -m "feat: add revocable public build snapshots"
```

---

### Task 5: Verify the complete optional-cloud journey

**Files:**
- Create: `optimizer-v2/client/e2e/cloud-flow.spec.ts`
- Modify: `optimizer-v2/scripts/run-local-integration.mjs`
- Modify: `.github/workflows/optimizer-v2-ci.yml`
- Modify: `optimizer-v2/README.md`

**Interfaces:**
- Consumes: Fixed local development auth mode and two isolated browser contexts.
- Produces: Automated proof of guest, import, cloud, revision, reconnect, and public-share behavior.

- [ ] **Step 1: Write the end-to-end cloud scenario**

The scenario must:

1. create two guest builds;
2. switch the test auth adapter to signed-in state;
3. import only one selected build;
4. edit and save it in context A;
5. observe the head in context B;
6. take context A offline, edit, and verify a pending revision;
7. reconnect and observe the new head plus prior revision;
8. restore the prior revision;
9. create a public share, view it anonymously, and revoke it;
10. verify the anonymous URL becomes unavailable.

- [ ] **Step 2: Add CI gates**

Extend Optimizer V2 CI to install Chromium, run `npm run test:integration`, and fail if generated bindings differ. Keep the fixed local database guard from Phase 1.

- [ ] **Step 3: Document the SpacetimeAuth boundary**

README must state:

- local automated tests use owner-enabled development auth only on `127.0.0.1`;
- production requires issuer `https://auth.spacetimedb.com/oidc` and a configured audience;
- browser code uses only the public client ID and PKCE;
- no client secret, ID token, or server-issued token belongs in git.

- [ ] **Step 4: Run the Phase 3 completion gate**

Run:

```powershell
cd optimizer-v2
npm run check:toolchain
npm run test:unit
npm run typecheck
spacetime build
spacetime generate --lang typescript --out-dir ./client/src/module_bindings --module-path ./spacetimedb --yes
git diff --exit-code -- client/src/module_bindings
npm run test:integration
npm run build
```

Expected: all commands PASS.

- [ ] **Step 5: Commit Phase 3 verification**

```powershell
git diff --check
git add .github/workflows/optimizer-v2-ci.yml optimizer-v2
git commit -m "test: verify optional cloud build workflow"
```

## Phase 3 Completion Gate

Phase 3 is complete only when guest behavior remains unchanged, optional sign-in is testable, private data is identity-isolated, local edits survive disconnection, every cloud state is revisioned, selected guest builds import safely, and public snapshots can be created, recomputed from verified data, and revoked without exposing ownership.
