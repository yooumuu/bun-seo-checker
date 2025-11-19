import { ModeBadge, StatusBadge } from '@/components/scan-badges';
import {
  getScanByIdQueryOptions,
  getScanPagesQueryOptions,
} from '@/lib/api/scans';
import { formatDateTime, formatDuration, formatPercentage } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { ScanIssuesSummary, ScanJob, ScanPageWithMetrics } from '@shared/types';

type DetailSearch = {
  page?: number;
  q?: string;
  status?: ScanPageWithMetrics['status'] | 'all';
  sort?: 'createdAt' | 'url' | 'httpStatus' | 'loadTimeMs' | 'seoScore';
  direction?: 'asc' | 'desc';
};

const sanitizeSearch = (search: Record<string, unknown>): DetailSearch => ({
  page:
    typeof search.page === 'number' && search.page > 0 ? search.page : undefined,
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
      status: search.status && search.status !== 'all' ? search.status : undefined,
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
    <div className="space-y-6">
      <Link
        to="/history"
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        ← 返回历史列表
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {scan ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-slate-400">任务 #{scan.id}</p>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {scan.targetUrl}
                </h1>
                <p className="text-sm text-slate-500">
                  创建于 {formatDateTime(scan.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ModeBadge mode={scan.mode} />
                <StatusBadge status={scan.status} />
              </div>
            </div>

            <dl className="grid gap-4 md:grid-cols-4">
              <SummaryCard
                label="综合评分"
                value={
                  summary
                    ? `${summary.scorecard.overallHealthPercent}%`
                    : '--'
                }
                helper="结合 SEO / UTM / Tracking"
              />
              <SummaryCard
                label="SEO 平均分"
                value={
                  summary
                    ? `${summary.scorecard.seoAverageScore}`
                    : '--'
                }
                helper="标题描述 / canonical 等"
              />
              <SummaryCard
                label="UTM 覆盖"
                value={
                  summary
                    ? `${summary.scorecard.utmCoveragePercent}%`
                    : '--'
                }
                helper="内部链接 UTM 标记情况"
              />
              <SummaryCard
                label="Mixpanel / GA"
                value={
                  summary
                    ? `${summary.scorecard.trackingCoverage.mixpanel}% / ${summary.scorecard.trackingCoverage.ga}%`
                    : '--'
                }
                helper="埋点脚本覆盖率"
              />
            </dl>

            <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-3">
              <p>开始：{formatDateTime(scan.startedAt)}</p>
              <p>完成：{formatDateTime(scan.completedAt)}</p>
              <p>
                总页数：{scan.pagesFinished}/{scan.pagesTotal}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">加载扫描详情中…</p>
        )}
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">页面列表</h2>
            <p className="text-sm text-slate-500">
              支持搜索 URL、按状态或得分排序。
            </p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              updateSearch({ q: pageFilter, page: 1 });
            }}
          >
            <input
              type="search"
              value={pageFilter}
              onChange={(event) => setPageFilter(event.target.value)}
              placeholder="搜索页面 URL"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              搜索
            </button>
          </form>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs font-medium text-slate-500">
            状态
            <select
              value={search.status ?? 'all'}
              onChange={(event) =>
                updateSearch({
                  status: event.target.value as DetailSearch['status'],
                  page: 1,
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">全部</option>
              <option value="completed">已完成</option>
              <option value="processing">处理</option>
              <option value="failed">失败</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            排序字段
            <select
              value={search.sort ?? 'createdAt'}
              onChange={(event) =>
                updateSearch({ sort: event.target.value as DetailSearch['sort'] })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="createdAt">创建时间</option>
              <option value="url">URL</option>
              <option value="seoScore">SEO 得分</option>
              <option value="httpStatus">HTTP 状态码</option>
              <option value="loadTimeMs">加载耗时</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            排序方向
            <select
              value={search.direction ?? 'desc'}
              onChange={(event) =>
                updateSearch({
                  direction: event.target.value as 'asc' | 'desc',
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_80px]">
            <span>URL</span>
            <span>状态/HTTP</span>
            <span>耗时</span>
            <span>指标</span>
            <span />
          </div>
          {pagesQuery.isPending ? (
            <p className="p-6 text-center text-sm text-slate-500">加载页面中…</p>
          ) : null}
          {pages.map((pageItem) => (
            <article
              key={pageItem.id}
              className="grid gap-3 border-t border-slate-100 px-4 py-4 text-sm md:grid-cols-[2fr_1fr_1fr_1fr_80px]"
            >
              <div>
                <p className="font-medium text-slate-900">{pageItem.url}</p>
                <p className="text-xs text-slate-500">
                  {formatDateTime(pageItem.createdAt)}
                </p>
              </div>
              <div className="text-xs text-slate-600">
                <p>{pageItem.status}</p>
                <p>HTTP {pageItem.httpStatus ?? '--'}</p>
              </div>
              <div className="text-xs text-slate-600">
                {formatDuration(pageItem.loadTimeMs)} · SEO{' '}
                {pageItem.seo?.score ?? '--'}
              </div>
              <div className="text-xs text-slate-600">
                <p>
                  UTM{' '}
                  {formatPercentage(
                    calculateCoverage(pageItem.links?.utmSummary)
                  )}
                </p>
                <UtmInlineList summary={pageItem.links?.utmSummary} />
                <p className="mt-1">Tracking {pageItem.trackingEvents.length} 个</p>
              </div>
              <div className="flex items-center justify-end">
                <Link
                  to="/history/$scanId/pages/$pageId"
                  params={{
                    scanId: params.scanId,
                    pageId: pageItem.id.toString(),
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-200 hover:text-sky-600"
                >
                  详情
                </Link>
              </div>
            </article>
          ))}
          {pages.length === 0 && !pagesQuery.isPending ? (
            <p className="p-6 text-center text-sm text-slate-500">
              没有符合条件的页面。
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>
            共 {pagesQuery.data?.pagination.total ?? 0} 条 · 第 {page}/{totalPages} 页
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() =>
                updateSearch({ page: Math.min(totalPages, page + 1) })
              }
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const SummaryCard = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="text-2xl font-semibold text-slate-900">{value}</p>
    {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
  </div>
);

type PageUtmSummary = NonNullable<
  NonNullable<ScanPageWithMetrics['links']>['utmSummary']
>;

const calculateCoverage = (utmSummary?: PageUtmSummary | null) => {
  if (!utmSummary) return undefined;
  const total = (utmSummary.trackedLinks ?? 0) + (utmSummary.missingUtm ?? 0);
  if (total === 0) return undefined;
  return Math.round(((utmSummary.trackedLinks ?? 0) / total) * 100);
};


const UtmInlineList = ({
  summary,
}: {
  summary?: PageUtmSummary | null;
}) => {
  const examples = summary?.examples ?? [];
  if (examples.length === 0) {
    return <p className="text-[11px] text-slate-500">暂无 UTM 链接</p>;
  }

  const formatHeading = (example: PageUtmSummary['examples'][number]) => {
    if (!example.heading?.text) return '未定位';
    const level = example.heading?.tag?.toUpperCase();
    return `${level ?? ''} ${example.heading.text}`.trim();
  };

  return (
    <ul className="mt-1 space-y-1 text-[11px] text-slate-500">
      {examples.slice(0, 3).map((example) => (
        <li key={example.url} className="break-words">
          {example.deviceVariant ? (
            <span className="mr-1 inline-block rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
              {formatDeviceVariant(example.deviceVariant)}
            </span>
          ) : null}
          <span className="font-medium text-slate-600">
            {formatHeading(example)}
          </span>{' '}
          · {example.url}
        </li>
      ))}
      {examples.length > 3 ? (
        <li>... 等 {examples.length} 条</li>
      ) : null}
    </ul>
  );
};

const deviceVariantLabels: Record<string, string> = {
  desktop: '桌面',
  tablet: '平板',
  mobile: '移动',
};

const formatDeviceVariant = (variant?: string | null) => {
  if (!variant) return '未识别';
  return deviceVariantLabels[variant] ?? variant;
};
