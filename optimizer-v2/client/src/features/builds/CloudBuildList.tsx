import type { CharacterProfile } from '../../domain/build/model';
import type { CloudBuildRecord } from '../../infrastructure/cloud/buildRepository';

type CloudBuildListProps = {
  builds: readonly CloudBuildRecord[];
  onLoad(profile: CharacterProfile): void;
  onHistory(buildId: string): void;
  onDelete(buildId: string): void;
};

export function CloudBuildList({
  builds,
  onLoad,
  onHistory,
  onDelete,
}: CloudBuildListProps) {
  return (
    <section className="cloud-builds" aria-labelledby="cloud-builds-heading">
      <h2 id="cloud-builds-heading">Cloud Archive</h2>
      <ul>
        {builds.map((record) => {
          const build = record.profile;
          const name = build.name ?? `Level ${build.level} build`;
          return (
            <li key={build.id}>
              <div>
                <strong>{name}</strong>
                <span>
                  Level {build.level} · {record.history.length} revision
                  {record.history.length === 1 ? '' : 's'}
                </span>
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
                aria-label={`History for ${name}`}
                onClick={() => onHistory(build.id)}
              >
                History
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
    </section>
  );
}
