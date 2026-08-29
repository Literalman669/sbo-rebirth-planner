# SBO:Rebirth Optimizer V2 Phase 2 Optimizer and Guest UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete guest workflow—Character, Stats, Equipment, and Results—powered by a deterministic optimizer and a small reviewed bootstrap dataset.

**Architecture:** Domain types and optimizer functions remain pure TypeScript under `client/src/domain/`. Routed feature screens consume a draft service and the active verified dataset; IndexedDB persists guest drafts and named builds without leaking storage calls into components.

**Tech Stack:** Phase 1 stack plus React Router 7.18.3, Zod 4.5.2, IndexedDB via idb 8.0.3, Testing Library, and Playwright

**Spec:** `docs/superpowers/specs/2026-08-29-sbo-rebirth-optimizer-v2-design.md`

## Global Constraints

- Complete Phase 1 and its completion gate before starting this plan.
- Keep `/character`, `/stats`, `/equipment`, and `/results` as distinct routed screens; never collapse them into one long page.
- Require only level, highest floor, weapon path, invested stats, and equipped gear.
- Weapon skill and optimization goal are optional; Balanced is the default goal.
- Support Two-Handed, One-Handed, Rapier, Dagger, Dual Wield, and Melee.
- Generate exactly a ten-level, thirty-point stat plan and at most three equipment targets.
- Use only records whose verification status is `verified`; do not substitute estimates.
- Store guest data through the storage adapter, never directly from React components.
- Before implementing Task 6 visual styling, read and follow `build-web-apps:frontend-app-builder` and `build-web-apps:react-best-practices`.

## File Structure

```text
optimizer-v2/client/src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers/
│       ├── BuildDraftProvider.tsx
│       └── DatasetProvider.tsx
├── data/bootstrapRelease.ts
├── domain/
│   ├── build/model.ts
│   ├── build/schema.ts
│   ├── dataset/model.ts
│   ├── dataset/schema.ts
│   └── optimizer/
│       ├── projections.ts
│       ├── projections.test.ts
│       ├── goalConfig.ts
│       ├── allocateStats.ts
│       ├── allocateStats.test.ts
│       ├── eligibility.ts
│       ├── eligibility.test.ts
│       ├── recommendEquipment.ts
│       ├── recommendEquipment.test.ts
│       ├── optimizeBuild.ts
│       └── optimizeBuild.test.ts
├── features/
│   ├── home/HomeScreen.tsx
│   ├── planner/CharacterScreen.tsx
│   ├── planner/StatsScreen.tsx
│   ├── planner/EquipmentScreen.tsx
│   ├── planner/PlannerFrame.tsx
│   └── results/ResultsScreen.tsx
├── infrastructure/storage/
│   ├── guestBuildStore.ts
│   └── guestBuildStore.test.ts
└── styles/
    ├── tokens.css
    ├── global.css
    └── planner.css
```

---

### Task 1: Define the typed build and dataset contracts

**Files:**
- Create: `optimizer-v2/client/src/domain/build/model.ts`
- Create: `optimizer-v2/client/src/domain/build/schema.ts`
- Create: `optimizer-v2/client/src/domain/build/schema.test.ts`
- Create: `optimizer-v2/client/src/domain/dataset/model.ts`
- Create: `optimizer-v2/client/src/domain/dataset/schema.ts`
- Create: `optimizer-v2/client/src/domain/dataset/schema.test.ts`

**Interfaces:**
- Consumes: Raw form values and release rows.
- Produces: `CharacterProfile`, `EquipmentRecord`, `DatasetSnapshot`, `characterProfileSchema`, and `datasetSnapshotSchema`.

- [ ] **Step 1: Write failing schema tests for required and optional fields**

```ts
// client/src/domain/build/schema.test.ts
import { describe, expect, it } from 'vitest';
import { characterProfileSchema } from './schema';

const validProfile = {
  schemaVersion: 2,
  id: 'guest-build-1',
  name: 'Floor 2 Greatsword',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'beginner-armor' },
  ownedItemIds: [],
  datasetVersion: 'bootstrap-1',
};

describe('characterProfileSchema', () => {
  it('accepts the essential profile without weapon skill', () => {
    expect(characterProfileSchema.parse(validProfile)).toEqual(validProfile);
  });

  it('rejects unknown weapon paths', () => {
    expect(() => characterProfileSchema.parse({ ...validProfile, weaponPath: 'katana' })).toThrow();
  });

  it('rejects negative invested stats', () => {
    expect(() =>
      characterProfileSchema.parse({ ...validProfile, stats: { ...validProfile.stats, str: -1 } }),
    ).toThrow();
  });
});
```

