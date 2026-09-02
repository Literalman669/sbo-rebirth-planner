import type { DatasetSnapshot } from '../dataset/model';
import { canonicalJson } from './canonical';
import {
  projectDatasetFacts,
  type ComparableFactValue,
  type DatasetFactEntity,
  type DatasetFactRow,
} from './factProjection';

export interface DatasetFactChange {
  id: string;
  entity: DatasetFactEntity;
  entityId: string;
  field: string;
  change: 'added' | 'removed' | 'changed';
  before: ComparableFactValue;
  after: ComparableFactValue;
  beforeSourceUrl?: string;
  afterSourceUrl?: string;
  beforeSourceRevision?: string;
  afterSourceRevision?: string;
}

function key(row: DatasetFactRow): string {
  return `${row.entity}:${row.entityId}:${row.field}`;
}

export function diffDatasetFacts(
  pinned: DatasetSnapshot,
  target: DatasetSnapshot,
): DatasetFactChange[] {
  const before = new Map(projectDatasetFacts(pinned).map((row) => [key(row), row]));
  const after = new Map(projectDatasetFacts(target).map((row) => [key(row), row]));
  const changes: DatasetFactChange[] = [];
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const left = before.get(id);
    const right = after.get(id);
    if (left && right && canonicalJson(left.value) === canonicalJson(right.value)) {
      continue;
    }
    const reference = left ?? right!;
    changes.push({
      id,
      entity: reference.entity,
      entityId: reference.entityId,
      field: reference.field,
      change: left && right ? 'changed' : left ? 'removed' : 'added',
      before: left?.value ?? null,
      after: right?.value ?? null,
      ...(left?.sourceUrl ? { beforeSourceUrl: left.sourceUrl } : {}),
      ...(right?.sourceUrl ? { afterSourceUrl: right.sourceUrl } : {}),
      ...(left?.sourceRevision
        ? { beforeSourceRevision: left.sourceRevision }
        : {}),
      ...(right?.sourceRevision
        ? { afterSourceRevision: right.sourceRevision }
        : {}),
    });
  }
  return changes;
}
