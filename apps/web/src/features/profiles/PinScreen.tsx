import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sfx } from '@/engine/audio';
import { hashSecret, useStore } from '@/lib/store';
import { Avatar } from '@/ui/Avatar';
import { Screen } from '@/ui/Screen';
import { PicturePin } from './PicturePin';

/** Child picks their profile, then taps their 3 secret pictures (FR-03). */
export default function PinScreen() {
  const { childId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const child = useStore((s) => s.children.find((c) => c.id === childId));
  const select = useStore((s) => s.selectChild);
  const [pin, setPin] = useState<string[]>([]);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (pin.length !== 3 || !child) return;
    void hashSecret(pin.join('')).then((h) => {
      if (h === child.pinHash) {
        select(child.id);
        navigate('/courses');
      } else {
        sfx('tryAgain');
        setWrong(true);
        setPin([]);
      }
    });
  }, [pin, child, select, navigate]);

  if (!child) return <Navigate to="/profiles" replace />;
  return (
    <Screen title={child.nickname} back="/profiles" bg="bg-gradient-to-b from-sky2-100 to-cream">
      <div className="flex flex-col items-center gap-6 pt-6">
        <Avatar avatar={child.avatar} size={110} />
        <p className="text-center text-xl font-extrabold">{wrong ? t('profiles.pinWrong') : t('profiles.enterPin')}</p>
        <PicturePin value={pin} onChange={setPin} />
      </div>
    </Screen>
  );
}
