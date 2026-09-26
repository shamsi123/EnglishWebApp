import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { arabicCourse } from '@/content/course';
import { AVATAR_ANIMALS, AVATAR_COLORS, AVATAR_ITEMS, totalStars } from '@/lib/progress';
import { useActiveChild, useStore } from '@/lib/store';
import { Avatar } from '@/ui/Avatar';
import { BottomNav } from '@/ui/BottomNav';

/** Screen 11 — Sticker book (FR-20) and avatar customisation unlocked by stars (FR-22). */
export default function StickerBookScreen() {
  const { t, i18n } = useTranslation();
  const { child, data } = useActiveChild();
  const updateChild = useStore((s) => s.updateChild);
  const [tab, setTab] = useState<'stickers' | 'avatar'>('stickers');
  if (!child) return null;
  const stars = totalStars(data);
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const units = arabicCourse.levels.flatMap((l) => l.units);
  const setAvatar = (patch: Partial<typeof child.avatar>) => updateChild(child.id, { avatar: { ...child.avatar, ...patch } });

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-coral-100 to-cream">
      <header className="pt-safe flex items-center gap-3 px-4 pb-2">
        <Avatar avatar={child.avatar} size={64} />
        <div className="flex-1">
          <div className="text-2xl font-extrabold">{child.nickname}</div>
          <div className="font-bold text-sun-500">⭐ {t('stickers.totalStars', { count: stars })}</div>
        </div>
      </header>
      <div className="mx-4 grid grid-cols-2 gap-2 rounded-full bg-white p-1">
        {(['stickers', 'avatar'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-tap rounded-full text-lg font-extrabold ${tab === k ? 'bg-grape-600 text-white' : 'text-ink/60'}`}
          >
            {k === 'stickers' ? `📒 ${t('stickers.title')}` : `🎨 ${t('stickers.avatar')}`}
          </button>
        ))}
      </div>
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'stickers' ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-4 gap-3 rounded-blob bg-white p-4 shadow-inner">
              {units.map((u) => {
                const has = data.stickers.includes(u.id);
                return (
                  <div key={u.id} className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed ${has ? 'border-transparent bg-sun-100' : 'border-gray-300'}`}>
                    <span className={`text-4xl ${has ? 'animate-pop-in' : 'opacity-20 grayscale'}`}>{u.sticker}</span>
                  </div>
                );
              })}
            </div>
            {data.stickers.length === 0 && <p className="text-center font-bold text-ink/60">{t('stickers.empty')}</p>}
            <div>
              <h2 className="mb-2 text-xl font-extrabold">{t('stickers.trophies')}</h2>
              <div className="flex gap-3">
                {arabicCourse.levels.map((l) => (
                  <div key={l.id} className="flex flex-col items-center rounded-2xl bg-white px-4 py-3">
                    <span className={`text-5xl ${data.trophies.includes(l.id) ? '' : 'opacity-20 grayscale'}`}>{l.trophy}</span>
                    <span className="text-sm font-bold">{l.title[lang]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex justify-center">
              <Avatar avatar={child.avatar} size={130} />
            </div>
            <section>
              <h2 className="mb-2 text-lg font-extrabold">{t('stickers.item')}</h2>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_ITEMS.map((it) => {
                  const locked = stars < it.stars;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      disabled={locked}
                      aria-pressed={child.avatar.item === it.id}
                      onClick={() => setAvatar({ item: it.id })}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl bg-white text-3xl ${child.avatar.item === it.id ? 'ring-4 ring-grape-500' : ''} ${locked ? 'opacity-50' : ''}`}
                    >
                      {locked ? '🔒' : it.emoji || '🚫'}
                      {locked && <span className="text-[10px] font-extrabold">{t('stickers.unlockAt', { n: it.stars })}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-lg font-extrabold">{t('stickers.color')}</h2>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_COLORS.map((c) => {
                  const locked = stars < c.stars;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={c.id}
                      disabled={locked}
                      onClick={() => setAvatar({ color: c.value })}
                      className={`flex aspect-square items-center justify-center rounded-full text-lg ${child.avatar.color === c.value ? 'ring-4 ring-grape-500' : ''}`}
                      style={{ background: c.value, opacity: locked ? 0.4 : 1 }}
                    >
                      {locked ? '🔒' : ''}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-lg font-extrabold">{t('stickers.animal')}</h2>
              <div className="grid grid-cols-8 gap-1">
                {AVATAR_ANIMALS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={child.avatar.animal === a}
                    onClick={() => setAvatar({ animal: a })}
                    className={`flex aspect-square items-center justify-center rounded-xl text-2xl ${child.avatar.animal === a ? 'bg-sun-100 ring-2 ring-sun-400' : 'bg-white'}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
