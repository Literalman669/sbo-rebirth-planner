import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import daggerFixture from './fixtures/dagger.wikitext?raw';
import statsFixture from './fixtures/stats.wikitext?raw';
import { CandidateReview, type CandidateRecord } from './CandidateReview';
import {
  CurationAccessGate,
} from './CurationScreen';
import { applyCandidateAcceptance } from './curationWorkflow';
import { PublishReleasePanel } from './PublishReleasePanel';
import { ReleaseDraftEditor } from './ReleaseDraftEditor';

const statsCandidate: CandidateRecord = {
  id: 'stats:23125',
  pageTitle: 'Stats',
  sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
  revisionId: '23125',
  revisionTimestamp: '2025-11-03T13:14:55Z',
  content: statsFixture,
  status: 'pending',
};

describe('CurationAccessGate', () => {
  it('renders a not-found route for ordinary signed-in users', () => {
    render(
      <CurationAccessGate isReady access={null}>
        <p>Private curation</p>
      </CurationAccessGate>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(screen.queryByText('Private curation')).not.toBeInTheDocument();
  });
});

describe('CandidateReview', () => {
  it('shows parser warnings without interpreting wikitext as HTML', async () => {
    const user = userEvent.setup();
    render(
      <CandidateReview
        candidate={statsCandidate}
        draftVersion="2026.08.29.4"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText(/does not state points awarded per level/i)).toBeVisible();
    await user.click(screen.getByText('Captured wikitext fragment'));
    expect(screen.getByText(/Canonical page: Stats/)).toBeVisible();
  });

  it('requires a rejection note before calling the review action', async () => {
    const user = userEvent.setup();
    const reject = vi.fn(async () => undefined);
    render(
      <CandidateReview
        candidate={statsCandidate}
        draftVersion="2026.08.29.4"
        onAccept={vi.fn()}
        onReject={reject}
      />,
    );

    const button = screen.getByRole('button', { name: 'Reject candidate' });
    expect(button).toBeDisabled();
    await user.type(
      screen.getByLabelText('Rejection note'),
      'The points-per-level rule is missing.',
    );
    await user.click(button);

    expect(reject).toHaveBeenCalledWith('The points-per-level rule is missing.');
  });

  it('allows a curator to accept an allowlisted source-only revision with a note', async () => {
    const user = userEvent.setup();
    const acceptSourceOnly = vi.fn(async () => undefined);
    render(
      <CandidateReview
        candidate={{
          ...statsCandidate,
          id: 'fists:21749',
          pageTitle: 'Fists',
          sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Fists',
          revisionId: '21749',
          content: 'Reviewed Fists infobox',
        }}
        draftVersion="2026.08.30.1"
        onAccept={vi.fn()}
        onAcceptSourceOnly={acceptSourceOnly}
        onReject={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText('Review note'),
      'Compared the Fists infobox to the existing verified starter row.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Accept source revision only' }),
    );

    expect(acceptSourceOnly).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fists:21749' }),
      'Compared the Fists infobox to the existing verified starter row.',
    );
  });
});

describe('applyCandidateAcceptance', () => {
  it('writes parsed proposal and provenance rows before accepting the candidate', async () => {
    const reducers = {
      upsertDraftEquipment: vi.fn(async () => undefined),
      upsertDraftFormula: vi.fn(async () => undefined),
      upsertDraftSourceReference: vi.fn(async () => undefined),
      recordReviewDecision: vi.fn(async () => undefined),
    };
    const candidate: CandidateRecord = {
      ...statsCandidate,
      id: 'dagger:26212',
      pageTitle: 'Dagger',
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Dagger',
      revisionId: '26212',
      revisionTimestamp: '2026-06-21T05:38:53Z',
      content: daggerFixture,
    };

    await applyCandidateAcceptance({
      candidate,
      draft: { version: '2026.08.29.4', lastReviewedAt: '2026-08-29' },
      reducers,
    });

    expect(reducers.upsertDraftSourceReference).toHaveBeenCalledWith(
      expect.objectContaining({
        entityKind: 'equipment',
        entityId: 'iron-dagger',
        candidateId: 'dagger:26212',
      }),
    );
    expect(reducers.upsertDraftEquipment).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'iron-dagger',
        attack: 2.5,
        weaponPaths: 'dagger',
      }),
    );
    expect(reducers.recordReviewDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'dagger:26212',
        decision: 'accept',
      }),
    );
    expect(reducers.recordReviewDecision.mock.invocationCallOrder[0]).toBeGreaterThan(
      reducers.upsertDraftEquipment.mock.invocationCallOrder[0]!,
    );
  });
});

describe('PublishReleasePanel', () => {
  it('disables invalid publication and shows a summary after success', async () => {
    const user = userEvent.setup();
    const publish = vi.fn(async () => undefined);
    const { rerender } = render(
      <PublishReleasePanel
        version="2026.08.29.4"
        validationErrors={['Missing required formula: points-per-level']}
        onPublish={publish}
      />,
    );

    expect(screen.getByRole('button', { name: 'Publish verified release' })).toBeDisabled();
    rerender(
      <PublishReleasePanel
        version="2026.08.29.4"
        validationErrors={[]}
        onPublish={publish}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Publish verified release' }),
    );

    expect(await screen.findByText('Release 2026.08.29.4 is live.')).toBeVisible();
  });
});

describe('ReleaseDraftEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('can start a complete draft from the current verified release', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const clone = vi.fn(async () => undefined);
    render(
      <ReleaseDraftEditor
        drafts={[]}
        selectedVersion={null}
        counts={{ equipment: 0, formulas: 0, sources: 0 }}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onCloneCurrent={clone}
      />,
    );

    await user.click(screen.getByText('Create another draft'));
    await user.type(screen.getByLabelText('Version'), '2026.08.30.1');
    await user.type(
      screen.getByLabelText('Source summary'),
      'Carry forward the verified release for one focused update.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Start with current verified data' }),
    );

    expect(clone).toHaveBeenCalledWith({
      version: '2026.08.30.1',
      sourceSummary:
        'Carry forward the verified release for one focused update.',
      lastReviewedAt: '2026-08-29',
    });
  });
});
