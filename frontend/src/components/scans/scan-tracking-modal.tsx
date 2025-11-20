import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { getScanByIdQueryOptions, useLiveScanEvents } from '@/lib/api/scans';
import { StatusBadge, ModeBadge } from '@/components/scan-badges';
import { formatDateTime } from '@/lib/utils';
import { X, CheckCircle2, AlertCircle, Loader2, ChevronRight, ExternalLink } from 'lucide-react';

type ScanTrackingModalProps = {
  scanId: number;
  isOpen: boolean;
  onClose: () => void;
};

export function ScanTrackingModal({ scanId, isOpen, onClose }: ScanTrackingModalProps) {
  const navigate = useNavigate();
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);
  const { latestJobs } = useLiveScanEvents();

  const scanQuery = useQuery({
    ...getScanByIdQueryOptions(scanId),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop refetching when completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // Refetch every second for active scans
    },
    enabled: isOpen,
  });

  const scan = scanQuery.data;

  // Get latest event for this scan
  const latestEvent = latestJobs.find((event) => event.jobId === scanId);

  // Calculate progress
  const progress = scan?.pagesTotal
    ? Math.min(100, Math.round(((scan.pagesFinished ?? 0) / scan.pagesTotal) * 100))
    : 0;

  // Auto-redirect when completed
  useEffect(() => {
    if (scan?.status === 'completed') {
      setAutoRedirectCountdown(5);
      const interval = setInterval(() => {
        setAutoRedirectCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            handleViewResults();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [scan?.status]);

  const handleViewResults = () => {
    navigate({ to: '/history/$scanId', params: { scanId: scanId.toString() } });
    onClose();
  };

  const handleClose = () => {
    if (scan?.status === 'running' || scan?.status === 'pending') {
      // Show confirmation for active scans
      const confirmed = window.confirm('扫描仍在进行中，确定要关闭追踪窗口吗？您可以稍后在任务管理或历史记录中查看进度。');
      if (!confirmed) return;
    }
    setAutoRedirectCountdown(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              {scan?.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : scan?.status === 'failed' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {scan?.status === 'completed'
                  ? '扫描完成'
                  : scan?.status === 'failed'
                  ? '扫描失败'
                  : '正在扫描'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {scan?.status === 'completed'
                  ? '所有页面已成功分析'
                  : scan?.status === 'failed'
                  ? '扫描过程中发生错误'
                  : '正在分析您的网站...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {scan && (
            <>
              {/* URL and Status */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">目标URL</p>
                    <p className="mt-1 text-sm font-semibold text-foreground break-all">
                      {scan.targetUrl}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={scan.status} />
                    <ModeBadge mode={scan.mode} />
                  </div>
                </div>

                {/* Progress Bar for Running Scans */}
                {(scan.status === 'running' || scan.status === 'pending') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {scan.mode === 'single' ? '分析进度' : '扫描进度'}
                      </span>
                      <span className="font-medium text-foreground">
                        {scan.mode === 'single'
                          ? `步骤 ${scan.pagesFinished ?? 0} / ${scan.pagesTotal ?? 6}`
                          : `${scan.pagesFinished ?? 0} / ${scan.pagesTotal ?? '...'} 页`
                        }
                      </span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{progress}% 完成</span>
                      {latestEvent && (
                        <span className="font-medium">
                          {latestEvent.type === 'started' && '开始扫描...'}
                          {latestEvent.type === 'page_completed' && '正在处理页面...'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {scan.status === 'failed' && scan.error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <div>
                        <p className="text-sm font-medium text-foreground">错误信息</p>
                        <p className="mt-1 text-sm text-muted-foreground">{scan.error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Summary */}
                {scan.status === 'completed' && scan.issuesSummary && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">扫描完成</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          成功分析 {scan.pagesFinished} 个页面
                        </p>
                        {autoRedirectCountdown !== null && (
                          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {autoRedirectCountdown} 秒后自动跳转到结果页面...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">创建时间</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatDateTime(scan.createdAt)}
                  </p>
                </div>
                {scan.startedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">开始时间</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatDateTime(scan.startedAt)}
                    </p>
                  </div>
                )}
                {scan.completedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">完成时间</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatDateTime(scan.completedAt)}
                    </p>
                  </div>
                )}
                {scan.completedAt && scan.startedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">耗时</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {Math.round(
                        (new Date(scan.completedAt).getTime() -
                          new Date(scan.startedAt).getTime()) /
                          1000
                      )}{' '}
                      秒
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {!scan && scanQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="mt-3 text-sm text-muted-foreground">正在加载扫描信息...</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          {scan?.status === 'completed' && (
            <>
              <button
                type="button"
                onClick={() => setAutoRedirectCountdown(null)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                取消自动跳转
              </button>
              <button
                type="button"
                onClick={handleViewResults}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                查看结果
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {scan?.status === 'failed' && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              关闭
            </button>
          )}
          {(scan?.status === 'running' || scan?.status === 'pending') && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                后台运行
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate({ to: '/tasks' });
                  onClose();
                }}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <ExternalLink className="h-4 w-4" />
                任务管理
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
