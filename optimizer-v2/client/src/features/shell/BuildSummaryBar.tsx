import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { requiredEquipmentSlots } from '../planner/completeness';

const pathLabels = {
  'two-handed': 'Two-Handed',
  'one-handed': 'One-Handed',
  rapier: 'Rapier',
  dagger: 'Dagger',
  'dual-wield': 'Dual Wield',
  melee: 'Melee',
} as const;

const goalLabels = {
  balanced: 'Balanced',
  damage: 'Damage',
  survivability: 'Survivability',
  mobility: 'Mobility',
  farming: 'Farming',
} as const;

const statusLabels = {
  idle: 'Not saved yet',
  saving: 'Saving',
  'saved-local': 'Saved locally',
  'sync-queued': 'Cloud sync queued',
  synced: 'Synced',
  error: 'Save needs attention',
} as const;

export function BuildSummaryBar() {
  const { draft, persistenceStatus } = useBuildDraft();
  const { snapshot } = useDataset();
  const requiredSlots = requiredEquipmentSlots(draft);
  const completedSlots = requiredSlots.filter((slot) => draft.equipped[slot])
    .length;

  return (
    <section className="build-summary-bar" aria-label="Current build summary">
      <div>
        <strong>{draft.name?.trim() || 'Untitled build'}</strong>
        <span>
          Level {draft.level} · Floor {draft.maxFloor} ·{' '}
          {pathLabels[draft.weaponPath]} · {goalLabels[draft.goal]}
        </span>
      </div>
      <div>
        <span>
          Equipment {completedSlots}/{requiredSlots.length}
        </span>
        <span>Dataset {draft.datasetVersion || snapshot.version}</span>
        <span
          className={`status-badge save-status save-status-${persistenceStatus}`}
          aria-live="polite"
        >
          {statusLabels[persistenceStatus]}
        </span>
      </div>
    </section>
  );
}
