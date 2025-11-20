import { ModeBadge, StatusBadge } from '@/components/scan-badges';
import {
  getScanByIdQueryOptions,
  getScanPagesQueryOptions,
} from '@/lib/api/scans';
import { formatDateTime, formatDuration } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  LayoutDashboard,
  Search,
  Timer,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ScanIssuesSummary, ScanPageWithMetrics } from '@shared/types';

type DetailSearch = {
  page?: number;
  q?: string;
  status?: ScanPageWithMetrics['status'] | 'all';
  sort?: 'createdAt' | 'url' | 'httpStatus' | 'loadTimeMs' | 'seoScore';
  direction?: 'asc' | 'desc';
};

const sanitizeSearch = (search: Record<string, unknown>): DetailSearch => ({
  page:
    typeof search.page === 'number' && search.page > 0
      ? search.page
      : undefined,
  q: typeof search.q === 'string' ? search.q : '',
  status:
    search.status === 'pending' ||
    search.status === 'processing' ||
    search.status === 'completed' ||
    search.status === 'failed'
      ? search.status
      : 'all',
  sort:
    search.sort === 'url' ||
    search.sort === 'httpStatus' ||
    search.sort === 'loadTimeMs' ||
    search.sort === 'seoScore'
      ? search.sort
      : 'createdAt',
  direction: search.direction === 'asc' ? 'asc' : 'desc',
});

export const Route = createFileRoute('/history/$scanId/')({
  validateSearch: sanitizeSearch,
  component: ScanDetailRoute,
});