```ts
// client/src/domain/dataset/schema.test.ts
import { describe, expect, it } from 'vitest';
import { equipmentRecordSchema } from './schema';

describe('equipmentRecordSchema', () => {
  it('requires provenance for verified equipment', () => {
    expect(() =>
      equipmentRecordSchema.parse({
        id: 'iron-dagger', name: 'Iron Dagger', slot: 'main-hand', weaponPaths: ['dagger'],
        attack: 2.5, defense: 0, dexterity: 0, levelRequirement: 1, skillRequirement: 1,
        floor: 1, acquisitionType: 'starter', acquisitionDetail: 'Starter Inventory',
        availability: 'always', verificationStatus: 'verified', lastReviewedAt: '2026-08-29'
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- schema.test.ts`

Expected: FAIL because the domain schemas do not exist.

- [ ] **Step 3: Implement exact domain unions and interfaces**

```ts
// client/src/domain/build/model.ts
export type WeaponPath = 'two-handed' | 'one-handed' | 'rapier' | 'dagger' | 'dual-wield' | 'melee';
export type OptimizationGoal = 'balanced' | 'damage' | 'survivability' | 'mobility' | 'farming';
export type StatName = 'str' | 'def' | 'agi' | 'vit' | 'luk';
export type EquipmentSlot = 'main-hand' | 'off-hand' | 'armor' | 'shield' | 'upper-head' | 'lower-head';
export type StatBlock = Record<StatName, number>;

export interface CharacterProfile {
  schemaVersion: 2;
  id: string;
  name?: string;
  level: number;
  maxFloor: number;
  weaponPath: WeaponPath;
  goal: OptimizationGoal;
  weaponSkill?: number;
  stats: StatBlock;
  equipped: Partial<Record<EquipmentSlot, string>>;
  ownedItemIds: string[];
  datasetVersion: string;
}
```

```ts
// client/src/domain/dataset/model.ts
import type { EquipmentSlot, WeaponPath } from '../build/model';

export type AcquisitionType = 'starter' | 'shop' | 'mob-drop' | 'boss-drop' | 'crafting' | 'quest' | 'event' | 'badge' | 'gamepass';
export type Availability = 'always' | 'active-event' | 'inactive-event';

export interface EquipmentRecord {
  id: string;
  name: string;
  slot: EquipmentSlot;
  weaponPaths: WeaponPath[];
  attack: number;
  defense: number;
  dexterity: number;
  levelRequirement: number;
  skillRequirement?: number;
  floor: number;
  acquisitionType: AcquisitionType;
  acquisitionDetail: string;
  availability: Availability;
  sourceUrl: string;
  sourceRevision?: string;
  lastReviewedAt: string;
  verificationStatus: 'verified' | 'candidate';
}

export type FormulaId =
  | 'points-per-level' | 'attack-from-str' | 'damage-reduction-from-def'
  | 'bonus-hp-from-vit' | 'stamina' | 'walk-speed-from-agi'
  | 'sprint-speed-from-agi' | 'crit-bonus-from-luk' | 'drop-bonus-from-luk';

export interface FormulaRecord {
  id: FormulaId;
  expression: string;
  units: string;
  applicability: string;
  boundaryBehavior: string;
  sourceUrl: string;
  sourceRevision?: string;
  lastReviewedAt: string;
  verificationStatus: 'verified' | 'candidate';
}

export interface DatasetSnapshot {
  version: string;
  publishedAt: string;
  lastReviewedAt: string;
  sourceSummary: string;
  formulaSetVersion: 'sbor-stats-v1';
  pointsPerLevel: 3;
  formulas: FormulaRecord[];
  equipment: EquipmentRecord[];
}
```

- [ ] **Step 4: Implement Zod schemas with cross-field validation**

`characterProfileSchema` must enforce integer levels `1..10000`, floors `1..19`, optional integer weapon skill `0..10000`, every stat `0..500`, unique owned item IDs, and `goal.default('balanced')`. Add a refinement that Dual Wield requires an `off-hand` item only when the user supplies one; missing off-hand is valid but reported later as an incomplete equipment step.

`equipmentRecordSchema` must require a valid HTTPS `sourceUrl` whenever `verificationStatus === 'verified'`, nonnegative finite stats, floor `1..19`, and at least one compatible weapon path for weapon slots.

