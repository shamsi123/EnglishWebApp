import { Suspense, type ComponentType } from 'react';
import type { Activity } from '@/content/schema';
import { renderers } from '@/features/activities/registry';
import type { ActivityOutcome, ActivityProps } from '@/features/activities/types';

export function ActivityHost({ activity, onDone }: { activity: Activity; onDone: (o: ActivityOutcome) => void }) {
  // The registry is keyed by type, so the renderer always matches the activity's config.
  const Renderer = renderers[activity.type] as ComponentType<ActivityProps<typeof activity.type>>;
  return (
    <Suspense fallback={<div className="py-20 text-center text-5xl animate-bob">🐪</div>}>
      {/* key forces a fresh renderer per activity so no state leaks between questions */}
      <Renderer key={activity.id} activity={activity} onDone={onDone} />
    </Suspense>
  );
}
