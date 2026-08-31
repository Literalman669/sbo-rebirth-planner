import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { useInventory } from '../../app/providers/InventoryContext';
import type { EquipmentSlot } from '../../domain/build/model';
import { DEFAULT_ACCESS_PREFERENCES } from '../../domain/build/model';
import { EquipmentPicker } from '../equipment/EquipmentPicker';
import { requiredEquipmentSlots } from './completeness';
import { StickyPlannerActions } from '../shell/StickyPlannerActions';

const optionalSlots: Array<{ slot: EquipmentSlot; label: string }> = [
  { slot: 'upper-head', label: 'Upper headwear' },
  { slot: 'lower-head', label: 'Lower headwear' },
];

export function EquipmentScreen() {
  const navigate = useNavigate();
  const { snapshot } = useDataset();
  const { draft, isHydrated, updateDraft } = useBuildDraft();
  const inventory = useInventory();
  const [errors, setErrors] = useState<Partial<Record<EquipmentSlot, string>>>({});
  const [datasetMessage, setDatasetMessage] = useState<string | null>(null);
  const controls = useRef<Partial<Record<EquipmentSlot, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!isHydrated) return;
    const equipped = { ...draft.equipped };
    let changed = false;
    for (const slot of requiredEquipmentSlots(draft)) {
      if (equipped[slot]) continue;
      const starters = snapshot.equipment.filter(
        (item) =>
          item.verificationStatus === 'verified' &&
          item.acquisitionType === 'starter' &&
          item.levelRequirement <= 1 &&
          item.floor <= 1 &&
          (item.slot === slot ||
            (slot === 'off-hand' &&
              draft.weaponPath === 'dual-wield' &&
              item.slot === 'main-hand')) &&
          (item.weaponPaths.length === 0 ||
            item.weaponPaths.includes(draft.weaponPath)),
      );
      if (starters.length === 1) {
        equipped[slot] = starters[0]!.id;
        changed = true;
      }
    }
    if (changed) updateDraft({ equipped }, { recordUndo: false });
  }, [
    draft.equipped,
    draft.weaponPath,
    isHydrated,
    snapshot.equipment,
    updateDraft,
  ]);

  if (!isHydrated) return <p>Loading draft</p>;

  const setEquipment = (slot: EquipmentSlot, itemId: string | undefined) => {
    const equipped = { ...draft.equipped };
    if (itemId) equipped[slot] = itemId;
    else delete equipped[slot];
    setErrors((current) => ({ ...current, [slot]: undefined }));
    if (draft.datasetVersion !== snapshot.version) {
      setDatasetMessage(
        `Equipment changes now use verified dataset ${snapshot.version}.`,
      );
    }
    updateDraft({ equipped, datasetVersion: snapshot.version });
  };

  const markOwned = (itemId: string) => {
    inventory.setOwned(itemId, true);
  };

  const renderPicker = (
    slot: EquipmentSlot,
    label: string,
    required = false,
  ) => (
    <div
      key={slot}
      ref={(element) => {
        controls.current[slot] = element?.querySelector('button') ?? null;
      }}
    >
      <EquipmentPicker
        slot={slot}
        label={label}
        required={required}
        profile={draft}
        snapshot={snapshot}
        value={draft.equipped[slot]}
        onSelect={(itemId) => setEquipment(slot, itemId)}
        onMarkOwned={markOwned}
        favoriteItemIds={inventory.inventory.favoriteItemIds}
        comparisonItemIds={inventory.inventory.comparisonItemIds}
        onToggleFavorite={inventory.toggleFavorite}
        onToggleComparison={inventory.toggleComparison}
        error={errors[slot]}
      />
    </div>
  );

  const continueToResults = () => {
    const firstMissing = requiredEquipmentSlots(draft).find(
      (slot) => !draft.equipped[slot],
    );
    if (firstMissing) {
      const label =
        firstMissing === 'main-hand'
          ? 'main-hand weapon'
          : firstMissing === 'off-hand'
            ? 'off-hand weapon'
            : 'armor';
      setErrors({ [firstMissing]: `Choose your ${label}.` });
      controls.current[firstMissing]?.focus();
      return;
    }
    navigate('/results');
  };

  const shieldAllowed = ['one-handed', 'rapier', 'dagger'].includes(
    draft.weaponPath,
  );
  const accessPreferences =
    draft.accessPreferences ?? DEFAULT_ACCESS_PREFERENCES;

  return (
    <section className="planner-screen equipment-workspace">
      <h2 data-screen-heading tabIndex={-1}>Equipment</h2>
      <p className="workspace-intro">
        Each slot opens the complete verified catalog with eligibility, price,
        source, and equipped-item comparison.
      </p>
      {datasetMessage ? <p role="status">{datasetMessage}</p> : null}
      <div className="equipment-fields">
        {renderPicker('main-hand', 'Main-hand weapon', true)}
        {draft.weaponPath === 'dual-wield'
          ? renderPicker('off-hand', 'Off-hand weapon', true)
          : null}
        {renderPicker('armor', 'Armor', true)}
        {shieldAllowed ? renderPicker('shield', 'Shield') : null}
        {optionalSlots.map(({ slot, label }) => renderPicker(slot, label))}
      </div>

      <details>
        <summary>Optional item access</summary>
        <p>Enable only sources you are willing and able to use.</p>
        <div className="owned-items">
          {([
            ['activeEvent', 'Active event items'],
            ['gamepass', 'Gamepass items'],
            ['badge', 'Badge items'],
            ['limited', 'Limited or rotating items'],
          ] as const).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={accessPreferences[key]}
                onChange={(event) =>
                  updateDraft({
                    accessPreferences: {
                      ...accessPreferences,
                      [key]: event.currentTarget.checked,
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </details>

      <p className="inventory-coming-soon" aria-disabled="true">
        Inventory workspace is planned for Release 2. Mark individual items as
        owned from their picker detail for now.
      </p>
      <StickyPlannerActions
        back={{ label: 'Back', onClick: () => navigate('/stats') }}
        next={{ label: 'Continue', onClick: continueToResults }}
      />
    </section>
  );
}
