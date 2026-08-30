import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import {
  resolveDatasetSnapshot,
  useDataset,
} from '../../app/providers/DatasetProvider';
import type { EquipmentSlot } from '../../domain/build/model';
import type { ProjectedMetrics } from '../../domain/optimizer/projections';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import { assessOptimizationReadiness } from '../../domain/optimizer/planReadiness';
import { WeaponPathIcon } from '../planner/WeaponPathIcon';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import { isPlanStale } from './planStaleness';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { firstIncompleteEquipmentStep } from '../planner/completeness';
import { LevelAllocationTable, SpendNowPanel } from './LevelAllocationTable';

const slotLabels: Record<EquipmentSlot, string> = {
  'main-hand': 'Main hand',
  'off-hand': 'Off hand',
  armor: 'Armor',
  shield: 'Shield',
  'upper-head': 'Upper headwear',
  'lower-head': 'Lower headwear',
};

const metricLabels: Record<keyof ProjectedMetrics, string> = {
  attackPerHit: 'damage per hit',
  damageReductionPerHit: 'damage reduction',
  bonusHp: 'bonus HP',
  stamina: 'stamina',
  walkSpeedBonus: 'walk speed',
  sprintSpeedBonus: 'sprint speed',
  critChanceBonus: 'critical chance',
  dropChanceBonus: 'drop chance',
};

function formatDelta(delta: Partial<ProjectedMetrics>) {
  const ranked = Object.entries(delta)
    .filter(([, value]) => typeof value === 'number' && Math.abs(value) > 1e-9)
    .sort(([, left], [, right]) => Math.abs(right!) - Math.abs(left!));
  if (ranked.length === 0) return 'No projected metric change';
  const [metric, value] = ranked[0] as [keyof ProjectedMetrics, number];
  const percentMetric = metric === 'critChanceBonus' || metric === 'dropChanceBonus';
  const formatted = percentMetric
    ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
    : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  return `${formatted} ${metricLabels[metric]}`;
}

