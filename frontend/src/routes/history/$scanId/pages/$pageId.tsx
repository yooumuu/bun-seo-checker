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
                  label="UTM 已标记链接数"
                  value={page.links?.utmSummary?.trackedLinks ?? 0}
                />
                <Field
                  label="缺失 UTM 的内部链接"
                  value={page.links?.utmSummary?.missingUtm ?? 0}
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
                    className="rounded-lg bg-white/70 px-3 py-2 text-slate-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {event.eventName || event.platform?.toUpperCase()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {event.platform?.toUpperCase()} ·{' '}
                          {event.trigger || 'script'}
                        </p>
                      </div>
                      <span className="text-xs text-emerald-600">
                        {event.status}
                      </span>
                    </div>
                    {event.element ? (
                      <p className="mt-1 text-xs text-slate-500">
                        来源：{event.element}
                      </p>
                    ) : null}
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

          <section className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-base font-semibold text-slate-900">
              UTM 链接清单
            </h2>
            <UtmLinkTable summary={page.links?.utmSummary} />
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

type UtmSummary = NonNullable<
  NonNullable<ScanPageWithMetrics['links']>['utmSummary']
>;

const deviceVariantLabels: Record<string, string> = {
  desktop: '桌面',
  tablet: '平板',
  mobile: '移动',
};

const formatDeviceVariant = (variant?: string | null) => {
  if (!variant) return '未识别';
  return deviceVariantLabels[variant] ?? variant;
};

const UtmLinkTable = ({
  summary,
}: {
  summary?: UtmSummary | null;
}) => {
  const examples = summary?.examples ?? [];
  if (examples.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        未检测到携带 UTM 参数的内部链接。
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">链接</th>
            <th className="px-3 py-2">所在标题</th>
            <th className="px-3 py-2">设备</th>
            <th className="px-3 py-2">UTM 参数</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {examples.map((example) => (
            <tr key={example.url}>
              <td className="px-3 py-2 align-top text-slate-900">
                <a
                  href={example.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words text-sky-600 hover:underline"
                >
                  {example.url}
                </a>
              </td>
              <td className="px-3 py-2 text-slate-600">
                {example.heading?.text
                  ? `${example.heading.tag?.toUpperCase() ?? ''} ${
                      example.heading.text
                    }`.trim()
                  : '未定位'}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {formatDeviceVariant(example.deviceVariant)}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {example.params.length > 0
                  ? example.params.join(', ')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        共记录 {examples.length} 条（按扫描顺序）。
      </p>
    </div>
  );
};

const calculateCoverage = (utmSummary?: UtmSummary | null) => {
  if (!utmSummary) return undefined;
  const total = (utmSummary.trackedLinks ?? 0) + (utmSummary.missingUtm ?? 0);
  if (total === 0) return undefined;
  return Math.round(((utmSummary.trackedLinks ?? 0) / total) * 100);
};
