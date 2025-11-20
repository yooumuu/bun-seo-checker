import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getScansQueryOptions } from '@/lib/api/scans';
import { useState } from 'react';
import { CreateScanDialog } from '@/components/scans/create-scan-dialog';
import { ScanCard } from '@/components/scans/scan-card';
import { Plus, ArrowRight, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

function HomeRoute() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const recentScans = useQuery(
    getScansQueryOptions({ limit: 6, sort: 'createdAt', direction: 'desc' })
  );

  // Calculate some dummy stats for now (or real ones if available)
  const totalScans = recentScans.data?.pagination.total ?? 0;
  const completedScans = recentScans.data?.jobs.filter(j => j.status === 'completed').length ?? 0;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 px-8 py-12 text-white shadow-xl sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            全栈 SEO 与埋点巡检
          </h1>
          <p className="text-lg text-indigo-100">
            一键扫描，实时洞察。支持单页分析与整站爬取，自动检测 SEO 标签、UTM 参数及埋点覆盖率。
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-indigo-600 shadow-lg transition-transform hover:scale-105 hover:bg-indigo-50"
            >
              <Plus className="h-5 w-5" />
              新建扫描任务
            </button>
            <Link
              to="/history"
              className="flex items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-indigo-500/30"
            >
              查看历史记录
            </Link>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-20 h-80 w-80 rounded-full bg-violet-500/30 blur-3xl" />
      </section>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">总扫描次数</p>
              <p className="text-2xl font-bold text-foreground">{totalScans}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">最近成功</p>
              <p className="text-2xl font-bold text-foreground">{completedScans}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">发现问题</p>
              <p className="text-2xl font-bold text-foreground">--</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scans */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">最近扫描</h2>
          <Link
            to="/history"
            className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
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
                className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                立即开始
              </button>
            </div>
          ) : (
            recentScans.data?.jobs.map((job) => (
              <ScanCard key={job.id} job={job} />
            ))
          )}
        </div>
      </section>

      <CreateScanDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
