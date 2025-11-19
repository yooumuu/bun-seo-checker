import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('default', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatDuration = (ms?: number | null) => {
  if (!ms || Number.isNaN(ms)) return '--';
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
};

export const formatPercentage = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
};
