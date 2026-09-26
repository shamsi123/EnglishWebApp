import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getItem, journeyNodes, nodeTitle } from '@/content/course';
import { isWeak } from '@/engine/leitner';
import { resetGate } from '@/features/auth/ParentGate';
import { currentNode, emptyChildData, localDate, nodeStatuses, totalStars } from '@/lib/progress';
import { defaultSettings, useStore } from '@/lib/store';
import { ArabicText } from '@/ui/ArabicText';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Toggle } from '@/ui/Toggle';

const card = 'rounded-blob bg-white p-4 shadow-sm';

function lastSevenDays(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return localDate(d);
  });
}

/** Screen 12 — Parent dashboard (FR-30–35): progress, time, weak items, settings, override, delete. */
export default function ParentDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const children = useStore((s) => s.children);
  const allData = useStore((s) => s.data);
  const allSettings = useStore((s) => s.settings);
  const { updateSettings, overrideUnlock, assignExtraReview, deleteChild, signOut } = useStore.getState();
  const [selected, setSelected] = useState(children[0]?.id ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const [unlockId, setUnlockId] = useState('');

  const child = children.find((c) => c.id === selected);
  const data = (selected && allData[selected]) || emptyChildData();
  const settings = (selected && allSettings[selected]) || defaultSettings();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const nodes = journeyNodes('ar');
  const lessons = nodes.filter((n) => n.kind === 'lesson');
  const mastered = lessons.filter((n) => data.lessons[n.id]?.status === 'mastered').length;
  const current = currentNode('ar', data);
  const days = lastSevenDays();
  const minutes = days.map((d) => data.minutesByDay[d] ?? 0);
  const maxMin = Math.max(10, ...minutes);
  const weak = Object.entries(data.items).filter(([, m]) => isWeak(m)).map(([id]) => id);
  const states = nodeStatuses('ar', data);
  const lockedNodes = nodes.filter((n) => states[n.id] === 'locked');

  return (
    <Screen
      title={t('parent.title')}
      back={() => {
        resetGate();
        navigate('/profiles');
      }}
      bg="bg-grape-50"
    >
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex gap-3 overflow-x-auto py-1">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === selected}
              onClick={() => {
                setSelected(c.id);
                setConfirmDelete(false);
                setAssigned(false);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1 pe-4 ps-1 font-extrabold ${c.id === selected ? 'bg-grape-600 text-white' : 'bg-white'}`}
            >
              <Avatar avatar={c.avatar} size={44} />
              {c.nickname}
            </button>
          ))}
          <button type="button" onClick={() => navigate('/profiles/new')} className="shrink-0 rounded-full bg-white px-4 font-extrabold text-grape-600">
            ➕
          </button>
        </div>

        {child ? (
          <>
            <section className={card}>
              <h2 className="mb-3 text-lg font-extrabold">📈 {t('parent.overview')}</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-leaf-100 p-2">
                  <div className="text-2xl font-extrabold">{mastered}/{lessons.length}</div>
                  <div className="text-xs font-bold">{t('parent.mastered')}</div>
                </div>
                <div className="rounded-2xl bg-sun-100 p-2">
                  <div className="text-2xl font-extrabold">⭐ {totalStars(data)}</div>
                  <div className="text-xs font-bold">{t('parent.stars')}</div>
                </div>
                <div className="rounded-2xl bg-coral-100 p-2">
                  <div className="text-2xl font-extrabold">🔥 {data.streak.current}</div>
                  <div className="text-xs font-bold">{t('parent.streak')}</div>
                </div>
              </div>
              <p className="mt-3 font-bold">
                {t('parent.current')}: <span className="text-grape-600">{current ? nodeTitle(current, lang) : '🏆'}</span>
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-grape-100">
                <div className="h-full rounded-full bg-leaf-500" style={{ width: `${(mastered / lessons.length) * 100}%` }} />
              </div>
              <p className="mt-2 text-sm font-bold text-ink/60">{data.queue.length > 0 ? `☁️ ${t('parent.sync', { count: data.queue.length })}` : `✅ ${t('parent.synced')}`}</p>
            </section>

            <section className={card}>
              <h2 className="mb-3 text-lg font-extrabold">⏱️ {t('parent.time')}: {minutes.reduce((a, b) => a + b, 0)}</h2>
              <div className="flex h-28 items-end gap-2" role="img" aria-label={minutes.join(', ')}>
                {days.map((d, i) => (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-bold">{minutes[i]}</span>
                    <div className="w-full rounded-t-lg bg-grape-400" style={{ height: `${(minutes[i]! / maxMin) * 80 + 2}px` }} />
                    <span className="text-xs text-ink/60">{new Date(d + 'T12:00').toLocaleDateString(lang, { weekday: 'narrow' })}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={card}>
              <h2 className="mb-3 text-lg font-extrabold">🧩 {t('parent.weak')}</h2>
              {weak.length === 0 ? (
                <p className="font-bold text-ink/60">{t('parent.noWeak')}</p>
              ) : (
                <>
                  <div dir="rtl" className="mb-3 flex flex-wrap gap-2">
                    {weak.map((id) => {
                      const m = data.items[id]!;
                      return (
                        <span key={id} className="flex items-center gap-2 rounded-2xl bg-coral-100 px-3 py-1">
                          <ArabicText className="text-3xl">{getItem(id).glyph}</ArabicText>
                          <span dir="ltr" className="text-xs font-bold">✓{m.correctCount} ✗{m.wrongCount}</span>
                        </span>
                      );
                    })}
                  </div>
                  <Button
                    variant="secondary"
                    block
                    disabled={assigned}
                    onClick={() => {
                      assignExtraReview(child.id, weak);
                      setAssigned(true);
                    }}
                  >
                    {assigned ? `✅ ${t('parent.assigned')}` : `🌻 ${t('parent.assignReview')}`}
                  </Button>
                </>
              )}
            </section>

            <section className={card}>
              <h2 className="mb-2 text-lg font-extrabold">⚙️ {t('parent.settings')}</h2>
              <label className="flex min-h-tap items-center justify-between gap-3 text-lg font-bold">
                <span>{t('parent.dailyLimit')}</span>
                <select
                  className="min-h-tap rounded-2xl border-2 border-grape-200 bg-white px-3"
                  value={settings.dailyLimitMinutes}
                  onChange={(e) => updateSettings(child.id, { dailyLimitMinutes: Number(e.target.value) })}
                >
                  {[10, 15, 20, 30, 45, 60, 0].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? '∞' : m}
                    </option>
                  ))}
                </select>
              </label>
              <Toggle label={t('parent.quiet')} checked={!!settings.quietHours} onChange={(v) => updateSettings(child.id, { quietHours: v ? { start: '20:00', end: '07:00' } : null })} />
              <Toggle label={t('parent.sound')} checked={settings.sound} onChange={(v) => updateSettings(child.id, { sound: v })} />
              <Toggle label={t('parent.music')} checked={settings.music} onChange={(v) => updateSettings(child.id, { music: v })} />
              <Toggle label={t('parent.contrast')} checked={settings.highContrast} onChange={(v) => updateSettings(child.id, { highContrast: v })} />
              <label className="flex min-h-tap items-center justify-between gap-3 text-lg font-bold">
                <span>{t('parent.uiLang')}</span>
                <select
                  className="min-h-tap rounded-2xl border-2 border-grape-200 bg-white px-3"
                  value={settings.uiLang}
                  onChange={(e) => updateSettings(child.id, { uiLang: e.target.value as 'en' | 'ar' })}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
            </section>

            <section className={card}>
              <h2 className="mb-2 text-lg font-extrabold">🔓 {t('parent.unlock')}</h2>
              <div className="flex gap-2">
                <select className="min-h-tap flex-1 rounded-2xl border-2 border-grape-200 bg-white px-3" value={unlockId} onChange={(e) => setUnlockId(e.target.value)}>
                  <option value="">—</option>
                  {lockedNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {nodeTitle(n, lang)}
                      {n.kind === 'checkpoint' ? ` (${t('journey.checkpoint')})` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={!unlockId}
                  onClick={() => {
                    overrideUnlock(child.id, unlockId);
                    setUnlockId('');
                  }}
                >
                  {t('parent.unlockBtn')}
                </Button>
              </div>
            </section>

            <Button
              variant="danger"
              block
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                deleteChild(child.id);
                setSelected(children.find((c) => c.id !== child.id)?.id ?? null);
                setConfirmDelete(false);
              }}
            >
              🗑️ {confirmDelete ? t('parent.deleteConfirm') : t('parent.deleteChild')}
            </Button>
          </>
        ) : (
          <Button block onClick={() => navigate('/profiles/new')}>
            ➕ {t('profiles.add')}
          </Button>
        )}

        <Button
          variant="ghost"
          block
          onClick={() => {
            resetGate();
            signOut();
            navigate('/');
          }}
        >
          🚪 {t('parent.signOut')}
        </Button>
      </div>
    </Screen>
  );
}
