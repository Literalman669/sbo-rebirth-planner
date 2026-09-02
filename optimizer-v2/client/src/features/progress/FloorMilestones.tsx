import type { CharacterProfile } from '../../domain/build/model';
import type { ProgressTask } from '../../domain/progress/tasks';

export function FloorMilestones({
  profile,
  tasks,
}: {
  profile: CharacterProfile;
  tasks: readonly ProgressTask[];
}) {
  const floorTask = tasks.find((task) => task.category === 'floor-milestone');
  return (
    <section className="progress-card" aria-label="Current floor">
      <h3>Current floor</h3>
      <strong>Floor {profile.maxFloor} unlocked</strong>
      <p>
        {floorTask
          ? `${floorTask.title} remains a manual objective until Highest Unlocked Floor changes.`
          : 'No next-floor objective is available.'}
      </p>
    </section>
  );
}
