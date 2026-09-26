import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/lib/store';
import { Avatar } from '@/ui/Avatar';
import { IconButton } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';
import { Screen } from '@/ui/Screen';

const MAX_CHILDREN = 4;

/** Screen 3 — Who's learning? Big avatar tiles; no child email or password (FR-03). */
export default function ProfilesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const children = useStore((s) => s.children);
  const select = useStore((s) => s.selectChild);

  return (
    <Screen
      title={t('profiles.who')}
      right={
        <IconButton label={t('common.grownUps')} onClick={() => navigate('/parent')}>
          🔒
        </IconButton>
      }
      bg="bg-gradient-to-b from-sky2-100 to-cream"
    >
      <div className="flex justify-center py-4">
        <Mascot says={t('profiles.whoSpoken')} size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-4 pb-6">
        {children.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid={`child-${c.nickname}`}
            onClick={() => {
              if (c.pinHash) navigate(`/profiles/${c.id}/pin`);
              else {
                select(c.id);
                navigate('/courses');
              }
            }}
            className="flex flex-col items-center gap-3 rounded-blob bg-white p-5 shadow-[0_6px_0_#ddd6fe] active:translate-y-1"
          >
            <Avatar avatar={c.avatar} size={100} />
            <span className="text-2xl font-extrabold">{c.nickname}</span>
            {c.pinHash && <span className="text-sm">🔑</span>}
          </button>
        ))}
        {children.length < MAX_CHILDREN && (
          <button
            type="button"
            onClick={() => navigate('/profiles/new')}
            className="flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-blob border-4 border-dashed border-grape-200 text-grape-500"
          >
            <span className="text-6xl">➕</span>
            <span className="text-lg font-extrabold">{t('profiles.add')}</span>
          </button>
        )}
      </div>
    </Screen>
  );
}
