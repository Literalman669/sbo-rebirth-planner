import { useNavigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftProvider';

export function HomeScreen() {
  const navigate = useNavigate();
  const { hasActiveDraft, isHydrated, resetDraft } = useBuildDraft();

  if (!isHydrated) {
    return <main className="home-screen"><p>Loading draft</p></main>;
  }

  return (
    <main className="home-screen">
      <div className="home-actions">
        <button
          type="button"
          onClick={() => {
            void resetDraft().then(() => navigate('/character'));
          }}
        >
          Create Build
        </button>
        {hasActiveDraft ? (
          <button type="button" onClick={() => navigate('/character')}>
            Resume Build
          </button>
        ) : null}
      </div>
    </main>
  );
}
