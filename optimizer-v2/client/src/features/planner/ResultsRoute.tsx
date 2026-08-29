import { Navigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftProvider';
import { useDataset } from '../../app/providers/DatasetProvider';
import { firstIncompleteStep } from './completeness';

export function ResultsRoute() {
  const { draft, isHydrated } = useBuildDraft();
  const { snapshot } = useDataset();
  if (!isHydrated) return <p>Loading draft</p>;
  const incomplete = firstIncompleteStep(draft, snapshot);
  if (incomplete) return <Navigate to={incomplete} replace />;

  return (
    <section className="planner-screen">
      <h2 data-screen-heading tabIndex={-1}>Results</h2>
    </section>
  );
}
