import type { CharacterProfile } from '../build/model';
import type { PlanAction } from './actionChecklist';
import type { RecommendationPlan } from '../optimizer/optimizeBuild';

export interface PlanExportInput {
  profile: CharacterProfile;
  datasetVersion: string;
  fingerprint: string;
  actions: readonly PlanAction[];
  plan?: RecommendationPlan;
}

const groupLabels: Record<PlanAction['group'], string> = {
  'do-now': 'DO NOW',
  'next-level': 'NEXT LEVELS',
  'next-floor': 'NEXT FLOORS',
  later: 'LATER',
};

export function serializePlanText(input: PlanExportInput) {
  const lines = [
    input.profile.name?.trim() || 'Untitled build',
    `Level ${input.profile.level} · Floor ${input.profile.maxFloor} · ${input.profile.weaponPath} · ${input.profile.goal}`,
    `Dataset ${input.datasetVersion} · Plan ${input.fingerprint}`,
  ];
  for (const group of [
    'do-now',
    'next-level',
    'next-floor',
    'later',
  ] as const) {
    const actions = input.actions.filter((action) => action.group === group);
    if (actions.length === 0) continue;
    lines.push('', groupLabels[group]);
    for (const action of actions) {
      const cost = action.verifiedCost
        ? ` — ${action.verifiedCost.amount.toLocaleString('en-US')} ${action.verifiedCost.currency}`
        : '';
      lines.push(`[ ] ${action.title} — ${action.detail}${cost}`);
      if (action.sourceUrl) lines.push(`Source: ${action.sourceUrl}`);
    }
  }
  return lines.join('\n');
}

export function serializePlanJson(input: PlanExportInput) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      profile: input.profile,
      datasetVersion: input.datasetVersion,
      fingerprint: input.fingerprint,
      actions: input.actions,
      plan: input.plan ?? null,
    },
    null,
    2,
  );
}
