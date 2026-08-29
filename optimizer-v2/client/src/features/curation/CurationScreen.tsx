import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Identity } from 'spacetimedb';
import { useProcedure, useReducer, useTable } from 'spacetimedb/react';
import { procedures, reducers, tables } from '../../module_bindings';
import type {
  DraftEquipment,
  DraftFormula,
  DraftSourceReference,
  Formula,
  ReleaseDraft,
  WikiCandidate,
  Equipment,
} from '../../module_bindings/types';
import {
  CandidateReview,
  type CandidateRecord,
} from './CandidateReview';
import {
  applyCandidateAcceptance,
  productionValues,
  releaseReadinessErrors,
  type AcceptanceReducers,
} from './curationWorkflow';
import { PublishReleasePanel } from './PublishReleasePanel';
import { ReleaseDraftEditor } from './ReleaseDraftEditor';

const allowedWikiPages = [
  'Stats',
  'One-Handed',
  'Two-Handed',
  'Rapier',
  'Dagger',
  'Melee',
  'Fists',
  'Armor',
  'Shields',
  'Upper Headwear',
  'Lower Headwear',
  'Gamepass and Badge Equipment',
  'Bestiary',
] as const;

export function CurationAccessGate({
  isReady,
  access,
  children,
}: {
  isReady: boolean;
  access: 'owner' | 'curator' | null;
  children: ReactNode;
}) {
  if (!isReady) {
    return <main className="curation-route"><p>Checking curator access…</p></main>;
  }
  if (!access) {
    return (
      <main className="curation-route curation-not-found">
        <p className="curation-eyebrow">404</p>
        <h2>Page not found</h2>
        <p>This route is not available for this identity.</p>
      </main>
    );
  }
  return children;
}

