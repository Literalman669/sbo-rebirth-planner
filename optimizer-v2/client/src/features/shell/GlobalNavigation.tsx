import { BarChart3, Compass, Library, Package } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function GlobalNavigation() {
  return (
    <nav className="global-navigation" aria-label="Primary">
      <NavLink to="/character">
        <Compass aria-hidden="true" />
        <span>Planner</span>
      </NavLink>
      <NavLink to="/builds">
        <Library aria-hidden="true" />
        <span>Builds</span>
      </NavLink>
      <NavLink to="/inventory">
        <Package aria-hidden="true" />
        <span>Inventory</span>
      </NavLink>
      <span aria-disabled="true" title="Planned for Release 2">
        <BarChart3 aria-hidden="true" />
        <span>Progress</span>
      </span>
    </nav>
  );
}
