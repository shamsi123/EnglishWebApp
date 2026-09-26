import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { journeyNodes } from '@/content/course';
import { useActiveChild } from '@/lib/store';
import { ArabicText } from '@/ui/ArabicText';
import { Avatar } from '@/ui/Avatar';
import { Mascot } from '@/ui/Mascot';
import { Screen } from '@/ui/Screen';

/** Screen 4 — Course picker: Arabic / Hindi cards with mascots. */
export default function CoursesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { child, data } = useActiveChild();
  const lessons = journeyNodes('ar').filter((n) => n.kind === 'lesson');
  const done = lessons.filter((n) => data.lessons[n.id]?.status === 'mastered').length;

  return (
    <Screen title={t('courses.title')} back="/profiles" right={child && <Avatar avatar={child.avatar} size={56} />}>
      <div className="flex justify-center py-3">
        <Mascot says={t('courses.titleSpoken')} size="sm" />
      </div>
      <div className="flex flex-col gap-5 pb-6">
        <button
          type="button"
          data-testid="course-ar"
          onClick={() => navigate('/journey/ar')}
          className="relative flex items-center gap-4 overflow-hidden rounded-blob bg-gradient-to-br from-sun-300 to-sun-500 p-5 text-start shadow-[0_8px_0_#d97706] active:translate-y-1"
        >
          <span className="text-8xl">🐪</span>
          <span className="flex flex-1 flex-col">
            <ArabicText className="text-4xl font-extrabold text-white drop-shadow">العربية</ArabicText>
            <span className="text-2xl font-extrabold">{t('welcome.arabic')}</span>
            <span className="text-base font-bold opacity-80">{t('courses.arabicDesc')}</span>
            <span className="mt-2 h-3 overflow-hidden rounded-full bg-white/50">
              <span className="block h-full rounded-full bg-leaf-500" style={{ width: `${(done / lessons.length) * 100}%` }} />
            </span>
            <span className="text-sm font-bold">{t('courses.lessonsDone', { done, total: lessons.length })}</span>
          </span>
        </button>
        <div className="relative flex items-center gap-4 rounded-blob bg-gray-200 p-5 opacity-70">
          <span className="text-8xl grayscale">🐘</span>
          <span className="flex flex-col">
            <span lang="hi" className="text-4xl font-extrabold">हिन्दी</span>
            <span className="text-2xl font-extrabold">{t('welcome.hindi')}</span>
            <span className="text-base font-bold opacity-80">{t('courses.hindiDesc')}</span>
          </span>
          <span className="absolute -top-3 end-4 rounded-full bg-coral-400 px-3 py-1 text-sm font-extrabold text-white shadow">🔒 {t('welcome.comingSoon')}</span>
        </div>
      </div>
    </Screen>
  );
}
