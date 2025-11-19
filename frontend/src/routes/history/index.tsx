import { ModeBadge, StatusBadge } from '@/components/scan-badges';
import {
  getScansQueryOptions,
  useDeleteScanMutation,
} from '@/lib/api/scans';
import { formatDateTime, formatPercentage } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { ScanIssuesSummary, ScanJob } from '@shared/types';

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">检测历史</h1>
          <p className="text-sm text-slate-500">
            支持搜索、过滤、排序，点击记录查看详情。
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateSearch({ q: keyword, page: 1 });
          }}
        >
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 URL 关键字"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            搜索
          </button>
        </form>
      </header>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <SelectField
          label="模式"
          value={search.mode ?? 'all'}
          onChange={(value) => updateSearch({ mode: value as HistorySearch['mode'], page: 1 })}
          options={[
            { value: 'all', label: '全部' },
            { value: 'single', label: '单页' },
            { value: 'site', label: '整站' },
          ]}
        />
        <SelectField
          label="状态"
          value={search.status ?? 'all'}
          onChange={(value) =>
            updateSearch({ status: value as HistorySearch['status'], page: 1 })
          }
          options={[
            { value: 'all', label: '全部' },
            { value: 'pending', label: '待开始' },
            { value: 'running', label: '进行中' },
            { value: 'completed', label: '已完成' },
            { value: 'failed', label: '失败' },
          ]}
        />
        <SelectField
          label="排序字段"
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
          label="排序方向"
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_80px]">
          <span>URL</span>
          <span>模式 / 状态</span>
          <span>页数</span>
          <span>指标</span>
          <span />
        </div>
        {scansQuery.isPending ? (
          <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
        ) : null}
        {scansQuery.isError ? (
          <p className="p-6 text-center text-sm text-rose-500">
            加载失败：{(scansQuery.error as Error).message}
          </p>
        ) : null}
        {jobs.map((job) => (
          <article
            key={job.id}
            className="grid gap-3 border-t border-slate-100 px-4 py-4 text-sm md:grid-cols-[2fr_1fr_1fr_1fr_80px]"
          >
            <div className="space-y-1">
              <Link
                to="/history/$scanId"
                params={{ scanId: job.id.toString() }}
                className="font-semibold text-slate-900 hover:underline"
              >
                {job.targetUrl}
              </Link>
              <p className="text-xs text-slate-500">
                {formatDateTime(job.createdAt)}
              </p>
            </div>
            <div className="flex flex-col gap-1 text-xs text-slate-500">
              <ModeBadge mode={job.mode} />
              <StatusBadge status={job.status} />
            </div>
            <div className="text-xs text-slate-600">
              <p>
                {job.pagesFinished}/{job.pagesTotal} 页
              </p>
              <p>
                用时：{job.startedAt && job.completedAt
                  ? `${formatDateTime(job.startedAt)} → ${formatDateTime(job.completedAt)}`
                  : '—'}
              </p>
            </div>
            <SummaryMetrics summary={job.issuesSummary} />
            <div className="flex items-center justify-end gap-2 text-xs">
              <Link
                to="/history/$scanId"
                params={{ scanId: job.id.toString() }}
                className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-600 hover:border-sky-200 hover:text-sky-600"
              >
                查看
              </Link>
              <button
                type="button"
                disabled={job.status === 'running' || job.status === 'pending'}
                onClick={() => deleteMutation.mutate(job.id)}
                className="rounded-full border border-rose-200 px-3 py-1 font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                删除
              </button>
            </div>
          </article>
        ))}
        {jobs.length === 0 && !scansQuery.isPending ? (
          <p className="p-6 text-center text-sm text-slate-500">
            没有符合条件的记录。
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>
          共 {scansQuery.data?.pagination.total ?? 0} 条 · 第 {page} /{' '}
          {totalPages} 页
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
  <label className="text-xs font-medium text-slate-500">
    {label}
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const SummaryMetrics = ({
  summary,
}: {
  summary: ScanJob['issuesSummary'];
}) => {
  const data = summary as ScanIssuesSummary | null;
  if (!data) {
    return <p className="text-xs text-slate-600">任务尚未完成</p>;
  }

  return (
    <div className="text-xs text-slate-600">
      <p>综合： {formatPercentage(data.scorecard.overallHealthPercent)}</p>
      <p>
        SEO：{data.scorecard.seoAverageScore} · UTM：
        {formatPercentage(data.scorecard.utmCoveragePercent)}
      </p>
    </div>
  );
};
