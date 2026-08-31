import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type {
  CharacterProfile,
  EquipmentSlot,
} from '../../domain/build/model';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import {
  buildEquipmentIndex,
  queryEquipment,
  type EquipmentQueryResult,
  type EquipmentSort,
} from '../../domain/equipment/equipmentQuery';
import { EquipmentDetail } from './EquipmentDetail';
import type { ComparisonToggleResult } from '../../app/providers/InventoryContext';

const PAGE_SIZE = 100;

export function EquipmentPicker({
  slot,
  label,
  required,
  profile,
  snapshot,
  value,
  onSelect,
  onMarkOwned,
  favoriteItemIds = [],
  comparisonItemIds = [],
  onToggleFavorite,
  onToggleComparison,
  error,
}: {
  slot: EquipmentSlot;
  label: string;
  required?: boolean;
  profile: CharacterProfile;
  snapshot: DatasetSnapshot;
  value?: string;
  onSelect(itemId: string | undefined): void;
  onMarkOwned?(itemId: string): void;
  favoriteItemIds?: readonly string[];
  comparisonItemIds?: readonly string[];
  onToggleFavorite?(itemId: string): void;
  onToggleComparison?(itemId: string): ComparisonToggleResult;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [sort, setSort] = useState<EquipmentSort>('projected-improvement');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(value ?? null);
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => buildEquipmentIndex(snapshot), [snapshot]);
  const allResults = useMemo(
    () =>
      queryEquipment(index, profile, {
        slot,
        search,
        sort,
        showFuture: true,
        ownedOnly: false,
        pricedOnly: false,
      }),
    [index, profile, search, slot, sort],
  );
  const results = useMemo(
    () =>
      stateFilter === 'all'
        ? allResults
        : allResults.filter((result) => result.state === stateFilter),
    [allResults, stateFilter],
  );
  const selected =
    results.find((result) => result.item.id === selectedId) ?? results[0] ?? null;
  const selectedValue = snapshot.catalog.find((item) => item.id === value);

  useEffect(() => {
    if (!open) return;
    setLimit(PAGE_SIZE);
    if (!results.some((result) => result.item.id === selectedId)) {
      setSelectedId(results[0]?.item.id ?? null);
    }
  }, [open, results, selectedId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      queueMicrotask(() => searchRef.current?.focus());
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  const trapFallbackFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, a[href]',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section className="equipment-picker" aria-invalid={Boolean(error)}>
      <span className="equipment-picker-label">
        {label}{required ? ' *' : ''}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="equipment-picker-trigger"
        aria-label={`${value ? 'Change' : 'Choose'} ${label}`}
        onClick={() => setOpen(true)}
      >
        <strong>{selectedValue?.name ?? `Choose ${label.toLowerCase()}`}</strong>
        <span>{value ? 'Change selection' : 'Browse verified equipment'}</span>
      </button>
      {value && !required ? (
        <button type="button" className="equipment-clear" onClick={() => onSelect(undefined)}>
          Clear {label}
        </button>
      ) : null}
      {error ? <span role="alert">{error}</span> : null}

      <dialog
        ref={dialogRef}
        className="equipment-dialog"
        aria-label={`Choose ${label}`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onKeyDown={trapFallbackFocus}
      >
        <div className="equipment-dialog-shell">
          <header>
            <div>
              <p className="eyebrow">Verified catalog</p>
              <h2>Choose {label}</h2>
            </div>
            <button type="button" onClick={close} aria-label={`Close ${label} picker`}>
              Close
            </button>
          </header>
          <div className="equipment-filter-bar">
            <label>
              Search {label}
              <input
                ref={searchRef}
                type="search"
                aria-label={`Search ${label}`}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </label>
            <label>
              Item state
              <select value={stateFilter} onChange={(event) => setStateFilter(event.currentTarget.value)}>
                <option value="all">All states</option>
                <option value="equip-now">Equip now</option>
                <option value="unlock-later">Unlock later</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label>
              Sort results
              <select value={sort} onChange={(event) => setSort(event.currentTarget.value as EquipmentSort)}>
                <option value="projected-improvement">Projected improvement</option>
                <option value="raw-strength">Raw strength</option>
                <option value="price">Price</option>
                <option value="value-per-col">Value per Col</option>
                <option value="level">Level</option>
                <option value="floor">Floor</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <p role="status">{results.length} candidates</p>
          <div className="equipment-picker-content">
            <div className="equipment-result-list" role="list" aria-label={`${label} candidates`}>
              {results.slice(0, limit).map((result) => (
                <div key={result.item.id} role="listitem">
                  <button
                    type="button"
                    className={selected?.item.id === result.item.id ? 'selected' : ''}
                    aria-label={`Inspect ${result.item.name}`}
                    onClick={() => setSelectedId(result.item.id)}
                  >
                    <strong>{result.item.name}</strong>
                    <span>{result.state === 'equip-now' ? 'Equip now' : result.state === 'unlock-later' ? 'Unlock later' : 'Unavailable'}{result.owned ? ' · Owned' : ''}</span>
                    {result.reasons[0] ? <small>{result.reasons[0]}</small> : null}
                  </button>
                </div>
              ))}
              {limit < results.length ? (
                <div role="listitem" className="equipment-show-more">
                  <button type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                    Show more results
                  </button>
                </div>
              ) : null}
            </div>
            {selected ? (
              <EquipmentDetail
                result={selected}
                profile={profile}
                slot={slot}
                snapshot={snapshot}
                onEquip={() => {
                  onSelect(selected.item.id);
                  close();
                }}
                onMarkOwned={onMarkOwned ? () => onMarkOwned(selected.item.id) : undefined}
                favorite={favoriteItemIds.includes(selected.item.id)}
                compared={comparisonItemIds.includes(selected.item.id)}
                onToggleFavorite={
                  onToggleFavorite
                    ? () => onToggleFavorite(selected.item.id)
                    : undefined
                }
                onToggleComparison={
                  onToggleComparison
                    ? () => {
                        const result = onToggleComparison(selected.item.id);
                        setInventoryMessage(
                          result.ok
                            ? null
                            : 'Remove an item before adding another comparison.',
                        );
                      }
                    : undefined
                }
              />
            ) : (
              <p>No equipment matches these filters.</p>
            )}
          </div>
          {inventoryMessage ? <p role="alert">{inventoryMessage}</p> : null}
        </div>
      </dialog>
    </section>
  );
}
