import { Navigate } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import { useDataset } from '../../app/providers/DatasetProvider';
import { firstIncompleteStep } from './completeness';
import { ResultsScreen } from '../results/ResultsScreen';

export function ResultsRoute() {
  const { draft, isHydrated } = useBuildDraft();
  const { snapshot } = useDataset();
  if (!isHydrated) return <p>Loading draft</p>;
  const incomplete =
    draft.datasetVersion === snapshot.version
      ? firstIncompleteStep(draft, snapshot)
      : null;
  if (incomplete) return <Navigate to={incomplete} replace />;

  return <ResultsScreen />;
}
