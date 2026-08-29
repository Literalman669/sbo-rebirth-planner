import { useMemo, useState } from 'react';
import type { EquipmentRecord, FormulaRecord } from '../../domain/dataset/model';
import {
  parseArmorListPage,
  parseHeadwearListPage,
  parseShieldListPage,
  parseStatsPage,
  parseWeaponListPage,
  type ParsedProposal,
} from './wikiTableParser';

export interface CandidateRecord {
  id: string;
  pageTitle: string;
  sourceUrl: string;
  revisionId: string;
  revisionTimestamp: string;
  content: string;
  status: string;
}

export interface CandidateProposalSet {
  equipment: ParsedProposal<EquipmentRecord>[];
  formulas: ParsedProposal<FormulaRecord>[];
  warnings: string[];
}

export function proposalsForCandidate(
  candidate: CandidateRecord,
): CandidateProposalSet {
  if (candidate.pageTitle === 'Stats') {
    const formulas = parseStatsPage(candidate.content);
    return { equipment: [], formulas, warnings: formulas.warnings };
  }
  if (
    ['One-Handed', 'Two-Handed', 'Rapier', 'Dagger', 'Melee'].includes(
      candidate.pageTitle,
    )
  ) {
    const equipment = parseWeaponListPage(
      candidate.pageTitle,
      candidate.content,
    );
    return { equipment, formulas: [], warnings: equipment.warnings };
  }
  if (candidate.pageTitle === 'Armor') {
    const equipment = parseArmorListPage(candidate.content);
    return { equipment, formulas: [], warnings: equipment.warnings };
  }
  if (candidate.pageTitle === 'Shields') {
    const equipment = parseShieldListPage(candidate.content);
    return { equipment, formulas: [], warnings: equipment.warnings };
  }
  if (
    candidate.pageTitle === 'Upper Headwear' ||
    candidate.pageTitle === 'Lower Headwear'
  ) {
    const equipment = parseHeadwearListPage(
      candidate.pageTitle === 'Upper Headwear' ? 'upper-head' : 'lower-head',
      candidate.content,
    );
    return { equipment, formulas: [], warnings: equipment.warnings };
  }
  return {
    equipment: [],
    formulas: [],
    warnings: [`No reviewed parser is available for ${candidate.pageTitle}`],
  };
}

type CandidateReviewProps = {
  candidate: CandidateRecord;
  draftVersion: string | null;
  currentValues?: readonly string[];
  onAccept(candidate: CandidateRecord): Promise<void> | void;
  onReject(note: string): Promise<void> | void;
};

export function CandidateReview({
  candidate,
  draftVersion,
  currentValues = [],
  onAccept,
  onReject,
}: CandidateReviewProps) {
  const proposals = useMemo(
    () => proposalsForCandidate(candidate),
    [candidate],
  );
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<'accept' | 'reject' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const proposalCount = proposals.equipment.length + proposals.formulas.length;

  async function run(action: 'accept' | 'reject') {
    setError(null);
    setPendingAction(action);
    try {
      if (action === 'accept') await onAccept(candidate);
      else await onReject(note.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article className="curation-card candidate-review">
      <header className="curation-card__header">
        <div>
          <p className="curation-eyebrow">Pending source revision</p>
          <h2>{candidate.pageTitle}</h2>
        </div>
        <span className="curation-badge">Revision {candidate.revisionId}</span>
      </header>

      <div className="candidate-meta">
        <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">
          Open canonical source
        </a>
        <span>{candidate.revisionTimestamp}</span>
      </div>

      <div className="candidate-compare">
        <section>
          <h3>Current production</h3>
          {currentValues.length > 0 ? (
            <ul>
              {currentValues.map((value) => <li key={value}>{value}</li>)}
            </ul>
          ) : (
            <p className="curation-muted">No matching production rows.</p>
          )}
        </section>
        <section>
          <h3>Parsed proposal</h3>
          <ul>
            {proposals.equipment.map(({ value }) => (
              <li key={`equipment:${value.id}`}>
                {value.name}: ATK {value.attack}, DEF {value.defense}, DEX{' '}
                {value.dexterity}
              </li>
            ))}
            {proposals.formulas.map(({ value }) => (
              <li key={`formula:${value.id}`}>
                {value.id}: {value.expression}
              </li>
            ))}
          </ul>
          {proposalCount === 0 && (
            <p className="curation-muted">No safe proposals were produced.</p>
          )}
        </section>
      </div>

      {proposals.warnings.length > 0 && (
        <aside className="curation-warning" aria-label="Parser warnings">
          <h3>Review warnings</h3>
          <ul>
            {proposals.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </aside>
      )}

      <details>
        <summary>Captured wikitext fragment</summary>
        <pre className="candidate-source">{candidate.content}</pre>
      </details>

      <div className="candidate-actions">
        <button
          type="button"
          disabled={
            !draftVersion || proposalCount === 0 || pendingAction !== null
          }
          onClick={() => void run('accept')}
        >
          Accept into {draftVersion ?? 'a selected draft'}
        </button>
        <label>
          Rejection note
          <textarea
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            rows={3}
          />
        </label>
        <button
          type="button"
          className="button-secondary"
          disabled={note.trim().length === 0 || pendingAction !== null}
          onClick={() => void run('reject')}
        >
          Reject candidate
        </button>
      </div>
      {error && <p className="curation-error" role="alert">{error}</p>}
    </article>
  );
}
