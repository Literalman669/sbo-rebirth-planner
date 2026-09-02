import { useState } from 'react';
import type { ProgressTask } from '../../domain/progress/tasks';

function ProgressTaskNote({
  task,
  initialNote,
  onSave,
}: {
  task: ProgressTask;
  initialNote?: string;
  onSave(note: string): void;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  return (
    <div className="progress-task-note">
      <label>
        Notes for {task.title}
        <textarea
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button type="button" onClick={() => onSave(note)}>
        Save note for {task.title}
      </button>
    </div>
  );
}

export function ProgressChecklist({
  tasks,
  onComplete,
  onSkip,
  notesByAction,
  onSaveNote,
}: {
  tasks: readonly ProgressTask[];
  onComplete(task: ProgressTask): void;
  onSkip(task: ProgressTask): void;
  notesByAction: ReadonlyMap<string, string>;
  onSaveNote(task: ProgressTask, note: string): void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? tasks : tasks.slice(0, 5);
  return (
    <section className="progress-card progress-checklist" aria-label="Today's route">
      <h3>Today's route</h3>
      <p>Complete only what happened in game; detectable planner facts update automatically.</p>
      {visible.length > 0 ? (
        <ol>
          {visible.map((task) => (
            <li key={task.actionKey}>
              <div><strong>{task.title}</strong><span>{task.detail}</span></div>
              <div className="progress-task-actions">
                <button type="button" onClick={() => onComplete(task)}>
                  Complete {task.title}
                </button>
                <button type="button" onClick={() => onSkip(task)}>
                  Skip {task.title}
                </button>
              </div>
              <ProgressTaskNote
                task={task}
                initialNote={notesByAction.get(task.actionKey)}
                onSave={(note) => onSaveNote(task, note)}
              />
            </li>
          ))}
        </ol>
      ) : <p>Every current task is complete or skipped.</p>}
      {tasks.length > 5 ? (
        <button type="button" onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Show fewer tasks' : 'Show all tasks'}
        </button>
      ) : null}
    </section>
  );
}
