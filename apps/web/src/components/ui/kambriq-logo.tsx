import Image from 'next/image';

import { cn } from '@/lib/utils';

interface KambriqLogoProps {
  className?: string;
}

export function KambriqLogo({ className }: KambriqLogoProps) {
  return (
    <div className={cn('relative size-12', className)}>
      <Image
        fill
        draggable={false}
        alt="KAMBRIQ Logo"
        className="object-contain"
        src="/assets/images/kambriq-logo.png"
      />
    </div>
  );
}
