import { NavLink } from 'react-router-dom';

export function BuildWorkspaceNav() {
  return (
    <nav className="build-workspace-nav" aria-label="Build tools">
      <NavLink end to="/builds">Library</NavLink>
      <NavLink to="/builds/compare">Compare</NavLink>
      <NavLink to="/builds/presets">Presets</NavLink>
    </nav>
  );
}