`datasetSnapshotSchema` must require all nine `FormulaId` values exactly once, reject candidate formula rows, and accept only `formulaSetVersion === 'sbor-stats-v1'`. The client never evaluates formula strings; the version selects the reviewed implementation in `projections.ts`, and an unknown formula-set version is an explicit unsupported-data error.

Implement those rules with these exported schemas:

```ts
const weaponPathSchema = z.enum(['two-handed', 'one-handed', 'rapier', 'dagger', 'dual-wield', 'melee']);
const goalSchema = z.enum(['balanced', 'damage', 'survivability', 'mobility', 'farming']);
const slotSchema = z.enum(['main-hand', 'off-hand', 'armor', 'shield', 'upper-head', 'lower-head']);
const boundedStat = z.number().int().min(0).max(500);

export const characterProfileSchema = z.object({
  schemaVersion: z.literal(2), id: z.string().min(1).max(100), name: z.string().min(1).max(60).optional(),
  level: z.number().int().min(1).max(10000), maxFloor: z.number().int().min(1).max(19),
  weaponPath: weaponPathSchema, goal: goalSchema.default('balanced'),
  weaponSkill: z.number().int().min(0).max(10000).optional(),
  stats: z.object({ str: boundedStat, def: boundedStat, agi: boundedStat, vit: boundedStat, luk: boundedStat }),
  equipped: z.record(slotSchema, z.string().min(1)),
  ownedItemIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, 'owned item IDs must be unique'),
  datasetVersion: z.string().min(1),
});

export const equipmentRecordSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), slot: slotSchema,
  weaponPaths: z.array(weaponPathSchema), attack: z.number().finite().nonnegative(),
  defense: z.number().finite().nonnegative(), dexterity: z.number().finite().nonnegative(),
  levelRequirement: z.number().int().min(1), skillRequirement: z.number().int().min(0).optional(),
  floor: z.number().int().min(1).max(19),
  acquisitionType: z.enum(['starter', 'shop', 'mob-drop', 'boss-drop', 'crafting', 'quest', 'event', 'badge', 'gamepass']),
  acquisitionDetail: z.string().min(1), availability: z.enum(['always', 'active-event', 'inactive-event']),
  sourceUrl: z.string().url().refine((url) => url.startsWith('https://'), 'source must use HTTPS'),
  sourceRevision: z.string().optional(), lastReviewedAt: z.iso.date(),
  verificationStatus: z.enum(['verified', 'candidate']),
}).superRefine((item, ctx) => {
  if ((item.slot === 'main-hand' || item.slot === 'off-hand') && item.weaponPaths.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'weapon equipment requires a compatible path', path: ['weaponPaths'] });
  }
});

const formulaIdSchema = z.enum([
  'points-per-level', 'attack-from-str', 'damage-reduction-from-def', 'bonus-hp-from-vit',
  'stamina', 'walk-speed-from-agi', 'sprint-speed-from-agi', 'crit-bonus-from-luk', 'drop-bonus-from-luk',
]);

export const formulaRecordSchema = z.object({
  id: formulaIdSchema, expression: z.string().min(1), units: z.string().min(1),
  applicability: z.string().min(1), boundaryBehavior: z.string().min(1),
  sourceUrl: z.string().url().refine((url) => url.startsWith('https://'), 'source must use HTTPS'),
  sourceRevision: z.string().optional(), lastReviewedAt: z.iso.date(),
  verificationStatus: z.literal('verified'),
});

export const datasetSnapshotSchema = z.object({
  version: z.string().min(1), publishedAt: z.iso.datetime(), lastReviewedAt: z.iso.date(),
  sourceSummary: z.string().min(1), formulaSetVersion: z.literal('sbor-stats-v1'), pointsPerLevel: z.literal(3),
  formulas: z.array(formulaRecordSchema).length(9).refine(
    (rows) => new Set(rows.map((row) => row.id)).size === 9,
    'all formula IDs must appear exactly once',
  ),
  equipment: z.array(equipmentRecordSchema).refine(
    (rows) => rows.every((row) => row.verificationStatus === 'verified'),
    'production equipment must be verified',
  ),
});
```

- [ ] **Step 5: Run the domain tests and type-check**

Run:

```powershell
cd optimizer-v2
npm run test:unit --workspace @sbo/optimizer-client -- schema.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the domain contracts**

```powershell
git diff --check
git add optimizer-v2/client/src/domain
git commit -m "feat: define optimizer domain contracts"
```

---

### Task 2: Implement verified projections and deterministic stat allocation

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/projections.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/projections.test.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/goalConfig.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/allocateStats.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/allocateStats.test.ts`

**Interfaces:**
- Consumes: `StatBlock`, character level, and equipped attack/defense/dexterity totals.
- Produces: `projectMetrics(input): ProjectedMetrics` and `allocateNextTenLevels(input): StatAllocationPlan`.

- [ ] **Step 1: Write formula boundary tests from the reviewed Stats formulas**

```ts
// projections.test.ts
import { describe, expect, it } from 'vitest';
import { projectMetrics } from './projections';

describe('projectMetrics', () => {
  it('projects the documented STR, DEF, VIT, stamina, AGI, and LUK effects', () => {
    const result = projectMetrics({
      level: 10,
      stats: { str: 100, def: 100, agi: 100, vit: 100, luk: 100 },
      gear: { attack: 50, defense: 20, dexterity: 40 },
    });
    expect(result.attackPerHit).toBeCloseTo(70);
    expect(result.damageReductionPerHit).toBeCloseTo(120);
    expect(result.bonusHp).toBeCloseTo(440);
    expect(result.stamina).toBeCloseTo(180);
    expect(result.walkSpeedBonus).toBeCloseTo(0.4);
    expect(result.sprintSpeedBonus).toBeCloseTo(2);
    expect(result.critChanceBonus).toBeCloseTo(0.01);
    expect(result.dropChanceBonus).toBeCloseTo(0.01);
  });

  it('caps invested stats at 500 for formula effects', () => {
    const result = projectMetrics({
      level: 1,
      stats: { str: 700, def: 700, agi: 700, vit: 700, luk: 700 },
      gear: { attack: 10, defense: 10, dexterity: 10 },
    });
    expect(result.attackPerHit).toBe(30);
    expect(result.critChanceBonus).toBe(0.05);
    expect(result.dropChanceBonus).toBe(0.05);
  });
});
```

- [ ] **Step 2: Run the projection tests and verify they fail**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- projections.test.ts`

Expected: FAIL because `projectMetrics` is missing.

- [ ] **Step 3: Implement only the documented formulas**

```ts
// projections.ts
import type { StatBlock } from '../build/model';

export interface ProjectedMetrics {
  attackPerHit: number;
  damageReductionPerHit: number;
  bonusHp: number;
  stamina: number;
  walkSpeedBonus: number;
  sprintSpeedBonus: number;
  critChanceBonus: number;
  dropChanceBonus: number;
}

export function projectMetrics(input: {
  level: number;
  stats: StatBlock;
  gear: { attack: number; defense: number; dexterity: number };
}): ProjectedMetrics {
  const str = Math.min(input.stats.str, 500);
  const def = Math.min(input.stats.def, 500);
  const agi = Math.min(input.stats.agi, 500);
  const vit = Math.min(input.stats.vit, 500);
  const luk = Math.min(input.stats.luk, 500);
  return {
    attackPerHit: input.gear.attack * (1 + str * 0.004),
    damageReductionPerHit: input.gear.defense * (5 + def * 0.01),
    bonusHp: input.gear.dexterity * (10 + vit * 0.01),
    stamina: 100 + input.level * 5 + 0.1 * (str + agi + vit),
    walkSpeedBonus: agi * 0.004,
    sprintSpeedBonus: agi * 0.02,
    critChanceBonus: Math.min(luk * 0.0001, 0.05),
    dropChanceBonus: Math.min(luk * 0.0001, 0.05),
  };
}
```

Do not infer an exact AGI attack-speed formula; the wiki describes class changes approximately, so Phase 2 must not present an exact DPS number derived from it.

- [ ] **Step 4: Write failing allocation tests**

Test all five goals, exactly 30 allocated points, no stat above 500, deterministic repeated output, and Balanced distributing points across at least three stats for the standard profile.

```ts
const input = {
  level: 20,
  stats: { str: 20, def: 20, agi: 20, vit: 20, luk: 20 },
  gear: { attack: 30, defense: 20, dexterity: 50 },
};
expect(sum(allocateNextTenLevels({ ...input, goal: 'balanced' }).added)).toBe(30);
expect(allocateNextTenLevels({ ...input, goal: 'balanced' })).toEqual(
  allocateNextTenLevels({ ...input, goal: 'balanced' }),
);
```

- [ ] **Step 5: Implement named goal weights, target shares, and stable tie-breaks**

```ts
// goalConfig.ts
export const GOAL_WEIGHTS = {
  balanced: { damage: 1, survival: 1, mobility: 0.5, farming: 0.25 },
  damage: { damage: 1.75, survival: 0.5, mobility: 0.35, farming: 0.05 },
  survivability: { damage: 0.55, survival: 1.75, mobility: 0.35, farming: 0.05 },
  mobility: { damage: 0.65, survival: 0.55, mobility: 1.75, farming: 0.1 },
  farming: { damage: 0.6, survival: 0.5, mobility: 0.5, farming: 2 },
} as const;