export function CurationScreen() {
  const [accessRows, accessReady] = useTable(tables.myCuratorAccess);
  const [candidateRows] = useTable(tables.myWikiCandidates);
  const [draftRows] = useTable(tables.myReleaseDrafts);
  const [draftEquipmentRows] = useTable(tables.myDraftEquipment);
  const [draftFormulaRows] = useTable(tables.myDraftFormulas);
  const [draftSourceRows] = useTable(tables.myDraftSourceReferences);
  const [releaseRows] = useTable(tables.datasetRelease);
  const [publicEquipment] = useTable(tables.equipment);
  const [publicFormulas] = useTable(tables.formula);
  const createDraft = useReducer(reducers.createReleaseDraft);
  const cloneCurrentRelease = useReducer(
    reducers.createReleaseDraftFromCurrent,
  );
  const upsertDraftEquipment = useReducer(reducers.upsertDraftEquipment);
  const upsertDraftFormula = useReducer(reducers.upsertDraftFormula);
  const upsertDraftSourceReference = useReducer(
    reducers.upsertDraftSourceReference,
  );
  const recordReviewDecision = useReducer(reducers.recordReviewDecision);
  const publishRelease = useReducer(reducers.publishRelease);
  const grantCurator = useReducer(reducers.grantCurator);
  const revokeCurator = useReducer(reducers.revokeCurator);
  const fetchWikiCandidate = useProcedure(procedures.fetchWikiCandidate);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState<(typeof allowedWikiPages)[number]>(
    'Stats',
  );
  const [fetchState, setFetchState] = useState<string | null>(null);
  const [roleIdentity, setRoleIdentity] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);

  const access = accessRows[0]?.access;
  const curatorAccess =
    access === 'owner' || access === 'curator' ? access : null;
  const candidates = candidateRows as readonly WikiCandidate[];
  const drafts = draftRows as readonly ReleaseDraft[];
  useEffect(() => {
    if (
      selectedVersion &&
      drafts.some((draft) => draft.version === selectedVersion)
    ) {
      return;
    }
    setSelectedVersion(
      drafts.find((draft) => draft.status !== 'published')?.version ??
        drafts[0]?.version ??
        null,
    );
  }, [drafts, selectedVersion]);

  const selectedDraft = drafts.find(
    (draft) => draft.version === selectedVersion,
  );
  const selectedEquipment = (draftEquipmentRows as readonly DraftEquipment[]).filter(
    (row) => row.releaseVersion === selectedVersion,
  );
  const selectedFormulas = (draftFormulaRows as readonly DraftFormula[]).filter(
    (row) => row.releaseVersion === selectedVersion,
  );
  const selectedSources = (draftSourceRows as readonly DraftSourceReference[]).filter(
    (row) => row.releaseVersion === selectedVersion,
  );
  const validationErrors = useMemo(
    () =>
      releaseReadinessErrors({
        draft: selectedDraft,
        equipment: selectedEquipment,
        formulas: selectedFormulas,
        sources: selectedSources,
        candidates,
      }),
    [candidates, selectedDraft, selectedEquipment, selectedFormulas, selectedSources],
  );
  const currentVersion = releaseRows.find((release) => release.isCurrent)?.version;

  const acceptanceReducers: AcceptanceReducers = {
    upsertDraftEquipment,
    upsertDraftFormula,
    upsertDraftSourceReference,
    recordReviewDecision,
  };

  async function accept(candidate: CandidateRecord) {
    if (!selectedDraft) throw new Error('Select a release draft first');
    await applyCandidateAcceptance({
      candidate,
      draft: selectedDraft,
      reducers: acceptanceReducers,
    });
  }

  async function fetchPage() {
    setFetchState('Checking the canonical revision…');
    try {
      const candidateId = await fetchWikiCandidate({ pageTitle });
      setFetchState(`Staged ${candidateId} for private review.`);
    } catch (caught) {
      setFetchState(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function changeRole(action: 'grant' | 'revoke') {
    setRoleError(null);
    try {
      const identity = Identity.fromString(roleIdentity.trim());
      if (action === 'grant') await grantCurator({ identity });
      else await revokeCurator({ identity });
      setRoleIdentity('');
    } catch (caught) {
      setRoleError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <CurationAccessGate isReady={accessReady} access={curatorAccess}>
      <main className="curation-route">
        <header className="curation-hero">
          <div>
            <p className="curation-eyebrow">Private operations</p>
            <h2>Verified data workshop</h2>
            <p>
              Stage canonical revisions, inspect every parser warning, and publish
              only a complete typed release.
            </p>
          </div>
          <span className="curation-badge">{curatorAccess}</span>
        </header>

        <section className="curation-fetch curation-card">
          <label>
            Canonical wiki page
            <select
              value={pageTitle}
              onChange={(event) =>
                setPageTitle(
                  event.currentTarget.value as (typeof allowedWikiPages)[number],
                )
              }
            >
              {allowedWikiPages.map((page) => <option key={page}>{page}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void fetchPage()}>
            Check latest revision
          </button>
          {fetchState && <p role="status">{fetchState}</p>}
        </section>

        <div className="curation-layout">
          <aside>
            <ReleaseDraftEditor
              drafts={drafts}
              selectedVersion={selectedVersion}
              counts={{
                equipment: selectedEquipment.length,
                formulas: selectedFormulas.length,
                sources: selectedSources.length,
              }}
              onSelect={setSelectedVersion}
              onCreate={async (input) => {
                await createDraft(input);
                setSelectedVersion(input.version);
              }}
              onCloneCurrent={async (input) => {
                await cloneCurrentRelease(input);
                setSelectedVersion(input.version);
              }}
            />
            <PublishReleasePanel
              version={selectedVersion}
              validationErrors={validationErrors}
              onPublish={async (version) => publishRelease({ version })}
            />
            {curatorAccess === 'owner' && (
              <details className="curation-card owner-tools">
                <summary>Owner role management</summary>
                <label>
                  Curator identity
                  <input
                    value={roleIdentity}
                    onChange={(event) => setRoleIdentity(event.currentTarget.value)}
                  />
                </label>
                <div className="owner-tools__actions">
                  <button type="button" onClick={() => void changeRole('grant')}>
                    Grant curator
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void changeRole('revoke')}
                  >
                    Revoke curator
                  </button>
                </div>
                {roleError && <p className="curation-error">{roleError}</p>}
              </details>
            )}
          </aside>

          <section className="candidate-list" aria-label="Pending candidates">
            {(candidates as readonly CandidateRecord[])
              .filter((candidate) => candidate.status === 'pending')
              .map((candidate) => (
                <CandidateReview
                  key={candidate.id}
                  candidate={candidate}
                  draftVersion={selectedVersion}
                  currentValues={productionValues(
                    candidate,
                    currentVersion,
                    publicEquipment as readonly Equipment[],
                    publicFormulas as readonly Formula[],
                  )}
                  onAccept={accept}
                  onAcceptSourceOnly={async (sourceCandidate, note) =>
                    recordReviewDecision({
                      id: `review:source-only:${sourceCandidate.id}`,
                      candidateId: sourceCandidate.id,
                      decision: 'accept',
                      note,
                    })
                  }
                  onReject={async (note) =>
                    recordReviewDecision({
                      id: `review:reject:${candidate.id}`,
                      candidateId: candidate.id,
                      decision: 'reject',
                      note,
                    })
                  }
                />
              ))}
            {!candidates.some((candidate) => candidate.status === 'pending') && (
              <section className="curation-card empty-candidates">
                <h2>No revisions awaiting review</h2>
                <p>Check an allowlisted page to stage its latest canonical revision.</p>
              </section>
            )}
          </section>
        </div>
      </main>
    </CurationAccessGate>
  );
}
