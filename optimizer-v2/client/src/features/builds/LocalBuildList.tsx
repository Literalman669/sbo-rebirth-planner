import type { CharacterProfile } from '../../domain/build/model';
import type { GuestBuildListResult } from '../../infrastructure/storage/guestBuildStore';

export function LocalBuildList({
  builds,
  onLoad,
  onDelete,
}: {
  builds: readonly GuestBuildListResult[];
  onLoad(profile: CharacterProfile): void;
  onDelete(id: string): void;
}) {
  if (builds.length === 0) {
    return <p>No saved builds are stored on this device yet.</p>;
  }

  return (
    <ul>
      {builds.map((result) => {
        if (!result.ok) {
          return (
            <li key={result.id}>
              <span>Unavailable build {result.id}</span>
              <button
                type="button"
                aria-label={`Delete unavailable build ${result.id}`}
                onClick={() => onDelete(result.id)}
              >
                Delete
              </button>
            </li>
          );
        }
        const build = result.value.profile;
        const name = build.name ?? `Level ${build.level} build`;
        return (
          <li key={build.id}>
            <div>
              <strong>{name}</strong>
              <span>Level {build.level} · Floor {build.maxFloor}</span>
            </div>
            <button
              type="button"
              aria-label={`Load ${name}`}
              onClick={() => onLoad(build)}
            >
              Load
            </button>
            <button
              type="button"
              aria-label={`Delete ${name}`}
              onClick={() => onDelete(build.id)}
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
