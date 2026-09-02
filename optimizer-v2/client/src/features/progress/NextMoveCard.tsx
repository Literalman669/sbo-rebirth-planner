import type { ProgressTask } from '../../domain/progress/tasks';

export function NextMoveCard({ task }: { task: ProgressTask | null }) {
  return (
    <section className="progress-card progress-next-move" aria-label="Next move">
      <p className="eyebrow">Highest priority</p>
      <h3>Next move</h3>
      {task ? (
        <>
          <strong>{task.title}</strong>
          <p>{task.detail}</p>
          <p className="progress-reason">
            {task.group === 'do-now'
              ? 'This can improve the current route now.'
              : 'This is the next verified step in the current route.'}
          </p>
          {task.sourceUrl ? <a href={task.sourceUrl}>View verified source</a> : null}
        </>
      ) : (
        <p>No pending action is available for this build.</p>
      )}
    </section>
  );
}
