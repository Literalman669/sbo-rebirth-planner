import { Link } from 'react-router-dom';

export function DatasetUpdateNotice({ count }: { count: number }) {
  const normalizedCount = Math.max(0, Math.trunc(count));
  return (
    <aside className="dataset-update-notice" role="status">
      <p>
        Verified data update affects {normalizedCount}{' '}
        {normalizedCount === 1 ? 'build' : 'builds'}.
      </p>
      <Link to="/updates">Review changes</Link>
    </aside>
  );
}