export const TARGET_SHARES = {
  balanced: { str: 0.30, def: 0.20, agi: 0.20, vit: 0.20, luk: 0.10 },
  damage: { str: 0.55, def: 0.10, agi: 0.20, vit: 0.10, luk: 0.05 },
  survivability: { str: 0.15, def: 0.35, agi: 0.10, vit: 0.35, luk: 0.05 },
  mobility: { str: 0.20, def: 0.10, agi: 0.50, vit: 0.15, luk: 0.05 },
  farming: { str: 0.20, def: 0.10, agi: 0.15, vit: 0.10, luk: 0.45 },
} as const;
```

`allocateNextTenLevels` must simulate one point at a time, score the marginal projected change, multiply by a target-share correction clamped to `0.5..2.5`, use stat order `str, def, agi, vit, luk` to break exact ties, stop adding to a stat at 500, and return:

```ts
export interface StatAllocationPlan {
  levels: 10;
  totalPoints: 30;
  added: StatBlock;
  final: StatBlock;
  milestones: Array<{ afterLevel: number; added: StatBlock; totals: StatBlock }>;
}
```

Create milestones after levels 5 and 10.

- [ ] **Step 6: Run optimizer projection/allocation tests**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- projections.test.ts allocateStats.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit formula and allocation behavior**

```powershell
git diff --check
git add optimizer-v2/client/src/domain/optimizer
git commit -m "feat: add verified stat projections"
```

---

### Task 3: Implement equipment eligibility and short recommendations

**Files:**
- Create: `optimizer-v2/client/src/domain/optimizer/eligibility.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/eligibility.test.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/recommendEquipment.test.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.ts`
- Create: `optimizer-v2/client/src/domain/optimizer/optimizeBuild.test.ts`
- Create: `optimizer-v2/client/src/data/bootstrapRelease.ts`
- Create: `optimizer-v2/client/src/app/providers/DatasetProvider.tsx`
- Modify: `optimizer-v2/client/src/main.tsx`

**Interfaces:**
- Consumes: `CharacterProfile` and `DatasetSnapshot`.
- Produces: `optimizeBuild(profile, dataset): RecommendationPlan`.

- [ ] **Step 1: Create the reviewed bootstrap records**

`bootstrapRelease.ts` must contain verified Floor 1 records for:

- Beginner Sword and Iron Sword (One-Handed; Dual Wield uses One-Handed weapons)
- Iron Greatsword
- Iron Rapier
- Iron Dagger
- Fists
- Beginner Armor
- Wooden Shield

Each record includes its exact canonical Fandom URL, review date `2026-08-29`, acquisition detail, requirements, and wiki-listed stats. Add at least one verified next upgrade per sword path from the class list pages so recommendation tests exercise improvement. Mark past-event gear `inactive-event`; none belongs in the bootstrap release unless required by a test.

Use this exact starter/upgrade subset:

- One-Handed/Dual Wield: Beginner Sword (Skill 1, ATK 3.4, starter) and Steel Sword (Skill 5, ATK 8.4, Floor 1/2 shop), source `https://swordbloxonlinerebirth.fandom.com/wiki/One-Handed`.
- Two-Handed: Iron Greatsword (Skill 1, ATK 3, starter/Floor 1 shop) and Steel Greatsword (Skill 5, ATK 10, Floor 1/2 shop), source `https://swordbloxonlinerebirth.fandom.com/wiki/Two-Handed`.
- Rapier: Iron Rapier (Skill 1, ATK 2.6, starter/Floor 1 shop) and Steel Rapier (Skill 5, ATK 7.6, Floor 1/2 shop), source `https://swordbloxonlinerebirth.fandom.com/wiki/Rapier`.
- Dagger: Iron Dagger (Skill 1, ATK 2.5, starter/Floor 1 shop) and Steel Dagger (Skill 5, ATK 7.5, Floor 1/2 shop), source `https://swordbloxonlinerebirth.fandom.com/wiki/Dagger`.
- Melee: Fists (max Skill 30, max ATK 40, starter); no ordinary always-available Melee upgrade is invented, source `https://swordbloxonlinerebirth.fandom.com/wiki/Melee`.
- Armor: Beginner Armor (Level 1, DEF 0.5, DEX 3) and Fields Warrior (Level 3, DEF 1.5, DEX 6), source `https://swordbloxonlinerebirth.fandom.com/wiki/Armor`.
- Shield: Wooden Shield (Level 1, DEF 0.6) and Master Shield (Level 10, DEF 3.3), source `https://swordbloxonlinerebirth.fandom.com/wiki/Shields`.

