type StepIconProps = {
  step: 'Character' | 'Stats' | 'Equipment' | 'Results';
};

export function StepIcon({ step }: StepIconProps) {
  if (step === 'Character') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 4v20M12 9h8M13 24l3 4 3-4M14 4l2-2 2 2" />
      </svg>
    );
  }
  if (step === 'Stats') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3v26M3 16h26M7 7l18 18M25 7 7 25M16 8l2.5 5.5L24 16l-5.5 2.5L16 24l-2.5-5.5L8 16l5.5-2.5L16 8Z" />
      </svg>
    );
  }
  if (step === 'Equipment') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3 25 7v7c0 7-3.8 11.7-9 15-5.2-3.3-9-8-9-15V7l9-4Z" />
        <path d="M16 7v17M10 10h12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="m16 3 8 8-3 14-5 4-5-4-3-14 8-8Z" />
      <path d="m16 8 3 6-3 10-3-10 3-6Z" />
    </svg>
  );
}
