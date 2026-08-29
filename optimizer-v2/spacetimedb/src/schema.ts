import { schema, table, t } from 'spacetimedb/server';

export const appConfig = table(
  { name: 'app_config' },
  {
    ownerIdentity: t.identity().primaryKey(),
  },
);

export const datasetRelease = table(
  { name: 'dataset_release', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    version: t.string().unique(),
    formulaSetVersion: t.string(),
    publishedAt: t.timestamp(),
    lastReviewedAt: t.string(),
    sourceSummary: t.string(),
    isCurrent: t.bool(),
  },
);

export const authConfig = table(
  { name: 'auth_config' },
  {
    key: t.string().primaryKey(),
    mode: t.string(),
    issuer: t.string(),
    audience: t.string(),
  },
);

export const userProfile = table(
  { name: 'user_profile' },
  {
    identity: t.identity().primaryKey(),
    guestImportCompletedAt: t.timestamp().optional(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);

export const build = table(
  {
    name: 'build',
    indexes: [
      {
        accessor: 'buildOwner',
        name: 'build_owner',
        algorithm: 'btree',
        columns: ['owner'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    owner: t.identity(),
    name: t.string(),
    headRevisionId: t.string(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);

export const buildRevision = table(
  {
    name: 'build_revision',
    indexes: [
      {
        accessor: 'buildRevisionOwner',
        name: 'build_revision_owner',
        algorithm: 'btree',
        columns: ['owner'],
      },
      {
        accessor: 'buildRevisionBuildId',
        name: 'build_revision_build_id',
        algorithm: 'btree',
        columns: ['buildId'],
      },
    ],
  },
  {
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
    str: t.u32(),
    def: t.u32(),
    agi: t.u32(),
    vit: t.u32(),
    luk: t.u32(),
    datasetVersion: t.string(),
    createdAt: t.timestamp(),
  },
);

export const revisionEquipment = table(
  {
    name: 'revision_equipment',
    indexes: [
      {
        accessor: 'revisionEquipmentRevisionId',
        name: 'revision_equipment_revision_id',
        algorithm: 'btree',
        columns: ['revisionId'],
      },
      {
        accessor: 'revisionEquipmentOwner',
        name: 'revision_equipment_owner',
        algorithm: 'btree',
        columns: ['owner'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    revisionId: t.string(),
    owner: t.identity(),
    slot: t.string(),
    itemId: t.string(),
  },
);

export const revisionOwnedItem = table(
  {
    name: 'revision_owned_item',
    indexes: [
      {
        accessor: 'revisionOwnedItemRevisionId',
        name: 'revision_owned_item_revision_id',
        algorithm: 'btree',
        columns: ['revisionId'],
      },
      {
        accessor: 'revisionOwnedItemOwner',
        name: 'revision_owned_item_owner',
        algorithm: 'btree',
        columns: ['owner'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    revisionId: t.string(),
    owner: t.identity(),
    itemId: t.string(),
  },
);

export const buildShareOwner = table(
  {
    name: 'build_share_owner',
    indexes: [
      {
        accessor: 'buildShareOwnerIdentity',
        name: 'build_share_owner_identity',
        algorithm: 'btree',
        columns: ['owner'],
      },
      {
        accessor: 'buildShareBuildId',
        name: 'build_share_build_id',
        algorithm: 'btree',
        columns: ['buildId'],
      },
    ],
  },
  {
    shareId: t.string().primaryKey(),
    owner: t.identity(),
    buildId: t.string(),
    createdAt: t.timestamp(),
  },
);

export const sharedBuild = table(
  { name: 'shared_build', public: true },
  {
    shareId: t.string().primaryKey(),
    name: t.string(),
    schemaVersion: t.u32(),
    level: t.u32(),
    maxFloor: t.u32(),
    weaponPath: t.string(),
    goal: t.string(),
    weaponSkill: t.u32().optional(),
    str: t.u32(),
    def: t.u32(),
    agi: t.u32(),
    vit: t.u32(),
    luk: t.u32(),
    datasetVersion: t.string(),
    createdAt: t.timestamp(),
  },
);

export const sharedBuildEquipment = table(
  {
    name: 'shared_build_equipment',
    public: true,
    indexes: [
      {
        accessor: 'sharedBuildEquipmentShareId',
        name: 'shared_build_equipment_share_id',
        algorithm: 'btree',
        columns: ['shareId'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    shareId: t.string(),
    slot: t.string(),
    itemId: t.string(),
  },
);

export const sharedBuildOwnedItem = table(
  {
    name: 'shared_build_owned_item',
    public: true,
    indexes: [
      {
        accessor: 'sharedBuildOwnedItemShareId',
        name: 'shared_build_owned_item_share_id',
        algorithm: 'btree',
        columns: ['shareId'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    shareId: t.string(),
    itemId: t.string(),
  },
);

export const curatorRole = table(
  { name: 'curator_role' },
  {
    identity: t.identity().primaryKey(),
    grantedBy: t.identity(),
    grantedAt: t.timestamp(),
  },
);

export const wikiSourceState = table(
  { name: 'wiki_source_state' },
  {
    pageTitle: t.string().primaryKey(),
    lastRevisionId: t.string(),
    lastCheckedAt: t.timestamp(),
  },
);

export const wikiCandidate = table(
  {
    name: 'wiki_candidate',
    indexes: [
      {
        accessor: 'wikiCandidateStatus',
        name: 'wiki_candidate_status',
        algorithm: 'btree',
        columns: ['status'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    pageTitle: t.string(),
    sourceUrl: t.string(),
    revisionId: t.string(),
    revisionTimestamp: t.string(),
    content: t.string(),
    status: t.string(),
    createdAt: t.timestamp(),
  },
);

export const reviewDecision = table(
  {
    name: 'review_decision',
    indexes: [
      {
        accessor: 'reviewDecisionCandidateId',
        name: 'review_decision_candidate_id',
        algorithm: 'btree',
        columns: ['candidateId'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    candidateId: t.string(),
    curator: t.identity(),
    decision: t.string(),
    note: t.string(),
    createdAt: t.timestamp(),
  },
);

export const releaseDraft = table(
  { name: 'release_draft' },
  {
    version: t.string().primaryKey(),
    createdBy: t.identity(),
    formulaSetVersion: t.string(),
    sourceSummary: t.string(),
    lastReviewedAt: t.string(),
    status: t.string(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);

export const draftEquipment = table(
  {
    name: 'draft_equipment',
    indexes: [
      {
        accessor: 'draftEquipmentReleaseVersion',
        name: 'draft_equipment_release_version',
        algorithm: 'btree',
        columns: ['releaseVersion'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    releaseVersion: t.string(),
    itemId: t.string(),
    name: t.string(),
    slot: t.string(),
    weaponPaths: t.string(),
    attack: t.f64(),
    defense: t.f64(),
    dexterity: t.f64(),
    levelRequirement: t.u32(),
    skillRequirement: t.u32().optional(),
    floor: t.u32(),
    acquisitionType: t.string(),
    acquisitionDetail: t.string(),
    availability: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
);

export const draftFormula = table(
  {
    name: 'draft_formula',
    indexes: [
      {
        accessor: 'draftFormulaReleaseVersion',
        name: 'draft_formula_release_version',
        algorithm: 'btree',
        columns: ['releaseVersion'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    releaseVersion: t.string(),
    formulaId: t.string(),
    expression: t.string(),
    units: t.string(),
    applicability: t.string(),
    boundaryBehavior: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
);

export const draftSourceReference = table(
  {
    name: 'draft_source_reference',
    indexes: [
      {
        accessor: 'draftSourceReferenceReleaseVersion',
        name: 'draft_source_reference_release_version',
        algorithm: 'btree',
        columns: ['releaseVersion'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    releaseVersion: t.string(),
    entityKind: t.string(),
    entityId: t.string(),
    sourceUrl: t.string(),
    sourceRevision: t.string(),
    capturedAt: t.string(),
    lastReviewedAt: t.string(),
    candidateId: t.string(),
  },
);

export const equipment = table(
  {
    name: 'equipment',
    public: true,
    indexes: [
      {
        accessor: 'equipmentReleaseVersion',
        name: 'equipment_release_version',
        algorithm: 'btree',
        columns: ['releaseVersion'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    releaseVersion: t.string(),
    itemId: t.string(),
    name: t.string(),
    slot: t.string(),
    weaponPaths: t.string(),
    attack: t.f64(),
    defense: t.f64(),
    dexterity: t.f64(),
    levelRequirement: t.u32(),
    skillRequirement: t.u32().optional(),
    floor: t.u32(),
    acquisitionType: t.string(),
    acquisitionDetail: t.string(),
    availability: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
  },
);

export const formula = table(
  {
    name: 'formula',
    public: true,
    indexes: [
      {
        accessor: 'formulaReleaseVersion',
        name: 'formula_release_version',
        algorithm: 'btree',
        columns: ['releaseVersion'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    releaseVersion: t.string(),
    formulaId: t.string(),
    expression: t.string(),
    units: t.string(),
    applicability: t.string(),
    boundaryBehavior: t.string(),
    sourceRefId: t.string(),
    lastReviewedAt: t.string(),
  },
);

export const sourceReference = table(
  {
    name: 'source_reference',
    public: true,
    indexes: [
      {
        accessor: 'sourceReferenceReleaseVersion',
        name: 'source_reference_release_version',
        algorithm: 'btree',
        columns: ['releaseVersion'],
      },
    ],
  },
  {
    id: t.string().primaryKey(),
    releaseVersion: t.string(),
    entityKind: t.string(),
    entityId: t.string(),
    sourceUrl: t.string(),
    sourceRevision: t.string(),
    capturedAt: t.string(),
    lastReviewedAt: t.string(),
  },
);

const spacetimedb = schema({
  appConfig,
  datasetRelease,
  authConfig,
  userProfile,
  build,
  buildRevision,
  revisionEquipment,
  revisionOwnedItem,
  buildShareOwner,
  sharedBuild,
  sharedBuildEquipment,
  sharedBuildOwnedItem,
  curatorRole,
  wikiSourceState,
  wikiCandidate,
  reviewDecision,
  releaseDraft,
  draftEquipment,
  draftFormula,
  draftSourceReference,
  equipment,
  formula,
  sourceReference,
});

export type AppSchema = (typeof spacetimedb)['schemaType'];
export default spacetimedb;