function ScanDetailRoute() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const scanId = Number(params.scanId);

  const page = search.page ?? 1;
  const limit = 10;
  const [pageFilter, setPageFilter] = useState(search.q ?? '');

  const scanQuery = useQuery(getScanByIdQueryOptions(scanId));
  const pagesQuery = useQuery(
    getScanPagesQueryOptions(scanId, {
      limit,
      offset: (page - 1) * limit,
      search: search.q || undefined,
      status:
        search.status && search.status !== 'all' ? search.status : undefined,
      sort: search.sort ?? 'createdAt',
      direction: search.direction ?? 'desc',
    })
  );

  const updateSearch = (updates: Partial<DetailSearch>) => {
    const nextSearch: DetailSearch = {
      ...search,
      ...updates,
    };
    navigate({
      to: '/history/$scanId',
      params,
      search: nextSearch,
    });
  };

  const totalPages = useMemo(() => {
    const total = pagesQuery.data?.pagination.total ?? 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [pagesQuery.data?.pagination.total, limit]);

  const scan = scanQuery.data;
  const summary: ScanIssuesSummary | null = scan?.issuesSummary
    ? (scan.issuesSummary as ScanIssuesSummary)
    : null;
  const pages = pagesQuery.data?.pages ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Breadcrumb / Back Link */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          to="/history"
          className="flex items-center gap-1 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回历史列表
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-900">任务详情</span>
      </div>

      {/* Header Section */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {scan ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {scan.targetUrl}
                  </h1>
                  <StatusBadge status={scan.status} />
                  <ModeBadge mode={scan.mode} />
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateTime(scan.createdAt)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {scan.pagesFinished} / {scan.pagesTotal} 页面
                  </div>
                  {scan.completedAt && (
                    <div className="flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5" />
                      耗时{' '}
                      {formatDuration(
                        new Date(scan.completedAt).getTime() -
                          new Date(scan.startedAt!).getTime()
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">{/* Actions if needed */}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="综合评分"
                value={
                  summary ? `${summary.scorecard.overallHealthPercent}%` : '--'
                }
                icon={<LayoutDashboard className="h-5 w-5 text-indigo-500" />}
                trend="结合 SEO / UTM / Tracking"
              />
              <SummaryCard
                label="SEO 平均分"
                value={summary ? `${summary.scorecard.seoAverageScore}` : '--'}
                icon={<Globe className="h-5 w-5 text-sky-500" />}
                trend="标题 / 描述 / H1"
              />
              <SummaryCard
                label="UTM 覆盖率"
                value={
                  summary ? `${summary.scorecard.utmCoveragePercent}%` : '--'
                }
                icon={<ExternalLink className="h-5 w-5 text-emerald-500" />}
                trend="内部链接标记情况"
              />
              <SummaryCard
                label="埋点覆盖 (Mixpanel/GA)"
                value={
                  summary
                    ? `${summary.scorecard.trackingCoverage.mixpanel}% / ${summary.scorecard.trackingCoverage.ga}%`
                    : '--'
                }
                icon={<Clock className="h-5 w-5 text-amber-500" />}
                trend="脚本检测率"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-slate-500">
            加载扫描详情中...
          </div>
        )}
      </header>

      {/* Content Section */}
      <section className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between border border-slate-200">
          <form
            className="relative flex-1 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              updateSearch({ q: pageFilter, page: 1 });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              placeholder="搜索页面 URL..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={search.status ?? 'all'}
                onChange={(e) =>
                  updateSearch({
                    status: e.target.value as DetailSearch['status'],
                    page: 1,
                  })
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">所有状态</option>
                <option value="completed">已完成</option>
                <option value="processing">处理中</option>
                <option value="failed">失败</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              <select
                value={search.sort ?? 'createdAt'}
                onChange={(e) =>
                  updateSearch({ sort: e.target.value as DetailSearch['sort'] })
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="createdAt">创建时间</option>
                <option value="url">URL</option>
                <option value="seoScore">SEO 得分</option>
                <option value="loadTimeMs">加载耗时</option>
              </select>
              <button
                onClick={() =>
                  updateSearch({
                    direction: search.direction === 'asc' ? 'desc' : 'asc',
                  })
                }
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                title={search.direction === 'asc' ? '升序' : '降序'}
              >
                {search.direction === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">页面 URL</th>
                  <th className="px-6 py-4">状态 / HTTP</th>
                  <th className="px-6 py-4">性能指标</th>
                  <th className="px-6 py-4">链接与埋点</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagesQuery.isPending ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      加载数据中...
                    </td>
                  </tr>
                ) : pages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      没有找到符合条件的页面
                    </td>
                  </tr>
                ) : (
                  pages.map((pageItem) => (
                    <tr
                      key={pageItem.id}
                      className="group hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="max-w-md break-words font-medium text-slate-900">
                          {pageItem.url}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(pageItem.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              pageItem.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : pageItem.status === 'failed'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-sky-50 text-sky-700'
                            }`}
                          >
                            {pageItem.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            HTTP {pageItem.httpStatus ?? '--'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Timer className="h-3 w-3 text-slate-400" />
                            {formatDuration(pageItem.loadTimeMs)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-3 w-3 text-slate-400" />
                            SEO:{' '}
                            <span className="font-medium">
                              {pageItem.seo?.score ?? '--'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <UtmInlineList summary={pageItem.links?.utmSummary} />
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {(pageItem.links?.redirects ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-100">
                                {pageItem.links?.redirects} 重定向
                              </span>
                            )}
                            {(pageItem.links?.brokenLinks ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 border border-rose-100">
                                {pageItem.links?.brokenLinks} 异常
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <LayoutDashboard className="h-3 w-3" />
                            <span>
                              {pageItem.trackingEvents.length} 个埋点事件
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <Link
                          to="/history/$scanId/pages/$pageId"
                          params={{
                            scanId: params.scanId,
                            pageId: pageItem.id.toString(),
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                        >
                          详情
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="text-sm text-slate-500">
              显示 {pages.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
              {Math.min(page * limit, pagesQuery.data?.pagination.total ?? 0)}{' '}
              条，共 {pagesQuery.data?.pagination.total ?? 0} 条
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>
              <button
                onClick={() =>
                  updateSearch({ page: Math.min(totalPages, page + 1) })
                }
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const SummaryCard = ({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
}) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:shadow-md">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      {icon}
    </div>
    <div className="mt-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
    </div>
  </div>
);

type PageUtmSummary = NonNullable<
  NonNullable<ScanPageWithMetrics['links']>['utmSummary']
>;

const UtmInlineList = ({ summary }: { summary?: PageUtmSummary | null }) => {
  const examples = summary?.examples ?? [];
  if (examples.length === 0) {
    return <p className="text-[11px] text-slate-400">暂无链接数据</p>;
  }

  const trackedCount = summary?.trackedLinks ?? 0;
  const missingCount = summary?.missingUtm ?? 0;

  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      {trackedCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 border border-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {trackedCount} 已标记
        </span>
      )}
      {missingCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-100">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {missingCount} 未标记
        </span>
      )}
    </div>
  );
};
