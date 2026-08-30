import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTable } from 'spacetimedb/react';
import {
  resolveDatasetSnapshot,
  useDataset,
} from '../../app/providers/DatasetProvider';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import { assessOptimizationReadiness } from '../../domain/optimizer/planReadiness';
import { tables } from '../../module_bindings';

type SharedBuildViewProps = {
  profile: CharacterProfile;
  snapshot: DatasetSnapshot;
};

export function SharedBuildView({ profile, snapshot }: SharedBuildViewProps) {
  const readiness = useMemo(
    () => assessOptimizationReadiness(profile, snapshot.pointsPerLevel),
    [profile, snapshot.pointsPerLevel],
  );
  const plan = useMemo(
    () =>
      readiness.status === 'ready' ? optimizeBuild(profile, snapshot) : null,
    [profile, readiness.status, snapshot],
  );
  const items = useMemo(
    () => new Map(snapshot.equipment.map((item) => [item.id, item])),
    [snapshot.equipment],
  );

  if (readiness.status !== 'ready') {
    return (
      <main className="planner-screen shared-build-screen">
        <p className="eyebrow">Read-only shared snapshot</p>
        <h2>Optimization unavailable</h2>
        <p>{readiness.explanation}</p>
      </main>
    );
  }

  if (!plan) return null;

  return (
    <main className="planner-screen shared-build-screen">
      <p className="eyebrow">Read-only shared snapshot</p>
      <h2>{profile.name ?? 'Shared build'}</h2>
      <p>Dataset {profile.datasetVersion}</p>
      <section className="result-band" aria-labelledby="shared-now-heading">
        <h3 id="shared-now-heading">Do now</h3>
        <strong>{plan.immediateAction.summary}</strong>
      </section>
      <section className="result-band" aria-labelledby="shared-levels-heading">
        <h3 id="shared-levels-heading">Next levels</h3>
        <ul>
          {plan.statPlan.milestones.map((milestone) => (
            <li key={milestone.afterLevel}>
              Level +{milestone.afterLevel}: STR +{milestone.added.str}, DEF +
              {milestone.added.def}, AGI +{milestone.added.agi}, VIT +
              {milestone.added.vit}, LUK +{milestone.added.luk}
            </li>
          ))}
        </ul>
      </section>
      <section className="result-band" aria-labelledby="shared-upgrades-heading">
        <h3 id="shared-upgrades-heading">Next upgrades</h3>
        {plan.upgradeTargets.length === 0 ? (
          <p>No verified upgrade is available in this progression range.</p>
        ) : (
          <ul>
            {plan.upgradeTargets.map((target) => (
              <li key={`${target.slot}:${target.itemId}`}>
                <strong>{items.get(target.itemId)?.name ?? target.itemId}</strong>{' '}
                — {target.acquisitionDetail}{' '}
                <a href={target.sourceUrl} target="_blank" rel="noreferrer">
                  Wiki source
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type SharedBuildRow = {
  shareId: string;
  schemaVersion: number;
  name: string;
  level: number;
  maxFloor: number;
  weaponPath: string;
  goal: string;
  weaponSkill?: number;
  str: number;
  def: number;
  agi: number;
  vit: number;
  luk: number;
  datasetVersion: string;
};

export function ResolvedSharedBuild({
  shareId,
  build,
  equipment,
  ownedItems,
}: {
  shareId: string;
  build: SharedBuildRow;
  equipment: readonly { slot: string; itemId: string }[];
  ownedItems: readonly { itemId: string }[];
}) {
  const { getSnapshot } = useDataset();
  const [historicalSnapshot, setHistoricalSnapshot] = useState<
    DatasetSnapshot | null | undefined
  >(undefined);
  useEffect(() => {
    let active = true;
    setHistoricalSnapshot(undefined);
    void resolveDatasetSnapshot(getSnapshot, build.datasetVersion).then((resolved) => {
      if (active) setHistoricalSnapshot(resolved);
    });
    return () => {
      active = false;
    };
  }, [build.datasetVersion, getSnapshot]);

  const parsed = characterProfileSchema.safeParse({
    schemaVersion: build.schemaVersion,
    id: `shared:${shareId}`,
    name: build.name,
    level: build.level,
    maxFloor: build.maxFloor,
    weaponPath: build.weaponPath,
    goal: build.goal,
    weaponSkill: build.weaponSkill,
    stats: {
      str: build.str,
      def: build.def,
      agi: build.agi,
      vit: build.vit,
      luk: build.luk,
    },
    equipped: Object.fromEntries(
      equipment.map((row) => [row.slot, row.itemId]),
    ),
    ownedItemIds: ownedItems.map((row) => row.itemId),
    datasetVersion: build.datasetVersion,
  });
  if (historicalSnapshot === undefined) {
    return <main className="planner-screen"><p>Loading verified dataset…</p></main>;
  }
  if (historicalSnapshot === null) {
    return (
      <main className="planner-screen">
        <h2>Verified dataset {build.datasetVersion} is unavailable.</h2>
        <p>This snapshot cannot be recomputed safely on this app version.</p>
      </main>
    );
  }
  if (!parsed.success) {
    return (
      <main className="planner-screen">
        <h2>This shared build is unavailable.</h2>
      </main>
    );
  }
  return <SharedBuildView profile={parsed.data} snapshot={historicalSnapshot} />;
}

export function SharedBuildScreen() {
  const { shareId = '' } = useParams();
  const buildQuery = useMemo(
    () => tables.sharedBuild.where((row) => row.shareId.eq(shareId)),
    [shareId],
  );
  const equipmentQuery = useMemo(
    () => tables.sharedBuildEquipment.where((row) => row.shareId.eq(shareId)),
    [shareId],
  );
  const ownedItemsQuery = useMemo(
    () => tables.sharedBuildOwnedItem.where((row) => row.shareId.eq(shareId)),
    [shareId],
  );
  const [builds, buildReady] = useTable(buildQuery);
  const [equipment, equipmentReady] = useTable(equipmentQuery);
  const [ownedItems, ownedItemsReady] = useTable(ownedItemsQuery);
  const isReady = buildReady && equipmentReady && ownedItemsReady;

  if (!isReady) {
    return <main className="planner-screen"><p>Loading shared build…</p></main>;
  }
  const build = builds[0];
  if (!build) {
    return (
      <main className="planner-screen">
        <h2>This shared build is unavailable.</h2>
      </main>
    );
  }
  return (
    <ResolvedSharedBuild
      shareId={shareId}
      build={build}
      equipment={equipment}
      ownedItems={ownedItems}
    />
  );
}