- [ ] **Step 2: Write failing eligibility tests for every exclusion rule**

Cover unverified records, wrong class, wrong slot, locked floor, level requirements inside and beyond the ten-level horizon, known unmet weapon skill, unknown weapon skill, inactive event ownership, and Dual Wield's two One-Handed weapon slots.

```ts
expect(classifyCandidate(profileWithoutSkill, skill10Sword, new Set())).toEqual({
  eligible: true,
  immediate: false,
  reason: 'Requires Weapon Skill 10; confirm in game',
});
```

- [ ] **Step 3: Implement eligibility exactly**

```ts
export type CandidateClassification =
  | { eligible: false; reason: string }
  | { eligible: true; immediate: boolean; reason?: string };

export function classifyCandidate(
  profile: CharacterProfile,
  item: EquipmentRecord,
  owned: ReadonlySet<string>,
): CandidateClassification;
```

Apply rules in this order: verified status, class/slot compatibility, floor, inactive event unless owned, level, skill requirement. A level requirement above `profile.level + 10` is ineligible; one within the ten-level horizon is eligible but non-immediate with `Requires Level N`. Unknown or unmet skill leaves a candidate eligible but non-immediate with the exact confirmation message because skill growth is not inferred from character levels. Inactive event items owned by the player remain eligible because acquisition is no longer required.

- [ ] **Step 4: Write failing recommendation tests**

Tests must prove:

- a qualifying owned upgrade becomes `Do now`;
- otherwise the strongest obtainable upgrade becomes `Do now`;
- at most three targets are returned;
- target slots are distinct when another meaningful slot improvement exists;
- no improvement returns `keep-current`;
- every target contains source URL, requirement, acquisition, and projected metric delta.

- [ ] **Step 5: Implement recommendation and plan interfaces**

```ts
export interface UpgradeTarget {
  itemId: string;
  slot: EquipmentSlot;
  immediate: boolean;
  acquisitionDetail: string;
  requirementText: string;
  sourceUrl: string;
  delta: Partial<ProjectedMetrics>;
}

export interface RecommendationPlan {
  datasetVersion: string;
  immediateAction:
    | { kind: 'equip-owned'; itemId: string; summary: string }
    | { kind: 'obtain-upgrade'; itemId: string; summary: string }
    | { kind: 'keep-current'; summary: string };
  statPlan: StatAllocationPlan;
  upgradeTargets: UpgradeTarget[];
  explanation: string[];
}

export function optimizeBuild(profile: CharacterProfile, dataset: DatasetSnapshot): RecommendationPlan;
```

Rank equipment using the same named goal dimensions as stat allocation. Calculate deltas by replacing one slot in the current loadout and calling `projectMetrics`; never use an unexplained item-quality score. For ties, sort by immediate owned item, goal-weighted improvement descending, floor ascending, level requirement ascending, then stable item ID.

- [ ] **Step 6: Run the complete optimizer test group**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- src/domain/optimizer`

Expected: PASS with no snapshot updates required.

- [ ] **Step 7: Expose the validated bootstrap dataset to routed screens**

`DatasetProvider` parses `bootstrapRelease` once with `datasetSnapshotSchema` and exposes:

```ts
export type DatasetContextValue = {
  snapshot: DatasetSnapshot;
  source: 'bundled';
};

