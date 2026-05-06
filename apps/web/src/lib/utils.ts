import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const toArray = <T>(raw: unknown): T[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  return (raw as { data?: T[] }).data ?? [];
};

export const hasRole = (roles: string[], ...codes: string[]) =>
  codes.some((c) => roles.includes(c));
