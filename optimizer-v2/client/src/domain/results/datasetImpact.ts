import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';

function stable(value: unknown) {
  return JSON.stringify(value);
}

export function summarizeDatasetImpact(
  profile: CharacterProfile,
  recommendedItemIds: readonly string[],
  historical: DatasetSnapshot | null,
  current: DatasetSnapshot,
) {
  if (!historical) {
    return {
      available: false as const,
      relevant: true,
      changes: [
        'Historical dataset is unavailable; impact cannot be verified.',
      ],
    };
  }
  const changes: string[] = [];
  const relevantIds = new Set([
    ...Object.values(profile.equipped).filter(
      (itemId): itemId is string => Boolean(itemId),
    ),
    ...recommendedItemIds,
  ]);
  const historicalItems = new Map(
    historical.equipment.map((item) => [item.id, item]),
  );
  const currentItems = new Map(current.equipment.map((item) => [item.id, item]));
  for (const itemId of [...relevantIds].sort()) {
    const before = historicalItems.get(itemId);
    const after = currentItems.get(itemId);
    if (stable(before) === stable(after)) continue;
    const name = after?.name ?? before?.name ?? itemId;
    changes.push(
      `${Object.values(profile.equipped).includes(itemId) ? 'Equipped' : 'Recommended'} item changed: ${name}`,
    );
  }
  const historicalFormulas = new Map(
    historical.formulas.map((formula) => [formula.id, formula]),
  );
  const currentFormulas = new Map(
    current.formulas.map((formula) => [formula.id, formula]),
  );
  for (const formulaId of new Set([
    ...historicalFormulas.keys(),
    ...currentFormulas.keys(),
  ])) {
    if (
      stable(historicalFormulas.get(formulaId)) !==
      stable(currentFormulas.get(formulaId))
    ) {
      changes.push(`Formula changed: ${formulaId}`);
    }
  }
  if (historical.strategyPolicyVersion !== current.strategyPolicyVersion) {
    changes.push(
      `Strategy policy changed: ${historical.strategyPolicyVersion} → ${current.strategyPolicyVersion}`,
    );
  }
  return {
    available: true as const,
    relevant: changes.length > 0,
    changes,
  };
}
