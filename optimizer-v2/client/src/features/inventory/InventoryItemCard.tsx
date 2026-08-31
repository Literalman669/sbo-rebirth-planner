import type { InventoryCatalogResult } from '../../domain/inventory/catalog';

export function InventoryItemCard({
  result,
  selected,
  onSelect,
}: {
  result: InventoryCatalogResult;
  selected: boolean;
  onSelect(): void;
}) {
  return (
    <li className={selected ? 'inventory-item selected' : 'inventory-item'}>
      <button
        type="button"
        aria-label={`Inspect ${result.item.name}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span>
          <strong>{result.item.name}</strong>
          <small>{result.item.slot.replace('-', ' ')}</small>
        </span>
        <span className="inventory-item-badges">
          {result.owned ? <span>Owned</span> : null}
          {result.favorite ? <span>Favorite</span> : null}
          {result.compared ? <span>Compare</span> : null}
          <span>
            {result.state === 'equip-now'
              ? 'Available'
              : result.state === 'unlock-later'
                ? 'Later'
                : 'Restricted'}
          </span>
        </span>
      </button>
    </li>
  );
}
