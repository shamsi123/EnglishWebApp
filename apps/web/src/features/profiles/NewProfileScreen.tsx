import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AVATAR_ANIMALS, AVATAR_COLORS } from '@/lib/progress';
import { hashSecret, useStore, type Child } from '@/lib/store';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { PicturePin } from './PicturePin';

/** Create a child profile: nickname, age band, avatar, optional picture-PIN (FR-02). Behind the parent gate. */
export default function NewProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addChild = useStore((s) => s.addChild);
  const count = useStore((s) => s.children.length);
  const [nickname, setNickname] = useState('');
  const [ageBand, setAgeBand] = useState<Child['ageBand']>('4-6');
  const [animal, setAnimal] = useState(AVATAR_ANIMALS[0]!);
  const [pin, setPin] = useState<string[]>([]);
  const color = AVATAR_COLORS[count % 3]!.value;

  const create = async () => {
    addChild({
      nickname: nickname.trim().slice(0, 20),
      ageBand,
      avatar: { animal, color, item: 'none' },
      pinHash: pin.length === 3 ? await hashSecret(pin.join('')) : null,
      courses: ['ar'],
    });
    navigate('/profiles');
  };

  return (
    <Screen
      title={t('profiles.addTitle')}
      back="/profiles"
      footer={
        <Button block variant="success" disabled={!nickname.trim() || count >= 4} onClick={() => void create()}>
          {t('profiles.create')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex justify-center pt-2">
          <Avatar avatar={{ animal, color, item: 'none' }} size={110} />
        </div>
        <label className="flex flex-col gap-1 font-bold">
          {t('profiles.nickname')}
          <input
            className="min-h-tap rounded-2xl border-2 border-grape-200 bg-white px-4 text-xl outline-none focus:border-grape-500"
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
          />
          <span className="text-sm font-medium text-ink/60">{t('profiles.nicknameHint')}</span>
        </label>
        <div>
          <p className="mb-2 font-bold">{t('profiles.ageBand')}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['4-6', '7-10'] as const).map((b) => (
              <Button key={b} variant={ageBand === b ? 'primary' : 'secondary'} onClick={() => setAgeBand(b)}>
                {b === '4-6' ? t('profiles.age46') : t('profiles.age710')}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-bold">{t('profiles.pickAvatar')}</p>
          <div className="grid grid-cols-4 gap-3">
            {AVATAR_ANIMALS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={animal === a}
                onClick={() => setAnimal(a)}
                className={`flex h-16 items-center justify-center rounded-2xl text-4xl ${animal === a ? 'bg-sun-100 ring-4 ring-sun-400' : 'bg-white'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-bold">{t('profiles.pin')}</p>
          <p className="mb-3 text-sm text-ink/60">{t('profiles.pinHint')}</p>
          <PicturePin value={pin} onChange={setPin} />
        </div>
        <p className="text-center text-sm text-ink/50">{t('profiles.max')}</p>
      </div>
    </Screen>
  );
}
