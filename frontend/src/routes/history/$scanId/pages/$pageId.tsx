import { getScanPageDetailQueryOptions } from '@/lib/api/scans';
import {
  formatDateTime,
  formatDuration,
  formatPercentage,
} from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Monitor,
  Smartphone,
  Tablet,
  Terminal,
  Timer,
  Zap,
} from 'lucide-react';
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
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          to="/history/$scanId"
          params={{ scanId: params.scanId }}
          className="flex items-center gap-1 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回任务详情
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-900">页面详情</span>
      </div>

      {page ? (
        <div className="space-y-8">
          {/* Header */}
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 break-all">
                    {page.url}
                  </h1>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${page.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                    page.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                      'bg-sky-50 text-sky-700'
                    }`}>
                    {page.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(page.createdAt)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    HTTP {page.httpStatus ?? '--'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    加载耗时 {formatDuration(page.loadTimeMs)}
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(JSON.stringify(page, null, 2))
                    .catch(() => { })
                }
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                复制 JSON
              </button>
            </div>
          </header>

          {/* Metrics Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* SEO Card */}
            <Card title="SEO 元信息" icon={<Globe className="h-4 w-4 text-sky-500" />}>
              <dl className="space-y-4">
                <Field label="Title" value={page.seo?.title} />
                <Field label="Description" value={page.seo?.metaDescription} />
                <Field label="H1" value={page.seo?.h1} />
                <Field label="Canonical" value={page.seo?.canonical} />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Robots"
                    value={page.seo?.robotsTxtBlocked ? 'Blocked' : 'Allowed'}
                    highlight={page.seo?.robotsTxtBlocked ? 'text-rose-600' : 'text-emerald-600'}
                  />
                  <Field
                    label="SEO 得分"
                    value={page.seo?.score ?? '--'}
                    highlight="text-indigo-600 font-semibold"
                  />
                </div>
              </dl>
            </Card>

            {/* Links Card */}
            <Card title="链接统计" icon={<Link2 className="h-4 w-4 text-indigo-500" />}>
              <dl className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="内部链接" value={page.links?.internalLinks ?? 0} />
                  <Field label="外部链接" value={page.links?.externalLinks ?? 0} />
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">UTM 覆盖率</span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatPercentage(calculateCoverage(page.links?.utmSummary))}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${calculateCoverage(page.links?.utmSummary) ?? 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{page.links?.utmSummary?.trackedLinks ?? 0} 已标记</span>
                    <span>{page.links?.utmSummary?.missingUtm ?? 0} 未标记</span>
                  </div>
                </div>
                <Field
                  label="跳转 / 异常"
                  value={`${page.links?.redirects ?? 0} / ${page.links?.brokenLinks ?? 0}`}
                  highlight={page.links?.brokenLinks ? 'text-rose-600' : undefined}
                />
              </dl>
            </Card>

            {/* Issues Card */}
            <Card title="问题与性能" icon={<AlertCircle className="h-4 w-4 text-amber-500" />}>
              <dl className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <span className="text-sm text-slate-600">SEO 问题</span>
                  <span className="text-lg font-semibold text-rose-600">
                    {page.issueCounts?.totals.seoIssues ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <span className="text-sm text-slate-600">UTM 缺失</span>
                  <span className="text-lg font-semibold text-amber-600">
                    {page.links?.utmSummary?.missingUtm ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <span className="text-sm text-slate-600">加载耗时</span>
                  <span className={`text-lg font-semibold ${(page?.loadTimeMs ?? 0) > 2000 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                    {formatDuration(page.loadTimeMs)}
                  </span>
                </div>
              </dl>
            </Card>
          </div>

          {/* UTM Link Table */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">UTM 链接清单</h2>
            </div>
            <UtmLinkTable summary={page.links?.utmSummary} />
          </section>

          {/* Tracking Events */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900">埋点事件</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {page.trackingEvents.length}
                </span>
              </div>
            </div>
            {page.trackingEvents.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {page.trackingEvents.map((event) => (
                  <div key={event.id} className="flex flex-col gap-3 px-6 py-4 hover:bg-slate-50 transition-colors sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4 overflow-hidden w-full">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mt-0.5">
                        <Code2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="uppercase font-bold text-slate-700">{event.platform}</span>
                          <span>·</span>
                          <span>{event.trigger || 'script'}</span>
                          {event.element && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-400 truncate max-w-[200px]" title={event.element}>
                                {event.element}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-slate-700 leading-relaxed">
                            {tryFormatJson(event.eventName) || event.eventName || 'Unknown Event'}
                          </pre>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:ml-4 pl-12 sm:pl-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">
                        {event.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                未检测到埋点脚本
              </div>
            )}
          </section>
        </div>
      ) : pageQuery.isPending ? (
        <div className="flex h-64 items-center justify-center text-sm text-slate-500">
          加载页面详情中...
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-rose-500">
          未找到此页面记录
        </div>
      )}
    </div>
  );
}

const Card = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-full">
    <div className="mb-4 flex items-center gap-2 border-b border-slate-50 pb-3">
      {icon}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    {children}
  </div>
);

const Field = ({
  label,
  value,
  highlight
}: {
  label: string;
  value: unknown;
  highlight?: string;
}) => (
  <div>
    <p className="text-xs font-medium uppercase text-slate-400 mb-1">{label}</p>
    <p className={`text-sm text-slate-900 break-words ${highlight || ''}`}>
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

const getDeviceIcon = (variant?: string | null) => {
  switch (variant) {
    case 'mobile': return <Smartphone className="h-3 w-3" />;
    case 'tablet': return <Tablet className="h-3 w-3" />;
    default: return <Monitor className="h-3 w-3" />;
  }
};

const UtmLinkTable = ({
  summary,
}: {
  summary?: UtmSummary | null;
}) => {
  const examples = summary?.examples ?? [];
  if (examples.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        未检测到相关链接
      </div>
    );
  }

  const formatSelector = (selector: string) => {
    const parts = selector.split(' > ');
    if (parts.length > 2) {
      return `... > ${parts.slice(-2).join(' > ')}`;
    }
    return selector;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-6 py-3 w-[40%]">链接 / 文本</th>
            <th className="px-6 py-3 w-[25%]">位置定位</th>
            <th className="px-6 py-3 w-[10%]">设备</th>
            <th className="px-6 py-3 w-[25%]">状态 / 参数</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {examples.map((example, idx) => {
            const isTracked = example.params.length > 0;
            return (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 align-top">
                  <div className="space-y-1.5">
                    <p className="font-medium text-slate-900 break-words line-clamp-2" title={example.text ?? undefined}>
                      {example.text || (
                        <span className="italic text-slate-400">无文本</span>
                      )}
                    </p>
                    <a
                      href={example.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 truncate"
                      title={example.url}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{example.url}</span>
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="space-y-2">
                    {example.heading?.text && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                          {example.heading.tag || 'H?'}
                        </span>
                        <span className="font-medium truncate" title={example.heading.text}>
                          {example.heading.text}
                        </span>
                      </div>
                    )}
                    {example.selector && (
                      <div className="group relative">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Terminal className="h-3 w-3 shrink-0" />
                          <code className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 truncate" title={example.selector}>
                            {formatSelector(example.selector)}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    {getDeviceIcon(example.deviceVariant)}
                    <span className="hidden sm:inline">{formatDeviceVariant(example.deviceVariant)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${isTracked
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isTracked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {isTracked ? '已标记' : '未标记'}
                      </span>
                    </div>
                    {isTracked && (
                      <div className="flex flex-wrap gap-1.5">
                        {example.params.map(param => (
                          <span key={param} className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {param}
                          </span>
                        ))}
                      </div>
                    )}
                    {example.triggeredEvents && example.triggeredEvents.length > 0 && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          {Array.from(new Set(example.triggeredEvents.map(e => e.platform))).map(platform => (
                            <span
                              key={platform}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${platform === 'mixpanel'
                                  ? 'bg-purple-100 text-purple-700'
                                  : platform === 'dataLayer'
                                    ? 'bg-blue-100 text-blue-700'
                                    : platform === 'gtag'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-orange-100 text-orange-700'
                                }`}
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-500">
        共记录 {examples.length} 条链接
      </div>
    </div>
  );
};

const tryFormatJson = (str?: string | null) => {
  if (!str) return '';
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
};

const calculateCoverage = (utmSummary?: UtmSummary | null) => {
  if (!utmSummary) return undefined;
  const total = (utmSummary.trackedLinks ?? 0) + (utmSummary.missingUtm ?? 0);
  if (total === 0) return undefined;
  return Math.round(((utmSummary.trackedLinks ?? 0) / total) * 100);
};
