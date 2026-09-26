import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ActivityType } from '@/content/schema';
import type { ActivityProps } from './types';

// One lazily loaded renderer per activity type keeps the initial bundle small.
type Registry = { [K in ActivityType]: LazyExoticComponent<ComponentType<ActivityProps<K>>> };

export const renderers: Registry = {
  learn_card: lazy(() => import('./learn_card/LearnCard')),
  listen_tap: lazy(() => import('./listen_tap/ListenTap')),
  trace: lazy(() => import('./trace/TraceLetter')),
  match_pairs: lazy(() => import('./match_pairs/MatchPairs')),
  drag_drop: lazy(() => import('./drag_drop/DragDrop')),
  pop_balloon: lazy(() => import('./pop_balloon/PopBalloon')),
  find_letter: lazy(() => import('./find_letter/FindLetter')),
};