export function useDataset(): DatasetContextValue;
```

Wrap the draft/router providers in `main.tsx`. A parse failure renders a fatal `Verified game data could not be loaded` screen and never runs the optimizer.

- [ ] **Step 8: Commit equipment optimization**

```powershell
git diff --check
git add optimizer-v2/client/src/domain optimizer-v2/client/src/data
git commit -m "feat: recommend verified progression upgrades"
```

---

### Task 4: Build the guest persistence adapter

**Files:**
- Modify: `optimizer-v2/client/package.json`
- Create: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.ts`
- Create: `optimizer-v2/client/src/infrastructure/storage/guestBuildStore.test.ts`
- Create: `optimizer-v2/client/src/app/providers/BuildDraftProvider.tsx`

**Interfaces:**
- Consumes: Validated `CharacterProfile` objects.
- Produces: `GuestBuildStore` and `useBuildDraft()`; components never call IndexedDB directly.

- [ ] **Step 1: Add the IndexedDB test dependency**

Add `"fake-indexeddb": "6.2.5"` to client dev dependencies and run `npm install` from `optimizer-v2/`.

- [ ] **Step 2: Write failing CRUD and corruption-isolation tests**

Use `fake-indexeddb/auto`. Prove that the active draft survives store re-instantiation, named builds list by `updatedAt` descending, deleting one build preserves others, and a malformed stored row is returned as a per-record error rather than clearing the database.

- [ ] **Step 3: Implement the storage interface**

```ts
export interface StoredGuestBuild {
  profile: CharacterProfile;
  createdAt: string;
  updatedAt: string;
}

export interface GuestBuildStore {
  loadDraft(): Promise<CharacterProfile | null>;
  saveDraft(profile: CharacterProfile): Promise<void>;
  listBuilds(): Promise<Array<{ ok: true; value: StoredGuestBuild } | { ok: false; id: string; error: string }>>;
  saveBuild(profile: CharacterProfile): Promise<void>;
  deleteBuild(id: string): Promise<void>;
}
```

Open database `sbo-rebirth-optimizer-v2`, version `1`, with stores `draft` and `builds`; use profile ID as the key. Parse every read with `characterProfileSchema.safeParse`.

- [ ] **Step 4: Implement `BuildDraftProvider`**

Expose:

```ts
type BuildDraftContextValue = {
  draft: CharacterProfile;
  updateDraft(patch: Partial<CharacterProfile>): void;
  replaceDraft(profile: CharacterProfile): void;
  saveNamedBuild(name: string): Promise<void>;
  resetDraft(): Promise<void>;
  isHydrated: boolean;
};
```

Debounce draft writes by 250 ms, flush on unmount, and surface storage failures through an inline provider error state without losing the in-memory draft.

- [ ] **Step 5: Run persistence tests**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- guestBuildStore.test.ts BuildDraftProvider`

Expected: PASS.

- [ ] **Step 6: Commit guest persistence**

```powershell
git diff --check
git add optimizer-v2/client/package.json optimizer-v2/package-lock.json optimizer-v2/client/src/infrastructure optimizer-v2/client/src/app/providers
git commit -m "feat: persist guest optimizer builds"
```

---

### Task 5: Implement the routed Character, Stats, and Equipment flow

**Files:**
- Create: `optimizer-v2/client/src/app/router.tsx`
- Create: `optimizer-v2/client/src/features/home/HomeScreen.tsx`
- Create: `optimizer-v2/client/src/features/planner/PlannerFrame.tsx`
- Create: `optimizer-v2/client/src/features/planner/CharacterScreen.tsx`
- Create: `optimizer-v2/client/src/features/planner/StatsScreen.tsx`
- Create: `optimizer-v2/client/src/features/planner/EquipmentScreen.tsx`
- Create: `optimizer-v2/client/src/features/planner/plannerScreens.test.tsx`
- Modify: `optimizer-v2/client/src/main.tsx`

**Interfaces:**
- Consumes: `useBuildDraft()`, active `DatasetSnapshot`, and route state.
- Produces: guarded routes `/`, `/character`, `/stats`, `/equipment`, and `/results`.

- [ ] **Step 1: Write failing route and accessibility tests**

Test that:

- Home has `Create Build` and `Resume Build` only when a draft exists.
- Character exposes level, floor, six weapon cards, Balanced default, and collapsed Weapon Skill.
- Stats exposes five labeled numeric inputs and expected/entered/difference feedback.
- Equipment exposes conditional slots and searchable verified items only.
- Direct `/results` access redirects to the earliest incomplete step.
- Continue focuses the next screen heading; failed validation focuses the first invalid control.

- [ ] **Step 2: Implement route completeness functions**

```ts
export function firstIncompleteStep(profile: CharacterProfile): '/character' | '/stats' | '/equipment' | null;
export function expectedInvestedPoints(level: number): number {
  return level * 3;
}
```

Stat-total mismatch is advisory, not blocking. Equipment is complete when required class slots have selected verified records: main hand and armor for all paths; off hand for Dual Wield; shield remains optional for One-Handed, Rapier, and Dagger.

- [ ] **Step 3: Implement `PlannerFrame`**

Render one persistent progress header with four named steps, one `<main>` content area, Back and Continue actions, an `aria-current="step"` marker, and no duplicated generate button.

- [ ] **Step 4: Implement the three setup screens**

Use controlled form values from `useBuildDraft()`. Equipment search results must call `equipmentRecordSchema` through the active dataset adapter and filter by class, slot, floor, and `verificationStatus === 'verified'`. Owned-item selection is an optional compact section, not a full inventory page.

- [ ] **Step 5: Run route/component tests**

Run: `cd optimizer-v2; npm run test:unit --workspace @sbo/optimizer-client -- plannerScreens.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the routed input flow**

