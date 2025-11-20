import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, handleResponse } from '@/lib/api';
import {
  getScansQueryOptions,
  useCancelScanMutation,
  useRetryScanMutation,
  useDeleteScanMutation
} from '@/lib/api/scans';
import { StatusBadge, ModeBadge } from '@/components/scan-badges';
import { formatDateTime } from '@/lib/utils';
import { Activity, Clock, Zap, CheckCircle2, AlertCircle, Loader2, XCircle, RotateCw, Trash2, Eye } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { ScanJob } from '@shared/types';

export const Route = createFileRoute('/tasks')({
  component: TasksRoute,
});

type QueueState = {
  queue: number[];
  running: number[];
  cancelRequested: number[];
};

const getQueueState = () =>
  handleResponse<QueueState>(api.scans.queue.state.$get());

function TasksRoute() {
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());

  const queueQuery = useQuery({
    queryKey: ['queue-state'],
    queryFn: getQueueState,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  const runningQuery = useQuery(
    getScansQueryOptions({ status: 'running', limit: 100 })
  );

  const pendingQuery = useQuery(
    getScansQueryOptions({ status: 'pending', limit: 100 })
  );

  const recentCompletedQuery = useQuery(
    getScansQueryOptions({ status: 'completed', limit: 10, sort: 'completedAt', direction: 'desc' })
  );

  const recentFailedQuery = useQuery(
    getScansQueryOptions({ status: 'failed', limit: 10, sort: 'completedAt', direction: 'desc' })
  );

  const cancelMutation = useCancelScanMutation();
  const retryMutation = useRetryScanMutation();
  const deleteMutation = useDeleteScanMutation();

  const queueState = queueQuery.data;
  const runningJobs = runningQuery.data?.jobs ?? [];
  const pendingJobs = pendingQuery.data?.jobs ?? [];
  const completedJobs = recentCompletedQuery.data?.jobs ?? [];
  const failedJobs = recentFailedQuery.data?.jobs ?? [];

  const toggleSelection = (jobId: number) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleBulkCancel = () => {
    selectedJobs.forEach((jobId) => {
      const job = [...runningJobs, ...pendingJobs].find((j) => j.id === jobId);
      if (job && (job.status === 'running' || job.status === 'pending')) {
        cancelMutation.mutate(jobId);
      }
    });
    setSelectedJobs(new Set());
  };

  const handleBulkRetry = () => {
    selectedJobs.forEach((jobId) => {
      const job = failedJobs.find((j) => j.id === jobId);
      if (job && job.status === 'failed') {
        retryMutation.mutate(jobId);
      }
    });
    setSelectedJobs(new Set());
  };

  const handleBulkDelete = () => {
    selectedJobs.forEach((jobId) => {
      const job = [...completedJobs, ...failedJobs].find((j) => j.id === jobId);
      if (job && job.status !== 'running' && job.status !== 'pending') {
        deleteMutation.mutate(jobId);
      }
    });
    setSelectedJobs(new Set());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">任务管理</h1>
        <p className="text-sm text-muted-foreground">
          实时查看任务队列状态和管理所有扫描任务
        </p>
      </div>

      {/* Queue Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">正在运行</p>
              <p className="text-2xl font-bold text-foreground">
                {queueState?.running.length ?? runningJobs.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">等待队列</p>
              <p className="text-2xl font-bold text-foreground">
                {queueState?.queue.length ?? pendingJobs.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">最近完成</p>
              <p className="text-2xl font-bold text-foreground">{completedJobs.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">最近失败</p>
              <p className="text-2xl font-bold text-foreground">{failedJobs.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedJobs.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950">
          <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-medium text-foreground">
            已选择 {selectedJobs.size} 个任务
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={handleBulkCancel}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              批量取消
            </button>
            <button
              type="button"
              onClick={handleBulkRetry}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              批量重试
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-700"
            >
              批量删除
            </button>
            <button
              type="button"
              onClick={() => setSelectedJobs(new Set())}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* Running Jobs */}
      {runningJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-foreground">正在运行的任务</h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              {runningJobs.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {runningJobs.map((job) => (
              <TaskCard
                key={job.id}
                job={job}
                isSelected={selectedJobs.has(job.id)}
                onToggleSelect={() => toggleSelection(job.id)}
                onCancel={() => cancelMutation.mutate(job.id)}
                isCancelling={cancelMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pending Jobs */}
      {pendingJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-bold text-foreground">等待队列</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
              {pendingJobs.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingJobs.map((job) => (
              <TaskCard
                key={job.id}
                job={job}
                isSelected={selectedJobs.has(job.id)}
                onToggleSelect={() => toggleSelection(job.id)}
                onCancel={() => cancelMutation.mutate(job.id)}
                isCancelling={cancelMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {/* Failed Jobs */}
      {failedJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <h2 className="text-lg font-bold text-foreground">最近失败的任务</h2>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
              {failedJobs.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {failedJobs.map((job) => (
              <TaskCard
                key={job.id}
                job={job}
                isSelected={selectedJobs.has(job.id)}
                onToggleSelect={() => toggleSelection(job.id)}
                onRetry={() => retryMutation.mutate(job.id)}
                onDelete={() => deleteMutation.mutate(job.id)}
                isRetrying={retryMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Jobs */}
      {completedJobs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-foreground">最近完成的任务</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              {completedJobs.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {completedJobs.map((job) => (
              <TaskCard
                key={job.id}
                job={job}
                isSelected={selectedJobs.has(job.id)}
                onToggleSelect={() => toggleSelection(job.id)}
                onDelete={() => deleteMutation.mutate(job.id)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {runningJobs.length === 0 && pendingJobs.length === 0 && failedJobs.length === 0 && completedJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <Activity className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">暂无活动任务</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            创建一个新的扫描任务来开始
          </p>
        </div>
      )}
    </div>
  );
}

type TaskCardProps = {
  job: ScanJob;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  isCancelling?: boolean;
  isRetrying?: boolean;
  isDeleting?: boolean;
};

function TaskCard({
  job,
  isSelected,
  onToggleSelect,
  onCancel,
  onRetry,
  onDelete,
  isCancelling,
  isRetrying,
  isDeleting,
}: TaskCardProps) {
  const progress = job.pagesTotal
    ? Math.min(100, Math.round(((job.pagesFinished ?? 0) / job.pagesTotal) * 100))
    : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all hover:border-indigo-200 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              to="/history/$scanId"
              params={{ scanId: job.id.toString() }}
              className="truncate text-sm font-semibold text-foreground hover:text-indigo-600 hover:underline"
            >
              {job.targetUrl}
            </Link>
            <StatusBadge status={job.status} />
          </div>

          <div className="flex items-center gap-2">
            <ModeBadge mode={job.mode} />
            <span className="text-xs text-muted-foreground">
              {job.mode === 'single'
                ? `步骤 ${job.pagesFinished ?? 0} / ${job.pagesTotal ?? 6}`
                : `${job.pagesFinished ?? 0} / ${job.pagesTotal ?? '-'} 页`
              }
            </span>
          </div>

          {(job.status === 'running' || job.status === 'pending') && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">进度: {progress}%</p>
            </div>
          )}

          {job.error && (
            <p className="text-xs text-rose-600 font-medium">
              错误: {job.error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            创建于 {formatDateTime(job.createdAt)}
          </p>

          <div className="flex items-center gap-2 pt-2">
            <Link
              to="/history/$scanId"
              params={{ scanId: job.id.toString() }}
              className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              <Eye className="h-3 w-3" />
              详情
            </Link>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isCancelling}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                取消
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
              >
                {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                重试
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                删除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
