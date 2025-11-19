import { getScanPageDetailQueryOptions } from '@/lib/api/scans';
import {
  formatDateTime,
  formatDuration,
  formatPercentage,
} from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ScanPageWithMetrics } from '@shared/types';

export const Route = createFileRoute('/history/$scanId/pages/$pageId')({
  component: PageDetailRoute,
});

function PageDetailRoute() {
  const params = Route.useParams();
  const scanId = Number(params.scanId);
  const pageId = Number(params.pageId);

  const pageQuery = useQuery(
    getScanPageDetailQueryOptions(scanId, pageId)
  );

  const page = pageQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <Link
          to="/history/$scanId"
          params={{ scanId: params.scanId }}
          className="font-medium text-slate-500 hover:text-slate-700"
        >
          ← 返回任务详情
        </Link>
        <Link
          to="/history"
          className="font-medium text-slate-500 hover:text-slate-700"
        >
          历史列表
        </Link>
      </div>

      {page ? (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="space-y-2">
            <p className="text-xs uppercase text-slate-400">页面 #{page.id}</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {page.url}
            </h1>
            <p className="text-sm text-slate-500">
              {formatDateTime(page.createdAt)} · 状态 {page.status} · HTTP{' '}
              {page.httpStatus ?? '--'}
            </p>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  .writeText(JSON.stringify(page, null, 2))
                  .catch(() => {})
              }
              className="text-xs font-medium text-slate-500 underline-offset-4 hover:underline"
            >
              复制 JSON
            </button>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <Card title="SEO 元信息">
              <dl className="space-y-3 text-sm">
                <Field label="Title" value={page.seo?.title} />
                <Field label="Description" value={page.seo?.metaDescription} />
                <Field label="H1" value={page.seo?.h1} />
                <Field label="Canonical" value={page.seo?.canonical} />
                <Field
                  label="Robots"
                  value={page.seo?.robotsTxtBlocked ? 'noindex' : '允许收录'}
                />
                <Field
                  label="得分"
                  value={
                    page.seo?.score !== null && page.seo?.score !== undefined
                      ? `${page.seo.score}`
                      : '--'
                  }
                />
              </dl>
            </Card>
            <Card title="链接与 UTM">
              <dl className="space-y-3 text-sm">
                <Field
                  label="内部链接"
                  value={page.links?.internalLinks ?? 0}
                />
                <Field
                  label="外部链接"
                  value={page.links?.externalLinks ?? 0}
                />
                <Field
                  label="UTM 覆盖"
                  value={formatPercentage(calculateCoverage(page.links?.utmSummary))}
                />
                <Field
                  label="跳转 / 异常"
                  value={`${page.links?.redirects ?? 0} / ${
                    page.links?.brokenLinks ?? 0
                  }`}
                />
              </dl>
            </Card>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h2 className="text-base font-semibold text-slate-900">
              埋点事件 ({page.trackingEvents.length})
            </h2>
            {page.trackingEvents.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm">
                {page.trackingEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-slate-600"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {event.platform?.toUpperCase()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {event.element} · {event.trigger}
                      </p>
                    </div>
                    <span className="text-xs text-emerald-600">
                      {event.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">未检测到埋点脚本。</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-base font-semibold text-slate-900">
              性能与问题统计
            </h2>
            <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-3">
              <p>加载耗时：{formatDuration(page.loadTimeMs)}</p>
              <p>SEO 问题数量：{page.issueCounts?.totals.seoIssues ?? 0}</p>
              <p>UTM 缺失链接：{page.links?.utmSummary?.missingUtm ?? 0}</p>
            </div>
          </section>
        </div>
      ) : pageQuery.isPending ? (
        <p className="text-sm text-slate-500">加载页面详情中…</p>
      ) : (
        <p className="text-sm text-rose-500">未找到此页面记录。</p>
      )}
    </div>
  );
}

const Card = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <div className="mt-4">{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: unknown }) => (
  <div>
    <p className="text-xs uppercase text-slate-400">{label}</p>
    <p className="text-sm text-slate-900">
      {value !== undefined && value !== null && value !== ''
        ? String(value)
        : '--'}
    </p>
  </div>
);

type UtmSummary = NonNullable<ScanPageWithMetrics['links']>['utmSummary'];

const calculateCoverage = (utmSummary?: UtmSummary | null) => {
  if (!utmSummary) return undefined;
  const total = (utmSummary.trackedLinks ?? 0) + (utmSummary.missingUtm ?? 0);
  if (total === 0) return undefined;
  return Math.round(((utmSummary.trackedLinks ?? 0) / total) * 100);
};
