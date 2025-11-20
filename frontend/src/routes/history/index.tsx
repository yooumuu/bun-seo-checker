import { ModeBadge, StatusBadge } from '@/components/scan-badges';
import {
  getScansQueryOptions,
  useDeleteScanMutation,
} from '@/lib/api/scans';
import { formatDateTime, formatPercentage, cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { ScanIssuesSummary, ScanJob } from '@shared/types';
import { Search, Filter, ArrowUpDown, Trash2, Eye, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type HistorySearch = {
  q?: string;
  mode?: ScanJob['mode'] | 'all';
  status?: ScanJob['status'] | 'all';
  sort?: ListSort;
  direction?: 'asc' | 'desc';
  page?: number;
};

type ListSort =
  | 'createdAt'
  | 'startedAt'
  | 'completedAt'
  | 'pagesTotal'
  | 'pagesFinished';

const sanitizeSearch = (search: Record<string, unknown>): HistorySearch => ({
  q: typeof search.q === 'string' ? search.q : '',
  mode:
    search.mode === 'single' || search.mode === 'site' ? search.mode : 'all',
  status:
    search.status === 'pending' ||
      search.status === 'running' ||
      search.status === 'completed' ||
      search.status === 'failed'
      ? search.status
      : 'all',
  sort:
    search.sort === 'startedAt' ||
      search.sort === 'completedAt' ||
      search.sort === 'pagesTotal' ||
      search.sort === 'pagesFinished'
      ? search.sort
      : 'createdAt',
  direction: search.direction === 'asc' ? 'asc' : 'desc',
  page:
    typeof search.page === 'number' && search.page > 0 ? search.page : undefined,
});

export const Route = createFileRoute('/history/')({
  validateSearch: sanitizeSearch,
  component: HistoryRoute,
});

function HistoryRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [keyword, setKeyword] = useState(search.q ?? '');
  const page = search.page ?? 1;
  const limit = 10;

  const queryParams = useMemo(
    () => ({
      limit,
      offset: (page - 1) * limit,
      search: search.q || undefined,
      mode: search.mode !== 'all' ? search.mode : undefined,
      status: search.status !== 'all' ? search.status : undefined,
      sort: search.sort ?? 'createdAt',
      direction: search.direction ?? 'desc',
    }),
    [search, page, limit]
  );

  const scansQuery = useQuery(getScansQueryOptions(queryParams));
  const deleteMutation = useDeleteScanMutation();

  const totalPages = useMemo(() => {
    const total = scansQuery.data?.pagination.total ?? 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [scansQuery.data?.pagination.total, limit]);

  const updateSearch = (updates: Partial<HistorySearch>) => {
    const nextSearch: HistorySearch = {
      ...search,
      ...updates,
    };
    navigate({
      to: '/history',
      search: nextSearch,
    });
  };

  const jobs = scansQuery.data?.jobs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">检测历史</h1>
          <p className="text-sm text-muted-foreground">
            查看所有扫描任务的历史记录与详细报告。
          </p>
        </div>
        <form
          className="relative w-full md:w-72"
          onSubmit={(event) => {
            event.preventDefault();
            updateSearch({ q: keyword, page: 1 });
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 URL..."
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </form>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:grid-cols-4">
        <SelectField
          label="扫描模式"
          value={search.mode ?? 'all'}
          onChange={(value) => updateSearch({ mode: value as HistorySearch['mode'], page: 1 })}
          options={[
            { value: 'all', label: '全部模式' },
            { value: 'single', label: '单页扫描' },
            { value: 'site', label: '整站爬取' },
          ]}
        />
        <SelectField
          label="任务状态"
          value={search.status ?? 'all'}
          onChange={(value) =>
            updateSearch({ status: value as HistorySearch['status'], page: 1 })
          }
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'pending', label: '等待中' },
            { value: 'running', label: '进行中' },
            { value: 'completed', label: '已完成' },
            { value: 'failed', label: '失败' },
          ]}
        />
        <SelectField
          label="排序依据"
          value={search.sort ?? 'createdAt'}
          onChange={(value) =>
            updateSearch({ sort: value as ListSort, page: 1 })
          }
          options={[
            { value: 'createdAt', label: '创建时间' },
            { value: 'startedAt', label: '开始时间' },
            { value: 'completedAt', label: '完成时间' },
            { value: 'pagesTotal', label: '总页数' },
            { value: 'pagesFinished', label: '已完成页数' },
          ]}
        />
        <SelectField
          label="排序方式"
          value={search.direction ?? 'desc'}
          onChange={(value) =>
            updateSearch({ direction: value as 'asc' | 'desc', page: 1 })
          }
          options={[
            { value: 'desc', label: '降序' },
            { value: 'asc', label: '升序' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="hidden border-b border-border bg-muted/40 px-6 py-3 text-xs font-medium uppercase text-muted-foreground md:grid md:grid-cols-[2fr_1fr_1fr_1fr_100px]">
          <span>任务信息</span>
          <span>状态 / 模式</span>
          <span>进度 / 耗时</span>
          <span>健康度指标</span>
          <span className="text-right">操作</span>
        </div>

        {scansQuery.isPending ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="mt-2 text-sm">正在加载记录...</p>
          </div>
        ) : null}

        {scansQuery.isError ? (
          <div className="py-12 text-center text-sm text-rose-500">
            加载失败：{(scansQuery.error as Error).message}
          </div>
        ) : null}

        <div className="divide-y divide-border">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="group grid gap-4 px-6 py-4 text-sm transition-colors hover:bg-muted/30 md:grid-cols-[2fr_1fr_1fr_1fr_100px]"
            >
              <div className="flex flex-col justify-center gap-1">
                <Link
                  to="/history/$scanId"
                  params={{ scanId: job.id.toString() }}
                  className="font-semibold text-foreground hover:text-indigo-600 hover:underline"
                >
                  {job.targetUrl}
                </Link>
                <p className="text-xs text-muted-foreground">
                  创建于 {formatDateTime(job.createdAt)}
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex">
                  <ModeBadge mode={job.mode} />
                </div>
              </div>

              <div className="flex flex-col justify-center gap-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  {job.pagesFinished} / {job.pagesTotal ?? '-'} 页
                </p>
                <p>
                  {job.startedAt && job.completedAt
                    ? `${formatDateTime(job.startedAt).split(' ')[1]} - ${formatDateTime(job.completedAt).split(' ')[1]}`
                    : '未完成'}
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <SummaryMetrics summary={job.issuesSummary} />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Link
                  to="/history/$scanId"
                  params={{ scanId: job.id.toString() }}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                  title="查看详情"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  disabled={job.status === 'running' || job.status === 'pending'}
                  onClick={() => deleteMutation.mutate(job.id)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                  title="删除记录"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {jobs.length === 0 && !scansQuery.isPending ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">没有找到相关记录</p>
            <p className="text-xs text-muted-foreground">尝试调整搜索条件或清除筛选</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          显示 {jobs.length} 条 · 共 {scansQuery.data?.pagination.total ?? 0} 条
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> 上一页
          </button>
          <span className="flex items-center px-2 text-sm font-medium text-foreground">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              updateSearch({ page: Math.min(totalPages, page + 1) })
            }
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页 <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

const SelectField = ({ label, value, onChange, options }: SelectFieldProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      <Filter className="h-3 w-3" /> {label}
    </span>
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-50" />
    </div>
  </label>
);

const SummaryMetrics = ({
  summary,
}: {
  summary: ScanJob['issuesSummary'];
}) => {
  const data = summary as ScanIssuesSummary | null;
  if (!data) {
    return <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">等待结果</span>;
  }

  const health = data.scorecard.overallHealthPercent;
  const colorClass = health >= 90 ? "text-emerald-600 bg-emerald-50" : health >= 70 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", colorClass)}>
          {formatPercentage(health)}
        </span>
        <span className="text-xs text-muted-foreground">综合评分</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>SEO: <span className="font-medium text-foreground">{data.scorecard.seoAverageScore}</span></span>
        <span>UTM: <span className="font-medium text-foreground">{formatPercentage(data.scorecard.utmCoveragePercent)}</span></span>
      </div>
    </div>
  );
};
