import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const steps = [
  { label: 'Character', path: '/character' },
  { label: 'Stats', path: '/stats' },
  { label: 'Equipment', path: '/equipment' },
  { label: 'Results', path: '/results' },
] as const;

export function PlannerFrame() {
  const location = useLocation();

  useEffect(() => {
    document.querySelector<HTMLElement>('[data-screen-heading]')?.focus();
  }, [location.pathname]);

  return (
    <main className="planner-frame">
      <nav aria-label="Planner progress">
        <ol className="progress-steps">
          {steps.map((step) => (
            <li key={step.path}>
              <NavLink
                to={step.path}
                aria-current={location.pathname === step.path ? 'step' : undefined}
              >
                {step.label}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>
      <Outlet />
    </main>
  );
}
