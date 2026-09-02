import type { CharacterProfile } from '../../domain/build/model';
import type { BuildLibraryEntry } from '../../domain/build/library';

function sourceValue(entry: BuildLibraryEntry) {
  return `${entry.source === 'cloud' ? 'cloud' : 'local'}:${entry.id}`;
}

export function ProgressBuildSwitcher({
  activeProfile,
  entries,
  value,
  onChange,
}: {
  activeProfile: CharacterProfile;
  entries: readonly BuildLibraryEntry[];
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="progress-build-switcher">
      View progress for
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="active">
          Active · {activeProfile.name ?? `Level ${activeProfile.level} build`}
        </option>
        {entries
          .filter((entry) => entry.id !== activeProfile.id)
          .map((entry) => (
            <option key={`${entry.source}:${entry.id}`} value={sourceValue(entry)}>
              {entry.kind === 'personal-preset' ? 'Preset' : 'Build'} ·{' '}
              {entry.profile.name ?? `Level ${entry.profile.level} build`} ·{' '}
              {entry.source === 'cloud' ? 'Cloud' : 'This device'}
            </option>
          ))}
      </select>
    </label>
  );
}
