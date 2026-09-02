import type { CharacterProfile } from '../../domain/build/model';
import type { PlanProgress } from '../../domain/progress/model';

export function ProgressContextHeader({
  profile,
  source,
  progress,
  taskActionKeys,
}: {
  profile: CharacterProfile;
  source: string;
  progress: PlanProgress;
  taskActionKeys: readonly string[];
}) {
  const currentActions = new Set(taskActionKeys);
  const completed = progress.objectives.filter(
    (objective) =>
      objective.status === 'completed' &&
      currentActions.has(objective.actionKey),
  ).length;
  const totalTasks = taskActionKeys.length;
  const percentage = totalTasks === 0
    ? 0
    : Math.round((Math.min(completed, totalTasks) / totalTasks) * 100);
  return (
    <section className="progress-context" aria-label="Progress build context">
      <div>
        <strong>{profile.name ?? `Level ${profile.level} build`}</strong>
        <span>
          Level {profile.level} · Floor {profile.maxFloor} · {profile.weaponPath}
        </span>
      </div>
      <dl>
        <div><dt>Dataset</dt><dd>{profile.datasetVersion}</dd></div>
        <div><dt>Source</dt><dd>{source}</dd></div>
        <div><dt>Checklist progress</dt><dd>{completed}/{totalTasks} · {percentage}%</dd></div>
      </dl>
    </section>
  );
}
