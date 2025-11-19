import { ModeBadge, StatusBadge } from '@/components/scan-badges';
import { getScanById, useLiveScanEvents } from '@/lib/api/scans';
import { formatDateTime } from '@/lib/utils';
import { useQueries } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ScanJob } from '@shared/types';

export const LiveTaskDock = () => {
  const { latestJobs } = useLiveScanEvents();
  const activeJobs = latestJobs.slice(0, 5);

  const jobDetails = useQueries({
    queries: activeJobs.map((event) => ({
      queryKey: ['scan', event.jobId],
      queryFn: () => getScanById(event.jobId),
      staleTime: 1000 * 5,
    })),
  });

  const items = activeJobs.map((event, index) => ({
    event,
    job: jobDetails[index]?.data,
  }));

  return (
    <aside className="fixed bottom-4 right-4 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm font-semibold text-slate-900">实时任务</p>
      <p className="text-xs text-slate-500">
        最多显示 5 条最近的扫描任务。
      </p>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">暂无运行任务。</p>
        ) : null}
        {items.map(({ event, job }) => (
          <div
            key={`${event.jobId}-${event.id}`}
            className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900">
                  {job?.targetUrl ?? `任务 #${event.jobId}`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
              {job ? (
                <ModeBadge mode={job.mode} />
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between">
              {job ? (
                <StatusBadge status={job.status} />
              ) : (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                  {event.type}
                </span>
              )}
              <span>
                {job?.pagesFinished ?? 0}/{job?.pagesTotal ?? '?'} 页
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width]"
                style={{ width: `${calculateProgress(event, job)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span>{eventDescription(event.type)}</span>
              <Link
                to="/history/$scanId"
                params={{ scanId: event.jobId.toString() }}
                className="font-medium text-sky-600"
              >
                查看
              </Link>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

const eventDescription = (type: string) => {
  switch (type) {
    case 'queued':
      return '等待执行';
    case 'started':
      return '任务开始';
    case 'page_completed':
      return '页面已完成';
    case 'completed':
      return '任务完成';
    case 'failed':
      return '任务失败';
    default:
      return type;
  }
};

type TaskEventPayload = {
  pagesFinished?: number;
};

const calculateProgress = (
  event: { payload: Record<string, unknown> | TaskEventPayload | null; type: string },
  job?: ScanJob
) => {
  if (!job) return 0;
  const total = job.pagesTotal ?? 0;
  if (!total) return 0;

  if (event.type === 'page_completed') {
    const payload = event.payload as TaskEventPayload | null;
    const finishedFromEvent =
      typeof payload?.pagesFinished === 'number'
        ? payload.pagesFinished
        : job.pagesFinished ?? 0;
    return Math.min(100, Math.round((finishedFromEvent / total) * 100));
  }

  if (job.status === 'completed') {
    return 100;
  }

  const finished = job.pagesFinished ?? 0;
  return Math.min(100, Math.round((finished / total) * 100));
};