export function ResultsScreen() {
  const navigate = useNavigate();
  const cloud = useOptionalCloudBuilds();
  const { snapshot, getSnapshot } = useDataset();
  const { draft, resetDraft, saveNamedBuild } = useBuildDraft();
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [buildName, setBuildName] = useState(draft.name ?? '');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [planSnapshot, setPlanSnapshot] = useState<
    DatasetSnapshot | null | undefined
  >(() => (draft.datasetVersion === snapshot.version ? snapshot : undefined));
  const [planVersion, setPlanVersion] = useState(draft.datasetVersion);
  useEffect(() => {
    setPlanVersion(draft.datasetVersion);
  }, [draft.datasetVersion, draft.id]);
  useEffect(() => {
    let active = true;
    if (planVersion === snapshot.version) {
      setPlanSnapshot(snapshot);
      return () => {
        active = false;
      };
    }
    setPlanSnapshot((current) =>
      current?.version === planVersion ? current : undefined,
    );
    void resolveDatasetSnapshot(getSnapshot, planVersion).then((resolved) => {
      if (active) setPlanSnapshot(resolved);
    });
    return () => {
      active = false;
    };
  }, [getSnapshot, planVersion, snapshot]);
  const stale = isPlanStale(planVersion, snapshot.version);
  const incompleteEquipment = planSnapshot
    ? firstIncompleteEquipmentStep(draft, planSnapshot)
    : null;
  const readiness = useMemo(
    () =>
      planSnapshot
        ? assessOptimizationReadiness(draft, planSnapshot.pointsPerLevel)
        : null,
    [draft, planSnapshot],
  );
  const plan = useMemo(
    () =>
      planSnapshot && readiness?.status === 'ready' && !incompleteEquipment
        ? optimizeBuild(draft, planSnapshot)
        : null,
    [draft, incompleteEquipment, planSnapshot, readiness],
  );
  const equipmentById = useMemo(
    () =>
      planSnapshot
        ? new Map(planSnapshot.equipment.map((item) => [item.id, item]))
        : null,
    [planSnapshot],
  );

  const submitSave = (event: FormEvent) => {
    event.preventDefault();
    void saveNamedBuild(buildName, {
      datasetVersion: planSnapshot?.version ?? draft.datasetVersion,
    })
      .then(async (savedBuild) => {
        if (!cloud?.isAuthenticated) return 'local' as const;
        const result = await cloud.repository.save(savedBuild);
        await cloud.refreshPending();
        return result.location;
      })
      .then((location) => {
        setSaveMessage(
          location === 'cloud'
            ? 'Build saved to your cloud archive'
            : location === 'cloud-pending'
              ? 'Build saved locally and queued for cloud sync'
              : 'Build saved locally',
        );
        setShowSaveForm(false);
      })
      .catch((error: unknown) => {
        setSaveMessage(error instanceof Error ? error.message : 'Build save failed');
      });
  };

  const recalculateWithCurrentDataset = () => {
    setPlanVersion(snapshot.version);
    setPlanSnapshot(snapshot);
  };

  if (planSnapshot === undefined) {
    return (
      <section className="planner-screen results-screen">
        <h2 data-screen-heading tabIndex={-1}>Loading the plan's verified dataset…</h2>
      </section>
    );
  }

  if (planSnapshot === null) {
    return (
      <section className="planner-screen results-screen">
        <h2 data-screen-heading tabIndex={-1}>
          Dataset {planVersion} is unavailable.
        </h2>
        <p>The saved plan cannot be reproduced safely with a substitute release.</p>
        <button type="button" onClick={recalculateWithCurrentDataset}>
          Recalculate with dataset {snapshot.version}
        </button>
      </section>
    );
  }

  if (readiness?.status !== 'ready') {
    return (
      <section className="planner-screen results-screen">
        <h2 data-screen-heading tabIndex={-1}>Optimization unavailable</h2>
        <p>{readiness?.explanation}</p>
      </section>
    );
  }

  if (incompleteEquipment) {
    return <Navigate to={incompleteEquipment} replace />;
  }

  if (!plan || !equipmentById) return null;

  return (
    <section className="planner-screen results-screen">
      <h2 data-screen-heading tabIndex={-1}>
        Your next ten levels, made clear.
      </h2>

      <nav aria-label="Edit build sections" className="edit-links">
        <Link to="/character">Edit Character</Link>
        <Link to="/stats">Edit Stats</Link>
        <Link to="/equipment">Edit Equipment</Link>
      </nav>

      {stale && (
        <aside className="stale-plan-banner" role="status">
          <p>
            This plan was created with dataset {planVersion}. A newer verified
            release is available.
          </p>
          <button type="button" onClick={recalculateWithCurrentDataset}>
            Recalculate with dataset {snapshot.version}
          </button>
        </aside>
      )}

      <section aria-labelledby="do-now-heading" className="result-band">
        <h3 id="do-now-heading">Do now</h3>
        <div className="immediate-action" data-testid="immediate-action">
          <span className="weapon-icon">
            <WeaponPathIcon path={draft.weaponPath} />
          </span>
          <strong>{plan.immediateAction.summary}</strong>
        </div>
      </section>

      <SpendNowPanel current={draft.stats} allocation={plan.statPlan.spendNow} />

      <section aria-labelledby="next-levels-heading" className="result-band">
        <div className="result-band-heading">
          <h3 id="next-levels-heading">Next ten levels</h3>
          <strong>30 future points</strong>
        </div>
        {plan.warnings.length > 0 ? (
          <aside className="plan-warnings" role="status">
            {plan.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </aside>
        ) : null}
        <LevelAllocationTable rows={plan.statPlan.levelRows} />
      </section>

      <section
        aria-labelledby="next-upgrades-heading"
        className="result-band"
      >
        <h3 id="next-upgrades-heading">Next upgrades</h3>
        {plan.upgradeTargets.length === 0 ? (
          <p>No verified upgrade is available in your current progression range.</p>
        ) : (
          <div className="upgrade-list">
            {plan.upgradeTargets.map((target) => {
              const item = equipmentById.get(target.itemId);
              return (
                <article className="upgrade-row" data-testid="upgrade-target" key={`${target.slot}:${target.itemId}`}>
                  <div>
                    <strong>{item?.name ?? target.itemId}</strong>
                    <span>{slotLabels[target.slot]}</span>
                  </div>
                  <div>
                    <span>Requirement</span>
                    <strong>{target.requirementText}</strong>
                  </div>
                  {target.eligibilityNote ? (
                    <div>
                      <span>Eligibility</span>
                      <strong>{target.eligibilityNote}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>How to obtain</span>
                    <strong>{target.acquisitionDetail}</strong>
                  </div>
                  <div>
                    <span>Projected improvement</span>
                    <strong>{formatDelta(target.delta)}</strong>
                  </div>
                  <a href={target.sourceUrl} target="_blank" rel="noreferrer">
                    View wiki source
                  </a>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <details className="result-band why-plan">
        <summary>Why this plan</summary>
        <ul>
          {plan.explanation.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </details>

      {showSaveForm ? (
        <form className="save-build-form" onSubmit={submitSave}>
          <label>
            Build Name
            <input
              value={buildName}
              maxLength={60}
              onChange={(event) => setBuildName(event.currentTarget.value)}
            />
          </label>
          <button type="submit">Save Build</button>
        </form>
      ) : null}
      {saveMessage ? <p role="status">{saveMessage}</p> : null}

      <div className="screen-actions results-actions">
        <button type="button" onClick={() => setShowSaveForm(true)}>
          Save Build
        </button>
        <button
          type="button"
          onClick={() => {
            void resetDraft().then(() => navigate('/character'));
          }}
        >
          Start another build
        </button>
        {cloud?.isAuthenticated &&
        cloud.cloudBuilds.some((record) => record.profile.id === draft.id) ? (
          shareId ? (
            <button
              type="button"
              onClick={() => {
                void cloud
                  .revokeShare(shareId)
                  .then(() => {
                    setShareId(null);
                    setShareMessage('Shared link revoked');
                  })
                  .catch((error: unknown) =>
                    setShareMessage(
                      error instanceof Error ? error.message : 'Revoke failed',
                    ),
                  );
              }}
            >
              Revoke shared link
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void cloud
                  .createShare(draft.id)
                  .then((createdShareId) => {
                    setShareId(createdShareId);
                    setShareMessage('Read-only shared link created');
                  })
                  .catch((error: unknown) =>
                    setShareMessage(
                      error instanceof Error ? error.message : 'Share failed',
                    ),
                  );
              }}
            >
              Share Build
            </button>
          )
        ) : null}
      </div>
      {shareId ? (
        <p className="share-link">
          <a href={`${import.meta.env.BASE_URL}shared/${shareId}`}>
            Open read-only shared build
          </a>
        </p>
      ) : null}
      {shareMessage ? <p role="status">{shareMessage}</p> : null}
    </section>
  );
}
