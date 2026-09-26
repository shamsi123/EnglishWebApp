import type { Child } from '@/lib/store';
import { AVATAR_ITEMS } from '@/lib/progress';

export function Avatar({ avatar, size = 96 }: { avatar: Child['avatar']; size?: number }) {
  const item = AVATAR_ITEMS.find((i) => i.id === avatar.item);
  return (
    <span className="relative inline-flex items-center justify-center rounded-full shadow-inner" style={{ width: size, height: size, background: avatar.color }}>
      <span style={{ fontSize: size * 0.55 }}>{avatar.animal}</span>
      {item?.emoji && (
        <span className="absolute" style={{ fontSize: size * 0.34, top: -size * 0.14 }}>
          {item.emoji}
        </span>
      )}
    </span>
  );
}
