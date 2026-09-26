import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TABS = [
  { to: '/journey/ar', icon: '🗺️', key: 'nav.map' },
  { to: '/garden', icon: '🌻', key: 'nav.garden' },
  { to: '/stickers', icon: '📒', key: 'nav.stickers' },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="pb-safe grid grid-cols-3 gap-2 border-t-4 border-grape-100 bg-white px-3 pt-2">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex min-h-tap flex-col items-center justify-center rounded-2xl text-sm font-extrabold ${isActive ? 'bg-grape-100 text-grape-700' : 'text-ink/60'}`
          }
        >
          <span className="text-3xl leading-none">{tab.icon}</span>
          {t(tab.key)}
        </NavLink>
      ))}
    </nav>
  );
}
