import type { TFunction } from 'i18next';
import { getItem } from '@/content/course';
import type { Activity } from '@/content/schema';
import type { SpeechPart } from '@/engine/audio';
import type { UiLang } from '@/i18n';

/** Spoken instruction + target sound for an activity. Replayed by the big 🔊 button (FR-15). */
export function activitySpeech(activity: Activity, t: TFunction, lang: UiLang): SpeechPart[] {
  const item = getItem(activity.itemId);
  const name = { text: item.name.ar, lang: 'ar' as const };
  const say = (key: string, vars: Record<string, string> = {}) => ({ text: t(key, vars), lang });
  switch (activity.type) {
    case 'learn_card':
      return [say('act.learn.prompt', { name: item.name.en }), name, { text: item.example.word, lang: 'ar' }];
    case 'listen_tap':
      return [say('act.listenTap.prompt'), name];
    case 'trace':
      return [say('act.trace.prompt'), name];
    case 'match_pairs':
      return [say('act.match.prompt')];
    case 'drag_drop':
      return [say('act.drag.prompt', { meaning: item.example.meaning }), { text: item.example.word, lang: 'ar' }];
    case 'pop_balloon':
      return [say('act.pop.prompt'), name];
    case 'find_letter':
      return [say('act.find.prompt', { name: item.name.en }), name];
    case 'story_card':
      return [say('act.story.prompt'), ...activity.items.map((id) => ({ text: getItem(id).example.word, lang: 'ar' as const }))];
  }
}

/** Visible caption for the spoken instruction (accessibility: captions for spoken audio). */
export function activityCaption(activity: Activity, t: TFunction): string {
  const item = getItem(activity.itemId);
  switch (activity.type) {
    case 'learn_card':
      return t('act.learn.prompt', { name: item.name.en });
    case 'listen_tap':
      return `${t('act.listenTap.prompt')} “${item.name.en}”`;
    case 'trace':
      return t('act.trace.prompt');
    case 'match_pairs':
      return t('act.match.prompt');
    case 'drag_drop':
      return t('act.drag.prompt', { meaning: item.example.meaning });
    case 'pop_balloon':
      return `${t('act.pop.prompt')} “${item.name.en}”`;
    case 'find_letter':
      return t('act.find.prompt', { name: item.name.en });
    case 'story_card':
      return t('act.story.prompt');
  }
}
