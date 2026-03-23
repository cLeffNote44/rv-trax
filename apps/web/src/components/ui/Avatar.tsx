import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Avatar — user avatar with initials fallback
//
// Usage:
//   <Avatar name="John Doe" />
//   <Avatar name="Jane" src="/avatars/jane.jpg" size="lg" />
//   <Avatar name="System" color="green" />
// ---------------------------------------------------------------------------

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
} as const;

const COLOR_CLASSES = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  amber: 'bg-amber-600',
  red: 'bg-red-600',
  purple: 'bg-purple-600',
  gray: 'bg-slate-600',
} as const;

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  color?: keyof typeof COLOR_CLASSES;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Deterministic color from name (consistent across renders)
function nameToColor(name: string): keyof typeof COLOR_CLASSES {
  const colors = Object.keys(COLOR_CLASSES) as (keyof typeof COLOR_CLASSES)[];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

export function Avatar({ name, src, size = 'md', color, className }: AvatarProps) {
  const resolvedColor = color ?? nameToColor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover', SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        SIZE_CLASSES[size],
        COLOR_CLASSES[resolvedColor],
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
