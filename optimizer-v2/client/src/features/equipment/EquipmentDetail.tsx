import type {
  CharacterProfile,
  EquipmentSlot,
} from '../../domain/build/model';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import type { EquipmentQueryResult } from '../../domain/equipment/equipmentQuery';
import { compareEquipment } from '../../domain/equipment/equipmentComparison';

function formatDelta(value: number | undefined) {
  if (value === undefined || Math.abs(value) < 0.000_001) return null;
  const rounded = Number(value.toFixed(2));
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function EquipmentDetail({
  result,
  profile,
  slot,
  snapshot,
  onEquip,
  onMarkOwned,
}: {
  result: EquipmentQueryResult;
  profile: CharacterProfile;
  slot: EquipmentSlot;
  snapshot: DatasetSnapshot;
  onEquip(): void;
  onMarkOwned?(): void;
}) {
  let comparison: ReturnType<typeof compareEquipment> | null = null;
  try {
    comparison = compareEquipment(profile, slot, result.item, snapshot);
  } catch {
    comparison = null;
  }
  const raw = comparison
    ? [
        ['ATK', formatDelta(comparison.rawDelta.attack)],
        ['DEF', formatDelta(comparison.rawDelta.defense)],
        ['DEX', formatDelta(comparison.rawDelta.dexterity)],
      ].flatMap(([label, value]) => (value ? [`${label} ${value}`] : []))
    : [];
  const price = comparison?.price;

  return (
    <aside className="equipment-detail" aria-label={`${result.item.name} details`}>
      <div className="equipment-detail-heading">
        <div>
          <h3>{result.item.name}</h3>
          <p>
            Level {result.item.levelRequirement ?? 'unverified'}
            {result.floor === null ? '' : ` · Floor ${result.floor}`}
          </p>
        </div>
        <div className="equipment-badges">
          {result.owned ? <span>Owned</span> : null}
          <span>{result.state === 'equip-now' ? 'Equip now' : result.state === 'unlock-later' ? 'Unlock later' : 'Unavailable'}</span>
        </div>
      </div>
      {raw.length > 0 ? <p className="raw-comparison">{raw.join(' · ')}</p> : null}
      <p className="equipment-price">
        {price ? `${price.cost.toLocaleString('en-US')} ${price.currency}` : 'Price not verified'}
      </p>
      {result.reasons.length > 0 ? (
        <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      ) : null}
      {comparison?.unmodeledEffects.length ? (
        <p>{comparison.unmodeledEffects.join(' · ')}</p>
      ) : null}
      <div className="equipment-detail-actions">
        <button
          type="button"
          disabled={result.state !== 'equip-now'}
          aria-label={`Equip ${result.item.name}`}
          onClick={onEquip}
        >
          Equip {result.item.name}
        </button>
        {onMarkOwned && !result.owned ? (
          <button type="button" onClick={onMarkOwned}>
            Mark Owned
          </button>
        ) : null}
        <a href={result.item.sourceUrl} target="_blank" rel="noreferrer">
          Open Wiki
        </a>
      </div>
    </aside>
  );
}
