import type { ReactNode } from 'react';
import {
  createBrowserRouter,
  type RouteObject,
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
import { SharedBuildScreen } from '../features/share/SharedBuildScreen';
import { CurationScreen } from '../features/curation/CurationScreen';

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
        { path: 'builds/:buildId/history', element: <BuildHistoryScreen /> },
        { path: 'shared/:shareId', element: <SharedBuildScreen /> },
        { path: 'curation', element: <CurationScreen /> },
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
