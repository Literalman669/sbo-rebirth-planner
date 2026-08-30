import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { StepIcon } from './StepIcon';
import { BuildSummaryBar } from '../shell/BuildSummaryBar';

const steps = [
  { label: 'Character', path: '/character' },
  { label: 'Stats', path: '/stats' },
  { label: 'Equipment', path: '/equipment' },
  { label: 'Results', path: '/results' },
] as const;

export function PlannerFrame() {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document
      .querySelector<HTMLElement>('[data-screen-heading]')
      ?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <main className="planner-frame">
      <BuildSummaryBar />
      <nav aria-label="Planner progress">
        <ol className="progress-steps">
          {steps.map((step) => (
            <li key={step.path}>
              <NavLink
                to={step.path}
                aria-current={location.pathname === step.path ? 'step' : undefined}
              >
                <span className="step-marker">
                  <StepIcon step={step.label} />
                </span>
                <span>{step.label}</span>
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>
      <Outlet />
    </main>
  );
}
