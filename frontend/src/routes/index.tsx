import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm, useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getScansQueryOptions,
  useCreateScanMutation,
} from '@/lib/api/scans';
import type { ScanIssuesSummary, ScanJob } from '@shared/types';
import { cn, formatDateTime } from '@/lib/utils';
import { ModeBadge, StatusBadge } from '@/components/scan-badges';

type FormValues = {
  targetUrl: string;
  mode: ScanJob['mode'];
  options: {
    siteDepth?: number;
    maxPages?: number;
    userAgent?: string;
    requestTimeoutMs?: number;
  };
};

export const Route = createFileRoute('/')({
  component: HomeRoute,
});

function HomeRoute() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const createMutation = useCreateScanMutation();
  const recentScans = useQuery(
    getScansQueryOptions({ limit: 5, sort: 'createdAt', direction: 'desc' })
  );

  const form = useForm<
    FormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  >({
    defaultValues: {
      targetUrl: '',
      mode: 'single',
      options: {
        siteDepth: 2,
        maxPages: 150,
        userAgent: '',
        requestTimeoutMs: 15000,
      },
    },
    onSubmit: async ({ value }) => {
      const { targetUrl, mode, options } = value;
      const normalizedOptions = Object.fromEntries(
        Object.entries(options).filter(
          ([, v]) => v !== undefined && v !== null && v !== ''
        )
      );
      await createMutation.mutateAsync({
        targetUrl,
        mode,
        options:
          Object.keys(normalizedOptions).length > 0
            ? (normalizedOptions as FormValues['options'])
            : undefined,
      });
      form.reset();
    },
  });

  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const modeValue = useStore(form.store, (state) => state.values.mode);

  return (
    <div className="space-y-10">
      <section className="grid gap-8 rounded-2xl bg-white p-8 shadow-sm lg:grid-cols-2">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
            全栈 SEO / 埋点巡检
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            输入网址，几秒钟内了解 SEO、UTM、埋点状态
          </h1>
          <p className="text-base text-slate-600">
            支持单页和整站模式，实时查看扫描进度，保留历史记录。可配置抓取深度、
            最大页面数、User-Agent 等高级参数。
          </p>
          <ul className="space-y-3 text-sm text-slate-700">
            <li>• 并发任务限制自动控制，后台持续执行</li>
            <li>• 自动解析标题、描述、UTM 链接和埋点脚本</li>
            <li>• 历史详情支持搜索、排序、筛选和导出</li>
          </ul>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 shadow-inner"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                目标 URL
              </label>
              <form.Field
                name="targetUrl"
                validators={{
                  onChange: ({ value }) =>
                    value && value.startsWith('http')
                      ? undefined
                      : '请输入合法的 URL（包含 http/https）',
                }}
              >
                {(field) => (
                  <>
                    <input
                      type="url"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="https://example.com"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    {field.state.meta.errors[0] ? (
                      <p className="mt-1 text-xs text-rose-600">
                        {field.state.meta.errors[0]}
                      </p>
                    ) : null}
                  </>
                )}
              </form.Field>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">扫描模式</p>
              <div className="mt-2 flex gap-2">
                {(['single', 'site'] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => form.setFieldValue('mode', mode)}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition',
                      modeValue === mode
                        ? 'border-sky-500 bg-white text-sky-600 shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {mode === 'single' ? '单页' : '整站'}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="flex w-full items-center justify-between text-sm font-medium text-slate-600"
              >
                <span>高级设置</span>
                <span>{showAdvanced ? '收起' : '展开'}</span>
              </button>
              {showAdvanced ? (
                <div className="mt-4 space-y-4 text-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <form.Field name="options.siteDepth">
                      {(field) => (
                        <label className="flex flex-col gap-1 text-slate-600">
                          整站深度
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={field.state.value ?? 2}
                            onChange={(event) =>
                              field.handleChange(
                                Number(event.target.value) || undefined
                              )
                            }
                            disabled={modeValue === 'single'}
                            className="rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </label>
                      )}
                    </form.Field>
                    <form.Field name="options.maxPages">
                      {(field) => (
                        <label className="flex flex-col gap-1 text-slate-600">
                          最大页数
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={field.state.value ?? 150}
                            onChange={(event) =>
                              field.handleChange(
                                Number(event.target.value) || undefined
                              )
                            }
                            disabled={modeValue === 'single'}
                            className="rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </label>
                      )}
                    </form.Field>
                  </div>
                  <form.Field name="options.userAgent">
                    {(field) => (
                      <label className="flex flex-col gap-1 text-slate-600">
                        自定义 User-Agent
                        <input
                          type="text"
                          value={field.state.value ?? ''}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="可选，例如 Chrome/120..."
                          className="rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>
                    )}
                  </form.Field>
                  <form.Field name="options.requestTimeoutMs">
                    {(field) => (
                      <label className="flex flex-col gap-1 text-slate-600">
                        请求超时 (ms)
                        <input
                          type="number"
                          min={2000}
                          max={60000}
                          value={field.state.value ?? 15000}
                          onChange={(event) =>
                            field.handleChange(
                              Number(event.target.value) || undefined
                            )
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>
                    )}
                  </form.Field>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {createMutation.isPending ? '排队中…' : '开始检测'}
            </button>
            {createMutation.isSuccess ? (
              <p className="text-xs text-emerald-600">
                任务已进入队列，稍后查看历史列表或右下角浮窗。
              </p>
            ) : null}
            {createMutation.isError ? (
              <p className="text-xs text-rose-600">
                创建任务失败：{createMutation.error?.message}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">最近扫描</h2>
          <Link to="/history" className="text-sm font-medium text-sky-600">
            查看全部 →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {recentScans.data?.jobs.map((job) => {
            const summary = job.issuesSummary as ScanIssuesSummary | null;
            return (
            <Link
              key={job.id}
              to="/history/$scanId"
              params={{ scanId: job.id.toString() }}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {job.targetUrl}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(job.createdAt)}
                  </p>
                </div>
                <ModeBadge mode={job.mode} />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <StatusBadge status={job.status} />
                <p>
                  {job.pagesFinished}/{job.pagesTotal} 页
                </p>
              </div>
              {summary ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p>
                    综合评分：{' '}
                    <span className="font-semibold text-slate-900">
                      {summary.scorecard.overallHealthPercent}%
                    </span>
                  </p>
                  <p>
                    SEO 平均分：{summary.scorecard.seoAverageScore} ·
                    UTM 覆盖：{summary.scorecard.utmCoveragePercent}%
                  </p>
                </div>
              ) : null}
            </Link>
          );})}
          {recentScans.data?.jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              暂无历史记录，创建第一个扫描任务吧。
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
