import { cn } from '@/lib/utils';
import type { FC, HTMLAttributes } from 'react';

interface EyebrowProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'teal' | 'gold' | 'muted';
}

const TONE_CLASSES: Record<NonNullable<EyebrowProps['tone']>, string> = {
  teal: 'text-primary',
  gold: 'text-gold-300',
  muted: 'text-surface-500',
};

const Eyebrow: FC<EyebrowProps> = ({ tone = 'teal', className, children, ...rest }) => {
  return (
    <div
      className={cn(
        'font-sans text-[11px] font-semibold tracking-[0.14em] uppercase',
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Eyebrow;
