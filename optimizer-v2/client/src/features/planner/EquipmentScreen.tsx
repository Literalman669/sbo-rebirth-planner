import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import type { EquipmentSlot } from '../../domain/build/model';
import { DEFAULT_ACCESS_PREFERENCES } from '../../domain/build/model';
import {
  compatibleItemsForSlot,
  requiredEquipmentSlots,
} from './completeness';

const optionalSlots: Array<{ slot: EquipmentSlot; label: string }> = [
  { slot: 'upper-head', label: 'Upper headwear' },
  { slot: 'lower-head', label: 'Lower headwear' },
];

export function EquipmentScreen() {
  const navigate = useNavigate();
  const { snapshot } = useDataset();
  const { draft, isHydrated, updateDraft } = useBuildDraft();
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Partial<Record<EquipmentSlot, string>>>({});
  const controls = useRef<Partial<Record<EquipmentSlot, HTMLSelectElement | null>>>({});

  if (!isHydrated) return <p>Loading draft</p>;

  const setEquipment = (slot: EquipmentSlot, itemId: string) => {
    const equipped = { ...draft.equipped };
    if (itemId) equipped[slot] = itemId;
    else delete equipped[slot];
    setErrors((current) => ({ ...current, [slot]: undefined }));
    updateDraft({ equipped });
  };

  const visibleItems = (slot: EquipmentSlot) => {
    const query = search.trim().toLocaleLowerCase();
    return compatibleItemsForSlot(draft, snapshot, slot).filter(
      (item) => !query || item.name.toLocaleLowerCase().includes(query),
    );
  };

  const renderSelect = (
    slot: EquipmentSlot,
    label: string,
    required = false,
  ) => (
    <label key={slot}>
      {label}
      <select
        ref={(element) => {
          controls.current[slot] = element;
        }}
        aria-label={label}
        aria-invalid={Boolean(errors[slot])}
        required={required}
        value={draft.equipped[slot] ?? ''}
        onChange={(event) => setEquipment(slot, event.currentTarget.value)}
      >
        <option value="">Choose verified equipment</option>
        {visibleItems(slot).map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {errors[slot] ? <span role="alert">{errors[slot]}</span> : null}
    </label>
  );

  const continueToResults = () => {
    const requiredSlots = requiredEquipmentSlots(draft);
    const firstMissing = requiredSlots.find((slot) => !draft.equipped[slot]);
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

  const toggleOwned = (event: ChangeEvent<HTMLInputElement>) => {
    const itemId = event.currentTarget.value;
    const owned = new Set(draft.ownedItemIds);
    if (event.currentTarget.checked) owned.add(itemId);
    else owned.delete(itemId);
    updateDraft({ ownedItemIds: [...owned] });
  };

  const accessPreferences = draft.accessPreferences ?? DEFAULT_ACCESS_PREFERENCES;
  const setAccessPreference = (
    key: keyof typeof accessPreferences,
    checked: boolean,
  ) => {
    updateDraft({
      accessPreferences: { ...accessPreferences, [key]: checked },
    });
  };

  return (
    <section className="planner-screen">
      <h2 data-screen-heading tabIndex={-1}>Equipment</h2>
      <label>
        Search verified equipment
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </label>
      <div className="equipment-fields">
        {renderSelect('main-hand', 'Main-hand weapon', true)}
        {draft.weaponPath === 'dual-wield'
          ? renderSelect('off-hand', 'Off-hand weapon', true)
          : null}
        {renderSelect('armor', 'Armor', true)}
        {shieldAllowed ? renderSelect('shield', 'Shield') : null}
        {optionalSlots.map(({ slot, label }) => renderSelect(slot, label))}
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
                  setAccessPreference(key, event.currentTarget.checked)
                }
              />
              {label}
            </label>
          ))}
        </div>
      </details>

      <details>
        <summary>Owned items</summary>
        <div className="owned-items">
          {snapshot.equipment
            .filter(
              (item) =>
                item.verificationStatus === 'verified' &&
                (item.weaponPaths.length === 0 ||
                  item.weaponPaths.includes(draft.weaponPath)),
            )
            .map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  value={item.id}
                  checked={draft.ownedItemIds.includes(item.id)}
                  onChange={toggleOwned}
                />
                {item.name}
              </label>
            ))}
        </div>
      </details>

      <div className="screen-actions">
        <button type="button" onClick={() => navigate('/stats')}>
          Back
        </button>
        <button type="button" onClick={continueToResults}>
          Continue
        </button>
      </div>
    </section>
  );
}
