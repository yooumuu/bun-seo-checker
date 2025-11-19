import type { ScanJob } from '@shared/types';
import { cn } from '@/lib/utils';

const statusStyles: Record<ScanJob['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  running: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
};

export const StatusBadge = ({ status }: { status: ScanJob['status'] }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
      statusStyles[status]
    )}
  >
    {status}
  </span>
);

export const ModeBadge = ({ mode }: { mode: ScanJob['mode'] }) => (
  <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">
    {mode === 'site' ? '整站' : '单页'}
  </span>
);
