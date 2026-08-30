type PlannerAction = {
  label: string;
  onClick(): void;
};

export function StickyPlannerActions({
  back,
  next,
  nextDisabled = false,
}: {
  back: PlannerAction;
  next: PlannerAction;
  nextDisabled?: boolean;
}) {
  return (
    <div className="screen-actions sticky-planner-actions">
      <button type="button" onClick={back.onClick}>
        {back.label}
      </button>
      <button type="button" onClick={next.onClick} disabled={nextDisabled}>
        {next.label}
      </button>
    </div>
  );
}