```powershell
git diff --check
git add optimizer-v2/client/src/app optimizer-v2/client/src/features optimizer-v2/client/src/main.tsx
git commit -m "feat: add guided optimizer setup flow"
```

---

### Task 6: Render the dedicated Results screen and immersive responsive shell

**Files:**
- Create: `optimizer-v2/client/src/features/results/ResultsScreen.tsx`
- Create: `optimizer-v2/client/src/features/results/ResultsScreen.test.tsx`
- Create: `optimizer-v2/client/src/styles/tokens.css`
- Create: `optimizer-v2/client/src/styles/planner.css`
- Modify: `optimizer-v2/client/src/styles/global.css`
- Modify: `optimizer-v2/client/src/app/router.tsx`
- Create: `optimizer-v2/client/e2e/guest-flow.spec.ts`

**Interfaces:**
- Consumes: `optimizeBuild(draft, activeDataset)`.
- Produces: A separate results route ordered `Do now`, `Next levels`, `Next upgrades`, and `Why this plan`.

- [ ] **Step 1: Write failing Results hierarchy tests**

Assert exactly one primary immediate action, a thirty-point allocation summary, no more than three upgrade cards, visible requirements/acquisition/source links, collapsed explanation by default, and edit links back to all three input screens.

- [ ] **Step 2: Implement `ResultsScreen`**

Call `optimizeBuild` once with `useMemo`. Render recommendation data rather than recomputing formulas in JSX. If no verified upgrade exists, render the `keep-current` message. Source links open in a new tab with `rel="noreferrer"`.

- [ ] **Step 3: Implement the original fantasy design system**

Use these exact base tokens and extend them only for semantic states:

```css
:root {
  --color-void: #090d11;
  --color-ink: #111922;
  --color-steel: #273847;
  --color-parchment: #eee6d2;
  --color-muted: #a9b2b8;
  --color-aether: #55d6c2;
  --color-rune: #7aa7ff;
  --color-gold: #d6b56e;
  --color-danger: #ff7b72;
  --radius-panel: 18px;
  --shadow-panel: 0 20px 60px rgb(0 0 0 / 35%);
}
```

Use layered gradients, CSS borders, and subtle noise-like patterns rather than copyrighted art. Keep content widths under `72rem`, mobile forms single-column, touch targets at least `44px`, focus rings visible, and decorative transitions disabled under `prefers-reduced-motion`.

- [ ] **Step 4: Write the guest end-to-end journey**

`guest-flow.spec.ts` must create a Two-Handed build, enter stats, equip Iron Greatsword and Beginner Armor, generate a result, verify the four result sections, refresh, return Home, and resume the same draft. Add a mobile project at 390×844 and a desktop project at 1440×1000.

- [ ] **Step 5: Run the complete Phase 2 verification**

Run:

```powershell
cd optimizer-v2
npm run test:unit
npm run typecheck
npm run test:integration
npm run build
```

Expected: all commands PASS; Playwright reports both desktop and mobile guest journeys successful.

- [ ] **Step 6: Commit the complete guest optimizer**

```powershell
git diff --check
git add optimizer-v2/client
git commit -m "feat: deliver guest build optimizer flow"
```

## Phase 2 Completion Gate

Phase 2 is complete only when a guest can finish the four-screen flow on desktop and mobile, receive deterministic verified advice, refresh and resume locally, and navigate without keyboard or focus regressions. No account, cloud build, sharing, curation, legacy dashboard, or estimated equipment behavior is present yet.
