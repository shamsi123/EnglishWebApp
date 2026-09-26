import { useEffect } from 'react';
import { setMuted, setSfxMuted } from '@/engine/audio';
import { applyUiLang } from '@/i18n';
import { localDate } from '@/lib/progress';
import { useActiveChild, useStore } from '@/lib/store';

/** Applies the active child's settings and counts play minutes (FR-31, FR-33, FR-34). */
export function useChildSession() {
  const { child, settings } = useActiveChild();
  const addMinute = useStore((s) => s.addMinute);

  useEffect(() => {
    setMuted(!settings.music);
    setSfxMuted(!settings.sound);
    applyUiLang(settings.uiLang);
  }, [settings.music, settings.sound, settings.uiLang]);

  useEffect(() => {
    if (!child) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') addMinute();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [child, addMinute]);
}

export function inQuietHours(quiet: { start: string; end: string } | null, now = new Date()): boolean {
  if (!quiet) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const start = toMin(quiet.start);
  const end = toMin(quiet.end);
  return start > end ? mins >= start || mins < end : mins >= start && mins < end;
}

export function useBreakReason(): 'limit' | 'quiet' | null {
  const { data, settings } = useActiveChild();
  const today = data.minutesByDay[localDate(new Date())] ?? 0;
  if (settings.dailyLimitMinutes > 0 && today >= settings.dailyLimitMinutes) return 'limit';
  if (inQuietHours(settings.quietHours)) return 'quiet';
  return null;
}
