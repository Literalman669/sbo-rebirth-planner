import { useState } from 'react';
import type { PlanExportInput } from '../../domain/results/planExport';
import { serializePlanJson, serializePlanText } from '../../domain/results/planExport';

export function PlanExportActions({ input }: { input: PlanExportInput }) {
  const [message, setMessage] = useState<string | null>(null);

  const downloadJson = () => {
    try {
      const blob = new Blob([serializePlanJson(input)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${input.profile.name?.trim() || 'sbo-build'}-plan.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('JSON plan downloaded');
    } catch {
      setMessage('JSON download failed');
    }
  };

  return (
    <section className="plan-export-actions" aria-label="Export plan">
      <button
        type="button"
        onClick={() => {
          const clipboard = navigator.clipboard;
          if (!clipboard?.writeText) {
            setMessage('Clipboard is unavailable in this browser');
            return;
          }
          void clipboard.writeText(serializePlanText(input))
            .then(() => setMessage('Plan copied to clipboard'))
            .catch(() => setMessage('Clipboard copy failed'));
        }}
      >
        Copy plan
      </button>
      <button type="button" onClick={() => window.print()}>Print plan</button>
      <button type="button" onClick={downloadJson}>Download JSON</button>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
