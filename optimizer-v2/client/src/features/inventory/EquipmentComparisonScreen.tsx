import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { useInventory } from '../../app/providers/InventoryContext';
import type { EquipmentSlot } from '../../domain/build/model';
import { buildEquipmentIndex } from '../../domain/equipment/equipmentQuery';
import { queryInventoryCatalog } from '../../domain/inventory/catalog';

function display(value: number | null) {
  return value === null ? 'Missing verified data' : value.toLocaleString('en-US');
}

export function EquipmentComparisonScreen() {
  const { snapshot } = useDataset();
  const { draft, updateDraft } = useBuildDraft();
  const inventory = useInventory();
  const [message, setMessage] = useState<string | null>(null);
  const index = useMemo(() => buildEquipmentIndex(snapshot), [snapshot]);
  const catalog = useMemo(
    () =>
      queryInventoryCatalog(index, draft, inventory.inventory, {
        search: '',
        slot: 'all',
        ownership: 'all',
        favoriteOnly: false,
        missingUpgradeOnly: false,
        pricedOnly: false,
        sort: 'name',
      }),
    [draft, index, inventory.inventory],
  );
  const byId = new Map(catalog.map((result) => [result.item.id, result]));
  const selected = inventory.inventory.comparisonItemIds.flatMap((itemId) => {
    const result = byId.get(itemId);
    return result ? [result] : [];
  });
  const missing = inventory.inventory.comparisonItemIds.filter(
    (itemId) => !byId.has(itemId),
  );
  const oneSlot = new Set(selected.map((result) => result.item.slot)).size <= 1;

  if (!inventory.isHydrated) {
    return <main className="equipment-comparison-screen"><p>Loading inventory…</p></main>;
  }

  return (
    <main className="equipment-comparison-screen">
      <header className="workspace-heading">
        <p className="eyebrow">Side-by-side evidence</p>
        <h2>Equipment Comparison</h2>
        <p>Compare up to four verified items without changing your build.</p>
      </header>
      <Link to="/inventory">Back to Inventory</Link>
      {message ? <p role="status">{message}</p> : null}
      {missing.length > 0 ? (
        <p className="dataset-warning" role="alert">
          {missing.length} compared item{missing.length === 1 ? ' is' : 's are'} unavailable in dataset {snapshot.version}.
        </p>
      ) : null}
      {selected.length < 2 ? (
        <p className="empty-state">Select at least two verified items in Inventory to compare them.</p>
      ) : (
        <>
          {!oneSlot ? <p>Not comparable for this active build because the selected items use different slots.</p> : null}
          <div className="equipment-comparison-table" role="region" aria-label="Equipment comparison table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {selected.map((result) => <th scope="col" key={result.item.id}>{result.item.name}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">Slot</th>{selected.map((result) => <td key={result.item.id}>{result.item.slot.replace('-', ' ')}</td>)}</tr>
                <tr><th scope="row">Level</th>{selected.map((result) => <td key={result.item.id}>{display(result.item.levelRequirement)}</td>)}</tr>
                <tr><th scope="row">Floor</th>{selected.map((result) => <td key={result.item.id}>{display(result.floor)}</td>)}</tr>
                <tr><th scope="row">ATK</th>{selected.map((result) => <td key={result.item.id}>{display(result.item.attack)}</td>)}</tr>
                <tr><th scope="row">DEF</th>{selected.map((result) => <td key={result.item.id}>{display(result.item.defense)}</td>)}</tr>
                <tr><th scope="row">DEX</th>{selected.map((result) => <td key={result.item.id}>{display(result.item.dexterity)}</td>)}</tr>
                <tr><th scope="row">Price</th>{selected.map((result) => <td key={result.item.id}>{result.price === null ? 'Missing verified price' : `${result.price.toLocaleString('en-US')} ${result.currency}`}</td>)}</tr>
                <tr><th scope="row">Projected change</th>{selected.map((result) => <td key={result.item.id}>{oneSlot ? display(result.projectedImprovement) : 'Not comparable'}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <div className="equipment-comparison-actions">
            {selected.map((result) => {
              const slot = result.item.slot as EquipmentSlot;
              const equipped = draft.equipped[slot] === result.item.id;
              return (
                <section key={result.item.id}>
                  <strong>{result.item.name}</strong>
                  <button type="button" onClick={() => inventory.toggleComparison(result.item.id)}>Remove {result.item.name}</button>
                  <button
                    type="button"
                    disabled={equipped || result.state !== 'equip-now' || !result.optimizerItem}
                    aria-label={`Equip ${result.item.name}`}
                    onClick={() => {
                      updateDraft({ equipped: { ...draft.equipped, [slot]: result.item.id } });
                      setMessage(`${result.item.name} equipped.`);
                    }}
                  >
                    {equipped ? 'Equipped' : 'Equip'}
                  </button>
                  <a aria-label={`Open ${result.item.name} Wiki`} href={result.item.sourceUrl} target="_blank" rel="noreferrer">Open Wiki</a>
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
