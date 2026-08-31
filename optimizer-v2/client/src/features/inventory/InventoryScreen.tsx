import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { useInventory } from '../../app/providers/InventoryContext';
import type { EquipmentSlot } from '../../domain/build/model';
import {
  queryInventoryCatalog,
  unresolvedInventoryIds,
  type InventoryCatalogQuery,
  type InventoryCatalogSort,
} from '../../domain/inventory/catalog';
import { buildEquipmentIndex } from '../../domain/equipment/equipmentQuery';
import { InventoryItemCard } from './InventoryItemCard';

const PAGE_SIZE = 100;
const slotLabels: Record<EquipmentSlot, string> = {
  'main-hand': 'Main hand',
  'off-hand': 'Off hand',
  armor: 'Armor',
  shield: 'Shield',
  'upper-head': 'Upper headwear',
  'lower-head': 'Lower headwear',
};

function formatNumber(value: number | null) {
  return value === null ? 'Missing verified data' : value.toLocaleString('en-US');
}

export function InventoryScreen() {
  const { snapshot } = useDataset();
  const { draft, updateDraft } = useBuildDraft();
  const inventoryState = useInventory();
  const { inventory } = inventoryState;
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [slot, setSlot] = useState<EquipmentSlot | 'all'>('all');
  const [ownership, setOwnership] = useState<'all' | 'owned' | 'missing'>('all');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [missingUpgradeOnly, setMissingUpgradeOnly] = useState(false);
  const [pricedOnly, setPricedOnly] = useState(false);
  const [sort, setSort] = useState<InventoryCatalogSort>('name');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const index = useMemo(() => buildEquipmentIndex(snapshot), [snapshot]);
  const query = useMemo<InventoryCatalogQuery>(
    () => ({
      search: deferredSearch,
      slot,
      ownership,
      favoriteOnly,
      missingUpgradeOnly,
      pricedOnly,
      sort,
    }),
    [
      deferredSearch,
      favoriteOnly,
      missingUpgradeOnly,
      ownership,
      pricedOnly,
      slot,
      sort,
    ],
  );
  const results = useMemo(
    () => queryInventoryCatalog(index, draft, inventory, query),
    [draft, index, inventory, query],
  );
  const unresolved = useMemo(
    () => unresolvedInventoryIds(index, inventory),
    [index, inventory],
  );
  const selected =
    results.find((result) => result.item.id === selectedId) ??
    results[0] ??
    null;

  useEffect(() => {
    setLimit(PAGE_SIZE);
    if (!results.some((result) => result.item.id === selectedId)) {
      setSelectedId(results[0]?.item.id ?? null);
    }
  }, [results, selectedId]);

  useEffect(() => {
    setNoteDraft(selected?.note ?? '');
  }, [selected?.item.id, selected?.note]);

  if (!inventoryState.isHydrated) {
    return <main className="inventory-screen"><p>Loading inventory…</p></main>;
  }

  const equipSelected = () => {
    if (!selected || selected.state !== 'equip-now' || !selected.optimizerItem) {
      return;
    }
    const targetSlot = selected.item.slot as EquipmentSlot;
    updateDraft({
      equipped: {
        ...draft.equipped,
        [targetSlot]: selected.item.id,
      },
    });
    setMessage(`${selected.item.name} equipped in ${slotLabels[targetSlot]}.`);
  };

  const toggleSelectedComparison = () => {
    if (!selected) return;
    const result = inventoryState.toggleComparison(selected.item.id);
    setMessage(
      result.ok
        ? selected.compared
          ? `${selected.item.name} removed from comparison.`
          : `${selected.item.name} added to comparison.`
        : 'Remove an item before adding another comparison.',
    );
  };

  return (
    <main className="inventory-screen">
      <header className="workspace-heading">
        <p className="eyebrow">Verified equipment library</p>
        <h2>Inventory</h2>
        <p>
          Track what you own, save favorites, compare candidates, and equip an
          item into the active build only when you choose to.
        </p>
      </header>

      <section className="inventory-summary" aria-label="Inventory summary">
        <strong>{inventory.ownedItemIds.length} owned</strong>
        <span>{inventory.favoriteItemIds.length} favorites</span>
        <span>{inventory.comparisonItemIds.length}/4 comparing</span>
        <span>{inventoryState.persistenceStatus}</span>
      </section>

      {unresolved.length > 0 ? (
        <p className="dataset-warning" role="alert">
          {unresolved.length} saved inventory ID{unresolved.length === 1 ? ' is' : 's are'} unavailable in dataset {snapshot.version}. They remain preserved in your backup.
        </p>
      ) : null}

      <section className="inventory-toolbar" aria-label="Inventory filters">
        <label>
          Search verified equipment
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <label>
          Slot
          <select
            value={slot}
            onChange={(event) =>
              setSlot(event.currentTarget.value as EquipmentSlot | 'all')
            }
          >
            <option value="all">All slots</option>
            {Object.entries(slotLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Ownership
          <select
            value={ownership}
            onChange={(event) =>
              setOwnership(event.currentTarget.value as typeof ownership)
            }
          >
            <option value="all">All items</option>
            <option value="owned">Owned</option>
            <option value="missing">Missing</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.currentTarget.value as InventoryCatalogSort)
            }
          >
            <option value="name">Name</option>
            <option value="slot">Slot</option>
            <option value="projected-improvement">Projected improvement</option>
            <option value="value-per-col">Value per Col</option>
            <option value="price">Price</option>
            <option value="level">Level</option>
            <option value="floor">Floor</option>
          </select>
        </label>
        <label><input type="checkbox" checked={favoriteOnly} onChange={(event) => setFavoriteOnly(event.currentTarget.checked)} /> Favorites only</label>
        <label><input type="checkbox" checked={missingUpgradeOnly} onChange={(event) => setMissingUpgradeOnly(event.currentTarget.checked)} /> Missing upgrades</label>
        <label><input type="checkbox" checked={pricedOnly} onChange={(event) => setPricedOnly(event.currentTarget.checked)} /> Verified price</label>
      </section>

      <p role="status" aria-live="polite">
        {results.length} verified item{results.length === 1 ? '' : 's'} · {inventory.comparisonItemIds.length} item{inventory.comparisonItemIds.length === 1 ? '' : 's'} selected for comparison
        {message ? ` · ${message}` : ''}
      </p>

      {inventory.comparisonItemIds.length >= 2 ? (
        <Link className="inventory-compare-link" to="/compare/equipment">
          Compare selected equipment
        </Link>
      ) : null}

      {results.length === 0 ? (
        <p className="empty-state">
          No verified equipment matches the current search and filters.
        </p>
      ) : (
        <div className="inventory-workspace">
          <div>
            <ul className="inventory-item-list" aria-label="Inventory items">
              {results.slice(0, limit).map((result) => (
                <InventoryItemCard
                  key={result.item.id}
                  result={result}
                  selected={selected?.item.id === result.item.id}
                  onSelect={() => setSelectedId(result.item.id)}
                />
              ))}
            </ul>
            {limit < results.length ? (
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
              >
                Show more items
              </button>
            ) : null}
          </div>

          {selected ? (
            <aside
              className="inventory-detail"
              aria-label={`${selected.item.name} inventory details`}
            >
              <p className="eyebrow">{slotLabels[selected.item.slot as EquipmentSlot]}</p>
              <h3>{selected.item.name}</h3>
              <p>
                Level {selected.item.levelRequirement ?? 'unverified'}
                {selected.floor === null ? ' · Floor unverified' : ` · Floor ${selected.floor}`}
              </p>
              <dl>
                <div><dt>ATK</dt><dd>{formatNumber(selected.item.attack)}</dd></div>
                <div><dt>DEF</dt><dd>{formatNumber(selected.item.defense)}</dd></div>
                <div><dt>DEX</dt><dd>{formatNumber(selected.item.dexterity)}</dd></div>
                <div><dt>Price</dt><dd>{selected.price === null ? 'Missing verified price' : `${selected.price.toLocaleString('en-US')} ${selected.currency}`}</dd></div>
              </dl>
              {selected.reasons.length > 0 ? (
                <ul>{selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              ) : null}
              <div className="inventory-detail-actions">
                <button
                  type="button"
                  aria-label={selected.owned ? `Remove ${selected.item.name} from owned` : `Mark ${selected.item.name} owned`}
                  onClick={() => inventoryState.setOwned(selected.item.id, !selected.owned)}
                >
                  {selected.owned ? 'Remove Owned' : 'Mark Owned'}
                </button>
                <button
                  type="button"
                  aria-label={selected.favorite ? `Unfavorite ${selected.item.name}` : `Favorite ${selected.item.name}`}
                  onClick={() => inventoryState.toggleFavorite(selected.item.id)}
                >
                  {selected.favorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button
                  type="button"
                  aria-label={selected.compared ? `Remove ${selected.item.name} from comparison` : `Add ${selected.item.name} to comparison`}
                  onClick={toggleSelectedComparison}
                >
                  {selected.compared ? 'Remove Compare' : 'Add to Compare'}
                </button>
                <button
                  type="button"
                  disabled={selected.state !== 'equip-now' || !selected.optimizerItem || draft.equipped[selected.item.slot as EquipmentSlot] === selected.item.id}
                  aria-label={`Equip ${selected.item.name}`}
                  onClick={equipSelected}
                >
                  Equip
                </button>
                <a href={selected.item.sourceUrl} target="_blank" rel="noreferrer">Open Wiki</a>
              </div>
              <label>
                Personal note for {selected.item.name}
                <textarea
                  maxLength={500}
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.currentTarget.value)}
                  onBlur={() =>
                    inventoryState.setNote(selected.item.id, noteDraft)
                  }
                />
              </label>
            </aside>
          ) : null}
        </div>
      )}
    </main>
  );
}
