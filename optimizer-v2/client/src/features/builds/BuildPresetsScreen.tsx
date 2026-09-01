import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { curatedBuildPresets } from '../../data/buildPresets';
import { mergeBuildLibrary } from '../../domain/build/library';
import {
  createDraftFromCuratedPreset,
  createDraftFromPersonalPreset,
} from '../../domain/build/presets';
import { BuildWorkspaceNav } from './BuildWorkspaceNav';

export function BuildPresetsScreen() {
  const navigate = useNavigate();
  const { snapshot } = useDataset();
  const { isHydrated, replaceDraft, savedBuilds } = useBuildDraft();
  const cloud = useOptionalCloudBuilds();
  const personalPresets = useMemo(
    () =>
      mergeBuildLibrary(savedBuilds, [
        ...(cloud?.cloudBuilds ?? []),
        ...(cloud?.archivedCloudBuilds ?? []),
      ]).filter((entry) => entry.kind === 'personal-preset' && !entry.archivedAt),
    [cloud?.archivedCloudBuilds, cloud?.cloudBuilds, savedBuilds],
  );

  const apply = (profile: ReturnType<typeof createDraftFromPersonalPreset>) => {
    replaceDraft(profile);
    navigate('/character');
  };

  if (!isHydrated) return <main className="build-presets-screen"><p>Loading presets…</p></main>;

  return (
    <main className="build-presets-screen">
      <header className="workspace-heading">
        <p className="eyebrow">Reusable foundations</p>
        <h2 data-screen-heading tabIndex={-1}>Build Presets</h2>
        <p>Start from verified intent or copy one of your private saved routes.</p>
      </header>
      <BuildWorkspaceNav />
      <section aria-labelledby="curated-presets-heading">
        <h3 id="curated-presets-heading">Verified curated starts</h3>
        <p>
          Curated starts select only path and goal. Stats and equipment remain
          yours to confirm through the guided planner.
        </p>
        <div className="preset-card-grid">
          {curatedBuildPresets.map((preset) => (
            <article className="preset-card" key={preset.id}>
              <strong>{preset.name}</strong>
              <p>{preset.description}</p>
              <small>Policy {preset.policyVersion}</small>
              <button
                type="button"
                onClick={() =>
                  apply(
                    createDraftFromCuratedPreset(preset, {
                      id: crypto.randomUUID(),
                      datasetVersion: snapshot.version,
                    }),
                  )
                }
              >
                Use {preset.name}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="personal-presets-heading">
        <h3 id="personal-presets-heading">Your personal presets</h3>
        {personalPresets.length === 0 ? (
          <p className="empty-state">Save a build as a preset from your Library.</p>
        ) : (
          <ul className="preset-card-list">
            {personalPresets.map((entry) => {
              const name = entry.profile.name ?? `Level ${entry.profile.level} preset`;
              return (
                <li className="preset-card" key={entry.id}>
                  <strong>{name}</strong>
                  <span>
                    Level {entry.profile.level} · Floor {entry.profile.maxFloor} ·{' '}
                    {entry.profile.weaponPath}
                  </span>
                  <small>
                    {entry.source} · dataset {entry.profile.datasetVersion}
                  </small>
                  <button
                    type="button"
                    onClick={() =>
                      apply(
                        createDraftFromPersonalPreset(
                          entry.profile,
                          crypto.randomUUID(),
                        ),
                      )
                    }
                  >
                    Use {name}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/builds/${entry.id}/history?source=${entry.source === 'cloud' ? 'cloud' : 'local'}`,
                      )
                    }
                  >
                    History for {name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
