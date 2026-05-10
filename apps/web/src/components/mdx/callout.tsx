import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type CalloutType = 'info' | 'warning' | 'danger' | 'success';

const TYPE_CLASSES: Record<CalloutType, string> = {
  info: 'border-blue-500 bg-blue-50 text-blue-900',
  warning: 'border-amber-500 bg-amber-50 text-amber-900',
  danger: 'border-red-500 bg-red-50 text-red-900',
  success: 'border-emerald-500 bg-emerald-50 text-emerald-900',
};

export type CalloutProps = {
  type?: CalloutType;
  title?: string;
  className?: string;
  children: ReactNode;
};

export function Callout({ type = 'info', title, className, children }: CalloutProps) {
  return (
    <div
      role="note"
      data-callout-type={type}
      className={cn(
        'my-6 rounded-r-md border-l-4 px-5 py-4 [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-2 [&_p]:text-current [&_p:last-child]:mb-0',
        TYPE_CLASSES[type],
        className,
      )}
    >
      {title ? <p className="mb-2 font-semibold">{title}</p> : null}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
