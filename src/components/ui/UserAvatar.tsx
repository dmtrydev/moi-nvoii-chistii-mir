import type { CSSProperties } from 'react';

function pickColor(seed: string): string {
  const s = seed.trim();
  const colors = [
    '#4caf50',
    '#2e7d32',
    '#22c55e',
    '#34d399',
    '#60a5fa',
    '#a78bfa',
    '#f59e0b',
    '#fb7185',
  ];

  if (!s) return colors[0];

  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length] ?? colors[0];
}

function initialsFromName(name: string): string {
  const tokens = name
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
  }
  return `${tokens[0]?.[0] ?? ''}`.toUpperCase();
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 36,
  className,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}): JSX.Element {
  const base = String(name ?? email ?? '').trim();
  const text = initialsFromName(base || 'U') || 'U';
  const bg = pickColor(base);

  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: bg,
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={base ? `Avatar ${base}` : 'Avatar'}
        className={`rounded-full object-cover select-none ${className ?? ''}`}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      aria-label={base ? `Avatar ${base}` : 'Avatar'}
      className={`rounded-full flex items-center justify-center text-white font-semibold select-none ${className ?? ''}`}
      style={style}
    >
      {text}
    </div>
  );
}

