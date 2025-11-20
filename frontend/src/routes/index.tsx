import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getScansQueryOptions } from '@/lib/api/scans';
import { useState } from 'react';
import { CreateScanDialog } from '@/components/scans/create-scan-dialog';
import { ScanCard } from '@/components/scans/scan-card';
import { ScanTrackingModal } from '@/components/scans/scan-tracking-modal';
import { Plus, ArrowRight, Activity } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

function HomeRoute() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [trackingScanId, setTrackingScanId] = useState<number | null>(null);
  const recentScans = useQuery(
    getScansQueryOptions({ limit: 6, sort: 'createdAt', direction: 'desc' })
  );

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="rounded-2xl border border-border bg-card px-8 py-12 shadow-sm sm:px-12 sm:py-16">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            SEO 与埋点巡检
          </h1>
          <p className="text-lg text-muted-foreground">
            一键扫描，实时洞察。支持单页分析与整站爬取，自动检测 SEO 标签、UTM 参数及埋点覆盖率。
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              <Plus className="h-5 w-5" />
              新建扫描任务
            </button>
            <Link
              to="/history"
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              查看历史记录
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Scans */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">最近扫描</h2>
          <Link
            to="/history"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            查看全部 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recentScans.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted/50" />
            ))
          ) : recentScans.data?.jobs.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">暂无扫描记录</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                创建一个新的扫描任务来开始分析您的网站。
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                立即开始
              </button>
            </div>
          ) : (
            recentScans.data?.jobs.map((job) => (
              <ScanCard
                key={job.id}
                job={job}
                onClick={
                  job.status === 'running' || job.status === 'pending'
                    ? () => setTrackingScanId(job.id)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </section>

      <CreateScanDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      {trackingScanId && (
        <ScanTrackingModal
          scanId={trackingScanId}
          isOpen={true}
          onClose={() => setTrackingScanId(null)}
        />
      )}
    </div>
  );
}
