import type { ReactNode } from 'react';
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
  useLocation,
} from 'react-router-dom';
import { ConnectedApp } from './App';
import { HomeScreen } from '../features/home/HomeScreen';
import { CharacterScreen } from '../features/planner/CharacterScreen';
import { EquipmentScreen } from '../features/planner/EquipmentScreen';
import { PlannerFrame } from '../features/planner/PlannerFrame';
import { ResultsRoute } from '../features/planner/ResultsRoute';
import { StatsScreen } from '../features/planner/StatsScreen';
import { AuthCallbackScreen } from '../features/auth/AuthCallbackScreen';
import { BuildHistoryScreen } from '../features/builds/BuildHistoryScreen';
import { BuildsScreen } from '../features/builds/BuildsScreen';
import { SharedBuildScreen } from '../features/share/SharedBuildScreen';
import { CurationScreen } from '../features/curation/CurationScreen';
import { InventoryScreen } from '../features/inventory/InventoryScreen';
import { EquipmentComparisonScreen } from '../features/inventory/EquipmentComparisonScreen';
import { BuildComparisonScreen } from '../features/builds/BuildComparisonScreen';

function LegacyBuildComparisonRedirect() {
  const location = useLocation();
  return <Navigate to={`/builds/compare${location.search}`} replace />;
}

export function createAppRoutes(
  rootElement: ReactNode = <ConnectedApp />,
): RouteObject[] {
  return [
    {
      path: '/',
      element: rootElement,
      children: [
        { index: true, element: <HomeScreen /> },
        { path: 'auth/callback', element: <AuthCallbackScreen /> },
        { path: 'builds', element: <BuildsScreen /> },
        { path: 'builds/compare', element: <BuildComparisonScreen /> },
        { path: 'builds/:buildId/history', element: <BuildHistoryScreen /> },
        { path: 'shared/:shareId', element: <SharedBuildScreen /> },
        { path: 'curation', element: <CurationScreen /> },
        { path: 'inventory', element: <InventoryScreen /> },
        { path: 'compare/equipment', element: <EquipmentComparisonScreen /> },
        { path: 'compare/builds', element: <LegacyBuildComparisonRedirect /> },
        {
          element: <PlannerFrame />,
          children: [
            { path: 'character', element: <CharacterScreen /> },
            { path: 'stats', element: <StatsScreen /> },
            { path: 'equipment', element: <EquipmentScreen /> },
            { path: 'results', element: <ResultsRoute /> },
          ],
        },
      ],
    },
  ];
}

export const appRouter = createBrowserRouter(createAppRoutes(), {
  basename: import.meta.env.BASE_URL,
});
