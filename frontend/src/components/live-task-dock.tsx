import { ModeBadge, StatusBadge } from '@/components/scan-badges';
import { getScanById, useLiveScanEvents, useCancelScanMutation } from '@/lib/api/scans';
import { formatDateTime, cn } from '@/lib/utils';
import { useQueries } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ScanJob } from '@shared/types';
import { Activity, X, ChevronRight, Loader2, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

export const LiveTaskDock = () => {
  const { latestJobs } = useLiveScanEvents();
  const [isMinimized, setIsMinimized] = useState(false);
  const [completedToasts, setCompletedToasts] = useState<Set<number>>(new Set());
  const cancelMutation = useCancelScanMutation();

  const activeJobs = latestJobs
    .filter((event) => !['completed', 'failed', 'cancelled'].includes(event.type))
    .slice(0, 5);

  const recentlyCompletedJobs = latestJobs
    .filter((event) => ['completed', 'failed', 'cancelled'].includes(event.type))
    .slice(0, 3);

  const jobDetails = useQueries({
    queries: activeJobs.map((event) => ({
      queryKey: ['scan', event.jobId],
      queryFn: () => getScanById(event.jobId),
      staleTime: 1000 * 5,
    })),
  });

  const items = activeJobs
    .map((event, index) => ({
      event,
      job: jobDetails[index]?.data,
    }))
    .filter(({ job }) => {
      // If job details haven't loaded yet, keep it visible
      if (!job) return true;
      // Filter out completed or failed jobs
      return !['completed', 'failed'].includes(job.status);
    });

  // Show notification for completed/failed jobs
  useEffect(() => {
    const newCompleted = recentlyCompletedJobs.filter(
      (event) => !completedToasts.has(event.jobId)
    );

    if (newCompleted.length > 0) {
      // Auto-expand dock to show completion notifications
      setIsMinimized(false);

      // Mark as shown after 5 seconds
      const timer = setTimeout(() => {
        setCompletedToasts((prev) => {
          const next = new Set(prev);
          newCompleted.forEach((event) => next.add(event.jobId));
          return next;
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [recentlyCompletedJobs, completedToasts]);

  const hasCompletedNotifications = recentlyCompletedJobs.some(
    (event) => !completedToasts.has(event.jobId)
  );

  if (items.length === 0 && !hasCompletedNotifications) return null;

  return (
    <aside className={cn(
      "fixed z-40 flex flex-col gap-2 transition-all duration-300 ease-in-out",
      "bottom-4 right-4 sm:bottom-6 sm:right-6",
      isMinimized ? "w-auto" : "w-[calc(100vw-2rem)] sm:w-96 max-w-[calc(100vw-2rem)]"
    )}>
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition-transform hover:scale-105 hover:bg-indigo-700"
        >
          <Activity className="h-6 w-6" />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
            {items.length + (hasCompletedNotifications ? recentlyCompletedJobs.filter((e) => !completedToasts.has(e.jobId)).length : 0)}
          </span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              <span className="text-xs sm:text-sm font-semibold text-foreground">实时任务</span>
              <span className="rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                {items.length}
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] sm:max-h-[60vh] overflow-y-auto p-2">
            <div className="space-y-2">
              {/* Active Running Jobs */}
              {items.map(({ event, job }) => (
                <div
                  key={`${event.jobId}-${event.id}`}
                  className="group relative overflow-hidden rounded-xl border border-border bg-background p-3 transition-all hover:border-indigo-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {job?.targetUrl ?? `任务 #${event.jobId}`}
                        </span>
                        {job && <ModeBadge mode={job.mode} />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(event.createdAt)}</span>
                        <span>•</span>
                        <span className={cn(
                          "font-medium",
                          event.type === 'failed' ? "text-rose-500" : "text-indigo-500"
                        )}>
                          {eventDescription(event.type)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job ? (
                        <StatusBadge status={job.status} />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>进度</span>
                      <span className="font-medium text-foreground">
                        {Math.round(calculateProgress(event, job))}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${calculateProgress(event, job)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      to="/history/$scanId"
                      params={{ scanId: event.jobId.toString() }}
                      className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-center text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
                    >
                      查看详情
                    </Link>
                    {job && (job.status === 'running' || job.status === 'pending') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelMutation.mutate(event.jobId);
                        }}
                        disabled={cancelMutation.isPending}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Recently Completed/Failed Jobs Notifications */}
              {recentlyCompletedJobs
                .filter((event) => !completedToasts.has(event.jobId))
                .map((event) => (
                  <div
                    key={`complete-${event.jobId}-${event.id}`}
                    className={cn(
                      "animate-in slide-in-from-bottom-2 rounded-xl border p-3 transition-all",
                      event.type === 'completed'
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                        : event.type === 'cancelled'
                        ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                        : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {event.type === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : event.type === 'cancelled' ? (
                        <XCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {event.type === 'completed'
                            ? '任务已完成'
                            : event.type === 'cancelled'
                            ? '任务已取消'
                            : '任务失败'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          任务 #{event.jobId}
                        </p>
                        <Link
                          to="/history/$scanId"
                          params={{ scanId: event.jobId.toString() }}
                          className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline"
                        >
                          查看详情 →
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedToasts((prev) => {
                            const next = new Set(prev);
                            next.add(event.jobId);
                            return next;
                          });
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

const eventDescription = (type: string) => {
  switch (type) {
    case 'queued': return '等待执行';
    case 'started': return '任务开始';
    case 'page_completed': return '页面已完成';
    case 'completed': return '任务完成';
    case 'failed': return '任务失败';
    case 'cancelled': return '已取消';
    default: return type;
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
