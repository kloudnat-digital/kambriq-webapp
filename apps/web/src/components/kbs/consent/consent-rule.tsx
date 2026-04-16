'use client';

import { type LucideIcon } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ConsentRuleProps {
  id: string;
  checked: boolean;
  onCheck: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  items?: string[];
  variant?: 'default' | 'destructive';
}

export function ConsentRule({
  id,
  checked,
  onCheck,
  icon: Icon,
  title,
  description,
  items,
  variant = 'default',
}: ConsentRuleProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl border p-4',
        variant === 'destructive' ? 'border-red-300 bg-red-50' : 'border-border bg-gray-50',
      )}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onCheck} className="mt-0.5" />
      <div className="flex-1">
        <Label
          htmlFor={id}
          className={cn(
            'flex cursor-pointer items-center gap-2 text-base font-semibold',
            variant === 'destructive' ? 'text-red-700' : 'text-gray-900',
          )}
        >
          <Icon
            className={cn('size-4', variant === 'destructive' ? 'text-red-500' : 'text-primary')}
          />
          {title}
        </Label>
        <p className="mt-1.5 text-sm text-gray-500">{description}</p>
        {items && (
          <ul className="mt-2 ml-2 space-y-1 text-sm text-gray-500">
            {items.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
