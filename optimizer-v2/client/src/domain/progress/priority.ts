import type { ProgressTask } from './tasks';

export function selectNextProgressTask(
  tasks: readonly ProgressTask[],
): ProgressTask | null {
  const predicates: Array<(task: ProgressTask) => boolean> = [
    (task) => task.kind === 'spend-stats' && task.group === 'do-now',
    (task) => task.kind === 'equip',
    (task) =>
      task.kind === 'buy' &&
      task.verifiedCost !== undefined &&
      task.group === 'do-now',
    (task) => task.kind === 'buy' && task.verifiedCost !== undefined,
    (task) => task.kind === 'spend-stats',
    () => true,
  ];
  for (const predicate of predicates) {
    const match = tasks.find(predicate);
    if (match) return match;
  }
  return null;
}
