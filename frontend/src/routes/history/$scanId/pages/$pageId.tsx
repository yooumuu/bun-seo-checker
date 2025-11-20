import { getScanPageDetailQueryOptions } from '@/lib/api/scans';
import { formatDateTime, formatDuration, formatPercentage } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FileCode,
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
import { useState, useMemo } from 'react';
import {
  ElementFilter,
  type FilterableElement,
} from '@/components/element-filter';

// JSON-LD Schema type definitions
type JsonLdSchema = {
  type: string;
  score?: number;
  status?: 'valid' | 'warning' | 'error';
  errors?: string[];
  warnings?: string[];
  requiredFields?: Record<string, boolean>;
  recommendedFields?: Record<string, boolean>;
  issues?: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  properties?: Record<string, unknown>;
};

// HTML Structure types
type HeadingHierarchy = {
  level: number;
  text: string;
  issues?: string[];
};

type ImageExample = {
  src: string;
  alt?: string;
  hasAlt: boolean;
  width?: number;
  height?: number;
  issues?: string[];
};

// 辅助函数：从完整选择器中提取根选择器（智能识别有意义的区域）
function getRootSelector(selector: string): string {
  if (!selector) return '';

  const parts = selector.split(' > ').filter(Boolean);
  if (parts.length === 0) return selector;

  // 语义化标签列表（这些标签通常代表页面区域）
  const semanticTags = [
    'header',
    'footer',
    'nav',
    'aside',
    'main',
    'article',
    'section',
  ];

  // 有意义的类名关键词
  const meaningfulClassKeywords = [
    'header',
    'footer',
    'nav',
    'navigation',
    'menu',
    'sidebar',
    'aside',
    'main',
    'content',
    'article',
    'hero',
    'banner',
    'container',
    'wrapper',
    'layout',
    'page',
    'section',
  ];

  // 策略1：找到第一个语义化标签
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].replace(/:\w+.*$/, ''); // 移除伪类
    const tagName = part.split('.')[0].split('#')[0].toLowerCase();

    if (semanticTags.includes(tagName)) {
      // 返回语义化标签及其类名（如果有）
      return part;
    }
  }

  // 策略2：找到第一个有意义的类名
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].replace(/:\w+.*$/, '');
    const classes = part.match(/\.([a-zA-Z0-9_-]+)/g);

    if (classes) {
      for (const cls of classes) {
        const className = cls.substring(1).toLowerCase();
        for (const keyword of meaningfulClassKeywords) {
          if (className.includes(keyword)) {
            // 返回标签+有意义的类名
            return part;
          }
        }
      }
    }
  }

  // 策略3：如果都是通用标签（div/span），按类名特征分组
  // 尝试找到第一个带有特定前缀的类名（框架生成的）
  for (let i = 0; i < Math.min(3, parts.length); i++) {
    const part = parts[i].replace(/:\w+.*$/, '');
    const classes = part.match(/\.([a-zA-Z0-9_-]+)/g);

    if (classes && classes.length > 0) {
      // 返回第一个带类名的元素
      return part;
    }
  }

  // 策略4：实在找不到，返回前两层
  const fallback = parts
    .slice(0, Math.min(2, parts.length))
    .map((part) => part.replace(/:\w+.*$/, ''))
    .join(' > ');

  return fallback;
}

// 辅助函数：根据选择器生成友好的标签
function getSelectorLabel(selector: string): string {
  const cleanSelector = selector.replace(/:\w+.*$/, '');

  // 提取标签名和类名
  const tagMatch = cleanSelector.match(/^([a-zA-Z0-9]+)/);
  const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';

  // 提取第一个类名
  const classMatch = cleanSelector.match(/\.([a-zA-Z0-9_-]+)/);
  const className = classMatch ? classMatch[1] : '';

  // 标签名映射
  const tagLabelMap: Record<string, string> = {
    header: '页头',
    footer: '页脚',
    nav: '导航',
    aside: '侧边栏',
    main: '主内容',
    article: '文章',
    section: '区块',
  };

  // 类名关键词映射
  const classKeywordMap: Record<string, string> = {
    header: '页头',
    footer: '页脚',
    nav: '导航',
    navigation: '导航',
    menu: '菜单',
    sidebar: '侧边栏',
    aside: '侧边栏',
    main: '主内容',
    content: '内容',
    article: '文章',
    hero: '横幅',
    banner: '顶部横幅',
    container: '容器',
    wrapper: '包装器',
    layout: '布局',
  };

  // 优先级1：语义化标签
  if (tagLabelMap[tagName]) {
    if (className) {
      // 如果有类名，组合显示
      const friendlyClass = formatClassName(className);
      return `${tagLabelMap[tagName]} (${friendlyClass})`;
    }
    return tagLabelMap[tagName];
  }

  // 优先级2：有意义的类名
  if (className) {
    const lowerClass = className.toLowerCase();
    for (const [keyword, label] of Object.entries(classKeywordMap)) {
      if (lowerClass.includes(keyword)) {
        return `${label} (${formatClassName(className)})`;
      }
    }

    // 返回格式化的类名
    return formatClassName(className);
  }

  // 优先级3：通用标签名
  if (tagName) {
    return `<${tagName}>`;
  }

  // 最后返回原始选择器
  return cleanSelector;
}

// 格式化类名为可读文本
function formatClassName(className: string): string {
  // 处理常见的框架类名模式
  // 例如：framer-6v6ez -> Framer 组件
  if (className.match(/^[a-z]+-[a-z0-9]{5,}$/i)) {
    const parts = className.split('-');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' 组件';
  }

  // 处理 BEM 命名
  if (className.includes('__')) {
    const [block, element] = className.split('__');
    return `${block} 的 ${element}`;
  }

  // 处理中划线命名
  if (className.includes('-')) {
    return className
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // 处理驼峰命名
  if (className.match(/[a-z][A-Z]/)) {
    return className
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // 直接返回，首字母大写
  return className.charAt(0).toUpperCase() + className.slice(1);
}

// 辅助函数：根据选择器确定分类
function getSelectorCategory(
  selector: string
): 'layout' | 'content' | 'navigation' {
  const lower = selector.toLowerCase();

  // 导航相关
  if (
    lower.includes('nav') ||
    lower.includes('menu') ||
    lower.includes('breadcrumb')
  ) {
    return 'navigation';
  }

  // 布局相关
  if (
    lower.includes('header') ||
    lower.includes('footer') ||
    lower.includes('sidebar') ||
    lower.includes('aside')
  ) {
    return 'layout';
  }

  // 内容相关
  if (
    lower.includes('main') ||
    lower.includes('article') ||
    lower.includes('content') ||
    lower.includes('section')
  ) {
    return 'content';
  }

  // 默认分类为内容
  return 'content';
}

export const Route = createFileRoute('/history/$scanId/pages/$pageId')({
  component: PageDetailRoute,
});

function PageDetailRoute() {
  const params = Route.useParams();
  const scanId = Number(params.scanId);
  const pageId = Number(params.pageId);

  const pageQuery = useQuery(getScanPageDetailQueryOptions(scanId, pageId));

  const page = pageQuery.data;

  // 可折叠状态管理
  const [openSections, setOpenSections] = useState({
    metrics: true,
    htmlStructure: true,
    utmLinks: true,
    trackingEvents: true,
    elementFilter: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // 元素过滤状态
  const [hiddenSelectors, setHiddenSelectors] = useState<Set<string>>(
    new Set()
  );

  // 从页面数据中提取可过滤的元素
  const filterableElements = useMemo((): FilterableElement[] => {
    if (!page) return [];

    const elements: FilterableElement[] = [];
    const selectorCounts = new Map<string, number>();

    // 统计 UTM 链接中的选择器
    page.links?.utmSummary?.examples?.forEach((link) => {
      if (link.selector) {
        const rootSelector = getRootSelector(link.selector);
        selectorCounts.set(
          rootSelector,
          (selectorCounts.get(rootSelector) || 0) + 1
        );
      }
    });

    // 统计追踪事件中的选择器
    page.trackingEvents?.forEach((event) => {
      // 从链接位置提取选择器（通过关联）
      const linkedExample = page.links?.utmSummary?.examples?.find((ex) =>
        ex.triggeredEvents?.some((te) => te.eventName === event.eventName)
      );
      if (linkedExample?.selector) {
        const rootSelector = getRootSelector(linkedExample.selector);
        selectorCounts.set(
          rootSelector,
          (selectorCounts.get(rootSelector) || 0) + 1
        );
      }
    });

    // 转换为可过滤元素列表
    selectorCounts.forEach((count, selector) => {
      elements.push({
        selector,
        label: getSelectorLabel(selector),
        category: getSelectorCategory(selector),
        count,
      });
    });

    return elements.sort((a, b) => b.count - a.count);
  }, [page]);

  // 过滤后的 UTM 链接
  const filteredUtmLinks = useMemo(() => {
    if (!page?.links?.utmSummary?.examples || hiddenSelectors.size === 0) {
      return page?.links?.utmSummary;
    }

    const filtered = page.links.utmSummary.examples.filter((link) => {
      if (!link.selector) return true;
      const rootSelector = getRootSelector(link.selector);
      return !hiddenSelectors.has(rootSelector);
    });

    return {
      ...page.links.utmSummary,
      examples: filtered,
      trackedLinks: filtered.filter((l) => l.params.length > 0).length,
      missingUtm: filtered.filter((l) => l.params.length === 0).length,
    };
  }, [page, hiddenSelectors]);

  // 过滤后的追踪事件
  const filteredTrackingEvents = useMemo(() => {
    if (!page?.trackingEvents || hiddenSelectors.size === 0) {
      return page?.trackingEvents.map(event => ({
        ...event,
        payload: event.payload as Record<string, unknown> | undefined
      })) || [];
    }

    return page.trackingEvents
      .filter((event) => {
        // 查找关联的链接
        const linkedExample = page.links?.utmSummary?.examples?.find((ex) =>
          ex.triggeredEvents?.some((te) => te.eventName === event.eventName)
        );

        if (!linkedExample?.selector) return true;

        const rootSelector = getRootSelector(linkedExample.selector);
        return !hiddenSelectors.has(rootSelector);
      })
      .map(event => ({
        ...event,
        payload: event.payload as Record<string, unknown> | undefined
      }));
  }, [page, hiddenSelectors]);

  // 过滤后的链接用于传递给 TrackingEventsTable
  const filteredLinks = useMemo(():
    | ScanPageWithMetrics['links']
    | undefined => {
    if (!page?.links) return undefined;
    return {
      ...page.links,
      utmSummary: filteredUtmLinks || null,
    };
  }, [page, filteredUtmLinks]);

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
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      page.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : page.status === 'failed'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-sky-50 text-sky-700'
                    }`}
                  >
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
                    .catch(() => {})
                }
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                复制 JSON
              </button>
            </div>
          </header>

          {/* Metrics Grid */}
          <CollapsibleSection
            title="核心指标概览"
            icon={<Activity className="h-4 w-4 text-slate-400" />}
            isOpen={openSections.metrics}
            onToggle={() => toggleSection('metrics')}
          >
            <div className="grid gap-6 lg:grid-cols-3 p-6">
              {/* SEO Card */}
              <Card
                title="SEO 元信息"
                icon={<Globe className="h-4 w-4 text-sky-500" />}
              >
                <dl className="space-y-4">
                  <Field label="Title" value={page.seo?.title} />
                  <Field
                    label="Description"
                    value={page.seo?.metaDescription}
                  />

                  {/* H1 部分 - 增强显示 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium uppercase text-slate-400">H1</p>
                      {page.seo?.h1Score !== null && page.seo?.h1Score !== undefined ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${
                            page.seo.h1Score >= 80 ? 'text-emerald-600' :
                            page.seo.h1Score >= 60 ? 'text-amber-600' :
                            'text-rose-600'
                          }`}>
                            {page.seo.h1Score}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-900 break-words">
                      {page.seo?.h1 !== undefined && page.seo?.h1 !== null && page.seo?.h1 !== ''
                        ? String(page.seo.h1)
                        : '--'}
                    </p>

                    {/* H1 问题列表 */}
                    {page.seo?.h1Issues && page.seo.h1Issues.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {page.seo.h1Issues.length} 个问题
                        </summary>
                        <div className="mt-2 space-y-1">
                          {page.seo.h1Issues.map((issue: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200">
                              <span className="shrink-0">•</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>

                  <Field label="Canonical" value={page.seo?.canonical} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Robots"
                      value={page.seo?.robotsTxtBlocked ? 'Blocked' : 'Allowed'}
                      highlight={
                        page.seo?.robotsTxtBlocked
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }
                    />
                    <Field
                      label="SEO 得分"
                      value={page.seo?.score ?? '--'}
                      highlight="text-indigo-600 font-semibold"
                    />
                  </div>

                  {/* JSON-LD 部分 */}
                  {page.seo && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-500">
                          JSON-LD 结构化数据
                        </span>
                        {page.seo.jsonLdScore !== null &&
                        page.seo.jsonLdScore !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold ${
                                page.seo.jsonLdScore >= 70
                                  ? 'text-emerald-600'
                                  : page.seo.jsonLdScore >= 40
                                    ? 'text-amber-600'
                                    : 'text-rose-600'
                              }`}
                            >
                              {page.seo.jsonLdScore}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            未检测到
                          </span>
                        )}
                      </div>

                      {/* Schema 列表 */}
                      {page.seo.jsonLdIssues?.schemas &&
                      page.seo.jsonLdIssues.schemas.length > 0 ? (
                        <div className="space-y-2">
                          {(
                            page.seo.jsonLdIssues.schemas as JsonLdSchema[]
                          ).map((schema, idx) => (
                            <details key={idx} className="group">
                              <summary className="flex items-center justify-between cursor-pointer rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {schema.type}
                                  </span>
                                  <span
                                    className={`text-xs font-medium ${
                                      schema.score && schema.score >= 70
                                        ? 'text-emerald-600'
                                        : schema.score && schema.score >= 40
                                          ? 'text-amber-600'
                                          : 'text-rose-600'
                                    }`}
                                  >
                                    {schema.score}
                                  </span>
                                </div>
                                <svg
                                  className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </summary>

                              <div className="mt-2 px-3 py-2 bg-white rounded-lg border border-slate-100 space-y-3">
                                {/* 必需字段 */}
                                {schema.requiredFields &&
                                  Object.keys(schema.requiredFields).length >
                                    0 && (
                                    <div>
                                      <div className="text-xs font-medium text-slate-700 mb-1.5">
                                        必需字段
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.entries(
                                          schema.requiredFields
                                        ).map(([field, isPresent]) => (
                                          <span
                                            key={field}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                              isPresent
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}
                                          >
                                            {isPresent ? '✓' : '✗'}{' '}
                                            {field}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                {/* 推荐字段 */}
                                {schema.recommendedFields &&
                                  Object.keys(schema.recommendedFields).length >
                                    0 && (
                                    <div>
                                      <div className="text-xs font-medium text-slate-700 mb-1.5">
                                        推荐字段
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {Object.entries(
                                          schema.recommendedFields
                                        ).map(([field, isPresent]) => (
                                          <span
                                            key={field}
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                                              isPresent
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-slate-50 text-slate-500 border border-slate-200'
                                            }`}
                                          >
                                            {isPresent ? '✓' : '○'}{' '}
                                            {field}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : page.seo.jsonLdTypes &&
                        page.seo.jsonLdTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {page.seo.jsonLdTypes.map((type: string) => (
                            <span
                              key={type}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* 原始数据查看 */}
                      {!!page.seo.schemaOrg && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                            查看原始 JSON-LD
                          </summary>
                          <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto max-h-60">
                            {JSON.stringify(page.seo.schemaOrg, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </dl>
              </Card>

              {/* Links Card */}
              <Card
                title="链接统计"
                icon={<Link2 className="h-4 w-4 text-indigo-500" />}
              >
                <dl className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="内部链接"
                      value={page.links?.internalLinks ?? 0}
                    />
                    <Field
                      label="外部链接"
                      value={page.links?.externalLinks ?? 0}
                    />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">
                        UTM 覆盖率
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {formatPercentage(
                          calculateCoverage(page.links?.utmSummary)
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{
                          width: `${calculateCoverage(page.links?.utmSummary) ?? 0}%`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>
                        {page.links?.utmSummary?.trackedLinks ?? 0} 已标记
                      </span>
                      <span>
                        {page.links?.utmSummary?.missingUtm ?? 0} 未标记
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        总链接数
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {(page.links?.internalLinks ?? 0) +
                          (page.links?.externalLinks ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        重定向链接
                      </span>
                      <span
                        className={`text-sm font-semibold ${page.links?.redirects ? 'text-amber-600' : 'text-slate-900'}`}
                      >
                        {page.links?.redirects ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        异常链接
                      </span>
                      <span
                        className={`text-sm font-semibold ${page.links?.brokenLinks ? 'text-rose-600' : 'text-emerald-600'}`}
                      >
                        {page.links?.brokenLinks ?? 0}
                      </span>
                    </div>
                  </div>
                </dl>
              </Card>

              {/* Issues Card */}
              <Card
                title="问题与性能"
                icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
              >
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
                    <span
                      className={`text-lg font-semibold ${
                        (page?.loadTimeMs ?? 0) > 2000
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatDuration(page.loadTimeMs)}
                    </span>
                  </div>
                </dl>
              </Card>
            </div>
          </CollapsibleSection>

          {/* HTML Structure Audit Card */}
          {page.seo?.htmlStructureIssues && (
            <CollapsibleSection
              title="HTML 结构审计"
              icon={<FileCode className="h-4 w-4 text-slate-400" />}
              isOpen={openSections.htmlStructure}
              onToggle={() => toggleSection('htmlStructure')}
            >
              <div className="p-6 space-y-4">
                {/* Semantic Tags */}
                {page.seo.htmlStructureIssues.semanticTags && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        语义化标签
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'header',
                        'nav',
                        'main',
                        'footer',
                        'article',
                        'aside',
                        'section',
                      ].map((tag) => {
                        const propertyName =
                          `has${tag.charAt(0).toUpperCase() + tag.slice(1)}` as keyof typeof page.seo.htmlStructureIssues.semanticTags;
                        const hasTag =
                          page.seo?.htmlStructureIssues?.semanticTags?.[
                            propertyName
                          ];
                        return (
                          <span
                            key={tag}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              hasTag
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {hasTag ? '✓' : '✗'} &lt;{tag}&gt;
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Heading Structure */}
                {page.seo.htmlStructureIssues.headingStructure && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        标题层级
                      </span>
                      <span className="text-xs text-slate-500">
                        {page.seo.htmlStructureIssues.headingStructure.hierarchy
                          ?.length || 0}{' '}
                        个标题
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div
                        className={`flex items-center justify-between p-2 rounded ${
                          page.seo.htmlStructureIssues.headingStructure.hasH1
                            ? 'bg-emerald-50'
                            : 'bg-rose-50'
                        }`}
                      >
                        <span className="text-slate-600">H1 标签</span>
                        <span
                          className={
                            page.seo.htmlStructureIssues.headingStructure.hasH1
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                          }
                        >
                          {page.seo.htmlStructureIssues.headingStructure.hasH1
                            ? '✓ 存在'
                            : '✗ 缺失'}
                        </span>
                      </div>
                      {page.seo.htmlStructureIssues.headingStructure
                        .multipleH1 && (
                        <div className="flex items-center justify-between p-2 rounded bg-amber-50">
                          <span className="text-slate-600">多个 H1</span>
                          <span className="text-amber-700">⚠ 警告</span>
                        </div>
                      )}
                      {page.seo.htmlStructureIssues.headingStructure
                        .skippedLevels?.length > 0 && (
                        <div className="p-2 rounded bg-amber-50">
                          <span className="text-slate-600">跳过的层级: </span>
                          <span className="text-amber-700 font-medium">
                            {page.seo.htmlStructureIssues.headingStructure.skippedLevels
                              .map((l: number) => `h${l}`)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Heading Hierarchy Details */}
                    {page.seo.htmlStructureIssues.headingStructure.hierarchy &&
                      page.seo.htmlStructureIssues.headingStructure.hierarchy
                        .length > 0 && (
                        <details className="mt-2 border-t border-slate-100 pt-2">
                          <summary className="text-xs font-medium text-slate-700 cursor-pointer hover:text-slate-900">
                            查看标题层级结构 (
                            {
                              page.seo.htmlStructureIssues.headingStructure
                                .hierarchy.length
                            }
                            )
                          </summary>
                          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                            {(
                              page.seo.htmlStructureIssues.headingStructure
                                .hierarchy as HeadingHierarchy[]
                            ).map((h, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 rounded bg-slate-50 text-xs"
                                style={{ paddingLeft: `${h.level * 8 + 8}px` }}
                              >
                                <span className="shrink-0 font-bold text-slate-500">
                                  H{h.level}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div
                                    className="text-slate-700 truncate"
                                    title={h.text}
                                  >
                                    {h.text || (
                                      <span className="italic text-slate-400">
                                        空标题
                                      </span>
                                    )}
                                  </div>
                                  {h.issues && h.issues.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {h.issues.map(
                                        (issue: string, issueIdx: number) => (
                                          <span
                                            key={issueIdx}
                                            className="inline-flex px-1 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200"
                                          >
                                            {issue}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                  </div>
                )}

                {/* Images */}
                {page.seo.htmlStructureIssues.images && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        图片
                      </span>
                      <span className="text-xs text-slate-500">
                        {page.seo.htmlStructureIssues.images.total} 张
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <div className="text-slate-500">缺失 Alt</div>
                        <div
                          className={`text-lg font-semibold ${
                            page.seo.htmlStructureIssues.images.missingAlt > 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {page.seo.htmlStructureIssues.images.missingAlt}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <div className="text-slate-500">懒加载</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {page.seo.htmlStructureIssues.images.lazyLoadable}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <div className="text-slate-500">有尺寸</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {page.seo.htmlStructureIssues.images.withDimensions}
                        </div>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-100">
                        <div className="text-slate-500">缺失尺寸</div>
                        <div
                          className={`text-lg font-semibold ${
                            page.seo.htmlStructureIssues.images.total -
                              page.seo.htmlStructureIssues.images
                                .withDimensions >
                            0
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {page.seo.htmlStructureIssues.images.total -
                            page.seo.htmlStructureIssues.images.withDimensions}
                        </div>
                      </div>
                    </div>

                    {/* Image Details */}
                    {page.seo.htmlStructureIssues.images.examples &&
                      page.seo.htmlStructureIssues.images.examples.length >
                        0 && (
                        <details className="mt-2 border-t border-slate-100 pt-2">
                          <summary className="text-xs font-medium text-slate-700 cursor-pointer hover:text-slate-900">
                            查看问题图片详情 (
                            {
                              page.seo.htmlStructureIssues.images.examples
                                .length
                            }
                            )
                          </summary>
                          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                            {(
                              page.seo.htmlStructureIssues.images
                                .examples as ImageExample[]
                            ).map((img, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                              >
                                <div
                                  className="font-mono text-slate-600 truncate mb-1"
                                  title={img.src}
                                >
                                  {img.src}
                                </div>
                                {img.issues && img.issues.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {img.issues.map(
                                      (issue: string, issueIdx: number) => (
                                        <span
                                          key={issueIdx}
                                          className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200"
                                        >
                                          {issue}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}
                                {img.alt && (
                                  <div className="text-[10px] text-slate-500">
                                    Alt: {img.alt}
                                  </div>
                                )}
                                {(img.width || img.height) && (
                                  <div className="text-[10px] text-slate-500">
                                    尺寸: {img.width} × {img.height}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                  </div>
                )}

                {/* Forms */}
                {page.seo.htmlStructureIssues.forms &&
                  page.seo.htmlStructureIssues.forms.total > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          表单
                        </span>
                        <span className="text-xs text-slate-500">
                          {page.seo.htmlStructureIssues.forms.total} 个表单,{' '}
                          {page.seo.htmlStructureIssues.forms.inputs} 个输入
                        </span>
                      </div>
                      {page.seo.htmlStructureIssues.forms.missingLabels > 0 && (
                        <div className="p-2 rounded bg-rose-50 border border-rose-200 text-xs">
                          <span className="text-rose-700 font-medium">
                            ⚠{' '}
                            {page.seo.htmlStructureIssues.forms.missingLabels}{' '}
                            个输入缺失标签
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                {/* ARIA */}
                {page.seo.htmlStructureIssues.aria &&
                  page.seo.htmlStructureIssues.aria.missingAriaLabels > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          可访问性
                        </span>
                      </div>
                      <div className="p-2 rounded bg-rose-50 border border-rose-200 text-xs">
                        <span className="text-rose-700 font-medium">
                          ⚠{' '}
                          {page.seo.htmlStructureIssues.aria.missingAriaLabels}{' '}
                          个交互元素缺失可访问名称
                        </span>
                      </div>
                    </div>
                  )}

                {/* Errors and Warnings Summary */}
                {(page.seo.htmlStructureIssues.errors?.length > 0 ||
                  page.seo.htmlStructureIssues.warnings?.length > 0) && (
                  <details className="border-t border-slate-100 pt-4">
                    <summary className="text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900 flex items-center gap-2">
                      <span>所有问题</span>
                      <span className="text-xs text-slate-500">
                        (
                        {(page.seo.htmlStructureIssues.errors?.length || 0) +
                          (page.seo.htmlStructureIssues.warnings?.length || 0)}
                        )
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                      {page.seo.htmlStructureIssues.errors?.map(
                        (error: string, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 rounded bg-rose-50 text-xs"
                          >
                            <span className="text-rose-600 font-bold">✗</span>
                            <span className="text-rose-700">{error}</span>
                          </div>
                        )
                      )}
                      {page.seo.htmlStructureIssues.warnings?.map(
                        (warning: string, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 rounded bg-amber-50 text-xs"
                          >
                            <span className="text-amber-600 font-bold">⚠</span>
                            <span className="text-amber-700">{warning}</span>
                          </div>
                        )
                      )}
                    </div>
                  </details>
                )}
              </div>
            </CollapsibleSection>
          )}

          {/* Element Filter */}
          {filterableElements.length > 0 && (
            <ElementFilter
              elements={filterableElements}
              onFilterChange={setHiddenSelectors}
            />
          )}

          {/* UTM Link Table */}
          <CollapsibleSection
            title="UTM 链接清单"
            icon={<Link2 className="h-4 w-4 text-slate-400" />}
            isOpen={openSections.utmLinks}
            onToggle={() => toggleSection('utmLinks')}
            badge={
              hiddenSelectors.size > 0 && (
                <span className="text-xs text-slate-500">
                  (已过滤{' '}
                  {(page.links?.utmSummary?.examples?.length || 0) -
                    (filteredUtmLinks?.examples?.length || 0)}{' '}
                  个)
                </span>
              )
            }
          >
            <UtmLinkTable summary={filteredUtmLinks} />
          </CollapsibleSection>

          {/* Tracking Events */}
          <CollapsibleSection
            title="埋点事件清单"
            icon={<Activity className="h-4 w-4 text-slate-400" />}
            isOpen={openSections.trackingEvents}
            onToggle={() => toggleSection('trackingEvents')}
            badge={
              <>
                {hiddenSelectors.size > 0 && (
                  <span className="text-xs text-slate-500">
                    (已过滤{' '}
                    {(page?.trackingEvents?.length || 0) -
                      filteredTrackingEvents.length}{' '}
                    个)
                  </span>
                )}
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ml-2">
                  {filteredTrackingEvents.length}
                </span>
              </>
            }
          >
            <div className="p-6">
              <TrackingEventsTable
                events={filteredTrackingEvents}
                links={filteredLinks}
              />
            </div>
          </CollapsibleSection>
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

const CollapsibleSection = ({
  title,
  icon,
  isOpen,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full border-b border-slate-100 px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {badge}
      </div>
      <ChevronDown
        className={`h-5 w-5 text-slate-400 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
    {isOpen && <div>{children}</div>}
  </section>
);

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
  highlight,
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
    case 'mobile':
      return <Smartphone className="h-3 w-3" />;
    case 'tablet':
      return <Tablet className="h-3 w-3" />;
    default:
      return <Monitor className="h-3 w-3" />;
  }
};

const UtmLinkTable = ({ summary }: { summary?: UtmSummary | null }) => {
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
                    <p
                      className="font-medium text-slate-900 break-words line-clamp-2"
                      title={example.text ?? undefined}
                    >
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
                        <span
                          className="font-medium truncate"
                          title={example.heading.text}
                        >
                          {example.heading.text}
                        </span>
                      </div>
                    )}
                    {example.selector && (
                      <div className="group relative">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Terminal className="h-3 w-3 shrink-0" />
                          <code
                            className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 truncate"
                            title={example.selector}
                          >
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
                    <span className="hidden sm:inline">
                      {formatDeviceVariant(example.deviceVariant)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          isTracked
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isTracked ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        />
                        {isTracked ? '已标记' : '未标记'}
                      </span>
                    </div>
                    {isTracked && (
                      <div className="flex flex-wrap gap-1.5">
                        {example.params.map((param) => (
                          <span
                            key={param}
                            className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {param}
                          </span>
                        ))}
                      </div>
                    )}
                    {example.triggeredEvents &&
                      example.triggeredEvents.length > 0 && (
                        <div className="mt-2 border-t border-slate-100 pt-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            {Array.from(
                              new Set(
                                example.triggeredEvents.map((e) => {
                                  // Normalize platform names
                                  const p = e.platform;
                                  return ['ga', 'gtag', 'dataLayer'].includes(p)
                                    ? 'ga'
                                    : p;
                                })
                              )
                            ).map((platform) => (
                              <span
                                key={platform}
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  platform === 'mixpanel'
                                    ? 'bg-purple-100 text-purple-700'
                                    : platform === 'ga'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {platform === 'ga'
                                  ? 'GA/GTM'
                                  : platform === 'mixpanel'
                                    ? 'Mixpanel'
                                    : platform}
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

const calculateCoverage = (utmSummary?: UtmSummary | null) => {
  if (!utmSummary) return undefined;
  const total = (utmSummary.trackedLinks ?? 0) + (utmSummary.missingUtm ?? 0);
  if (total === 0) return undefined;
  return Math.round(((utmSummary.trackedLinks ?? 0) / total) * 100);
};

// Tracking Events Table Component
const TrackingEventsTable = ({
  events,
  links,
}: {
  events?: Array<{
    id: number;
    platform: string | null;
    trigger: string | null;
    element: string | null;
    eventName: string | null;
    status: string | null;
    deviceVariant: string | null;
    payload?: Record<string, unknown>;
  }>;
  links?: ScanPageWithMetrics['links'];
}) => {
  // State for collapsible sections
  const [expandedPlatforms, setExpandedPlatforms] = useState<
    Record<string, boolean>
  >({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>(
    {}
  );

  const togglePlatform = (platform: string) => {
    setExpandedPlatforms((prev) => ({ ...prev, [platform]: !prev[platform] }));
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const toggleAll = () => {
    const allPlatforms = Object.keys(groupedEvents);
    const allExpanded = allPlatforms.every((p) => expandedPlatforms[p]);
    const newState = allPlatforms.reduce(
      (acc, p) => ({ ...acc, [p]: !allExpanded }),
      {}
    );
    setExpandedPlatforms(newState);
  };

  // Combine page-level events with link-triggered events
  const allEvents: Array<{
    id: string;
    platform: string;
    trigger: string;
    eventName: string | null;
    status: string | null;
    deviceVariant: string | null;
    element: string | null;
    location?: {
      heading?: { tag: string | null; text: string | null } | null;
      selector?: string | null;
      linkText?: string | null;
      linkUrl?: string | null;
    };
    payload?: Record<string, unknown>;
  }> = [];

  // Add page-level tracking events
  events?.forEach((event, idx) => {
    allEvents.push({
      id: `page-${event.id}-${idx}`,
      platform: event.platform ?? 'unknown',
      trigger: event.trigger || 'unknown',
      eventName: event.eventName,
      status: event.status,
      deviceVariant: event.deviceVariant,
      element: event.element,
      payload: event.payload,
    });
  });

  // Add link-triggered events from UTM summary
  links?.utmSummary?.examples?.forEach((example, linkIdx) => {
    example.triggeredEvents?.forEach((evt, evtIdx) => {
      allEvents.push({
        id: `link-${linkIdx}-${evtIdx}`,
        platform: evt.platform,
        trigger: evt.trigger,
        eventName: evt.eventName || null,
        status: evt.status,
        deviceVariant: evt.deviceVariant || example.deviceVariant || null,
        element: 'link',
        location: {
          heading: example.heading,
          selector: example.selector || null,
          linkText: example.text || null,
          linkUrl: example.url,
        },
        payload: evt.payload,
      });
    });
  });

  if (allEvents.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        未检测到埋点事件
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

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'track':
        return <Zap className="h-4 w-4 text-indigo-600" />;
      case 'init':
        return <Terminal className="h-4 w-4 text-indigo-600" />;
      case 'sdk_load':
        return <Globe className="h-4 w-4 text-indigo-600" />;
      case 'identify':
        return <Activity className="h-4 w-4 text-indigo-600" />;
      default:
        return <Code2 className="h-4 w-4 text-indigo-600" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'mixpanel':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ga':
      case 'gtag':
      case 'dataLayer':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPlatformDisplayName = (platform: string) => {
    switch (platform) {
      case 'ga':
      case 'gtag':
      case 'dataLayer':
        return 'GA / GTM';
      case 'mixpanel':
        return 'MIXPANEL';
      default:
        return platform.toUpperCase();
    }
  };

  // Normalize platform names and group events
  const normalizedEvents = allEvents.map((event) => ({
    ...event,
    platform: ['ga', 'gtag', 'dataLayer'].includes(event.platform)
      ? 'ga'
      : event.platform,
  }));

  // Group by platform for better organization
  const groupedEvents = normalizedEvents.reduce(
    (acc, event) => {
      if (!acc[event.platform]) {
        acc[event.platform] = [];
      }
      acc[event.platform].push(event);
      return acc;
    },
    {} as Record<string, typeof normalizedEvents>
  );

  const allPlatforms = Object.keys(groupedEvents);
  const allExpanded = allPlatforms.every((p) => expandedPlatforms[p]);

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {allPlatforms.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {allPlatforms.map((platform) => {
              const platformEventsCount = groupedEvents[platform].length;
              const firedCount = groupedEvents[platform].filter(
                (e) => e.status === 'fired'
              ).length;
              return (
                <div key={platform} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${getPlatformColor(platform)}`}
                  >
                    {getPlatformDisplayName(platform)}
                  </span>
                  <span className="text-sm text-slate-600">
                    {firedCount}/{platformEventsCount}
                  </span>
                </div>
              );
            })}
          </div>
          {allPlatforms.length > 1 && (
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${allExpanded ? 'rotate-180' : ''}`}
              />
              {allExpanded ? '全部折叠' : '全部展开'}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(groupedEvents).map(([platform, platformEvents]) => {
          const isExpanded = expandedPlatforms[platform] ?? false;
          const firedCount = platformEvents.filter(
            (e) => e.status === 'fired'
          ).length;
          const detectedCount = platformEvents.filter(
            (e) => e.status === 'detected'
          ).length;

          return (
            <div
              key={platform}
              className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
            >
              {/* Platform Header - More Compact */}
              <button
                onClick={() => togglePlatform(platform)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getPlatformColor(platform)}`}
                  >
                    {getPlatformDisplayName(platform)}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-700 font-medium">
                      {platformEvents.length} 个事件
                    </span>
                    {firedCount > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                          <span className="text-emerald-600 font-medium">
                            {firedCount}
                          </span>
                        </div>
                      </>
                    )}
                    {detectedCount > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                          <span className="text-blue-600 font-medium">
                            {detectedCount}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Collapsible Content - Card Layout */}
              {isExpanded && (
                <div className="bg-slate-50 p-4">
                  <div className="space-y-2">
                    {platformEvents.map((event) => {
                      const eventExpanded = expandedEvents[event.id] ?? false;
                      return (
                        <div
                          key={event.id}
                          className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                              {getTriggerIcon(event.trigger)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-3">
                              {/* Header Row */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-slate-900">
                                      {event.trigger}
                                    </span>
                                    {event.element && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
                                        {event.element}
                                      </span>
                                    )}
                                    {event.deviceVariant && (
                                      <div className="flex items-center gap-1 text-xs text-slate-500">
                                        {getDeviceIcon(event.deviceVariant)}
                                        <span>
                                          {formatDeviceVariant(
                                            event.deviceVariant
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center gap-2">
                                  {event.status === 'fired' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="h-3 w-3" />
                                      已触发
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                      <FileCode className="h-3 w-3" />
                                      代码中
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Location Info */}
                              {event.location && (
                                <div className="pl-3 border-l-2 border-slate-200 space-y-2">
                                  {event.location.linkText && (
                                    <p
                                      className="text-sm text-slate-700 line-clamp-1"
                                      title={event.location.linkText}
                                    >
                                      {event.location.linkText}
                                    </p>
                                  )}
                                  {event.location.linkUrl && (
                                    <a
                                      href={event.location.linkUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 truncate w-fit"
                                      title={event.location.linkUrl}
                                    >
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                      <span className="truncate max-w-md">
                                        {event.location.linkUrl}
                                      </span>
                                    </a>
                                  )}
                                  <div className="flex items-center gap-3 text-xs">
                                    {event.location.heading?.text && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="flex h-4 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                                          {event.location.heading.tag || 'H?'}
                                        </span>
                                        <span
                                          className="text-slate-600 truncate"
                                          title={event.location.heading.text}
                                        >
                                          {event.location.heading.text}
                                        </span>
                                      </div>
                                    )}
                                    {event.location.selector && (
                                      <div className="flex items-center gap-1">
                                        <Terminal className="h-3 w-3 text-slate-400" />
                                        <code
                                          className="text-[10px] text-slate-400 font-mono truncate"
                                          title={event.location.selector}
                                        >
                                          {formatSelector(
                                            event.location.selector
                                          )}
                                        </code>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Event Details */}
                              {event.eventName && (
                                <div className="space-y-2">
                                  <button
                                    onClick={() => toggleEvent(event.id)}
                                    className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
                                  >
                                    <ChevronDown
                                      className={`h-3 w-3 transition-transform ${eventExpanded ? 'rotate-180' : ''}`}
                                    />
                                    {eventExpanded
                                      ? '收起事件数据'
                                      : '查看事件数据'}
                                  </button>
                                  {eventExpanded ? (
                                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                      {(() => {
                                        try {
                                          let payload =
                                            typeof event.eventName === 'string'
                                              ? JSON.parse(event.eventName)
                                              : event.eventName;

                                          // Helper: Convert array-like object to array
                                          const normalizeArrayLikeObject = (
                                            obj: unknown
                                          ): unknown => {
                                            if (
                                              obj === null ||
                                              obj === undefined
                                            )
                                              return obj;
                                            if (Array.isArray(obj)) return obj;
                                            if (typeof obj !== 'object')
                                              return obj;

                                            // Check if object has numeric keys starting from 0
                                            const keys = Object.keys(
                                              obj as Record<string, unknown>
                                            );
                                            const isArrayLike =
                                              keys.length > 0 &&
                                              keys.every(
                                                (k, i) => k === String(i)
                                              );

                                            if (isArrayLike) {
                                              // Convert to array
                                              return keys.map(
                                                (k) =>
                                                  (
                                                    obj as Record<
                                                      string,
                                                      unknown
                                                    >
                                                  )[k]
                                              );
                                            }

                                            return obj;
                                          };

                                          // Normalize the payload
                                          payload =
                                            normalizeArrayLikeObject(payload);

                                          // Also normalize nested objects
                                          if (Array.isArray(payload)) {
                                            payload = payload.map((item) =>
                                              normalizeArrayLikeObject(item)
                                            );
                                          }

                                          // Handle array format: ["event_name", {...}] or [...]
                                          if (Array.isArray(payload)) {
                                            // Check if it's the ["event_name", {...}] pattern
                                            if (
                                              payload.length >= 2 &&
                                              typeof payload[0] === 'string' &&
                                              typeof payload[1] === 'object'
                                            ) {
                                              const eventName = payload[0];
                                              const eventData = payload[1];

                                              return (
                                                <div>
                                                  {/* Event Name Header */}
                                                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-xs font-semibold text-slate-500">
                                                        事件名称:
                                                      </span>
                                                      <code className="text-xs font-mono text-indigo-600 font-semibold">
                                                        {eventName}
                                                      </code>
                                                    </div>
                                                  </div>

                                                  {/* Event Properties Table */}
                                                  {eventData &&
                                                    typeof eventData ===
                                                      'object' &&
                                                    !Array.isArray(eventData) &&
                                                    Object.keys(eventData)
                                                      .length > 0 && (
                                                      <div className="divide-y divide-slate-100">
                                                        {Object.entries(
                                                          eventData
                                                        ).map(
                                                          ([key, value]) => (
                                                            <div
                                                              key={key}
                                                              className="px-3 py-2 hover:bg-slate-50 transition-colors"
                                                            >
                                                              <div className="flex items-start gap-3">
                                                                <span className="text-xs font-medium text-slate-600 shrink-0 min-w-[100px]">
                                                                  {key}:
                                                                </span>
                                                                <code className="text-xs font-mono text-slate-800 break-all">
                                                                  {typeof value ===
                                                                  'object'
                                                                    ? JSON.stringify(
                                                                        value
                                                                      )
                                                                    : String(
                                                                        value
                                                                      )}
                                                                </code>
                                                              </div>
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}
                                                </div>
                                              );
                                            }

                                            // Handle array with single object: [{...}]
                                            if (
                                              payload.length === 1 &&
                                              typeof payload[0] === 'object' &&
                                              !Array.isArray(payload[0])
                                            ) {
                                              const eventData = payload[0];
                                              return (
                                                <div className="divide-y divide-slate-100">
                                                  {Object.entries(
                                                    eventData
                                                  ).map(([key, value]) => (
                                                    <div
                                                      key={key}
                                                      className="px-3 py-2 hover:bg-slate-50 transition-colors"
                                                    >
                                                      <div className="flex items-start gap-3">
                                                        <span className="text-xs font-medium text-slate-600 shrink-0 min-w-[100px]">
                                                          {key}:
                                                        </span>
                                                        <code className="text-xs font-mono text-slate-800 break-all">
                                                          {typeof value ===
                                                          'object'
                                                            ? JSON.stringify(
                                                                value
                                                              )
                                                            : String(value)}
                                                        </code>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              );
                                            }

                                            // Fallback: show as JSON for complex arrays
                                            return (
                                              <div className="p-3 bg-slate-50">
                                                <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-slate-700 leading-relaxed">
                                                  {JSON.stringify(
                                                    payload,
                                                    null,
                                                    2
                                                  )}
                                                </pre>
                                              </div>
                                            );
                                          }

                                          // Handle object format
                                          if (
                                            typeof payload === 'object' &&
                                            payload !== null &&
                                            !Array.isArray(payload)
                                          ) {
                                            return (
                                              <div className="divide-y divide-slate-100">
                                                {Object.entries(payload).map(
                                                  ([key, value]) => (
                                                    <div
                                                      key={key}
                                                      className="px-3 py-2 hover:bg-slate-50 transition-colors"
                                                    >
                                                      <div className="flex items-start gap-3">
                                                        <span className="text-xs font-medium text-slate-600 shrink-0 min-w-[100px]">
                                                          {key}:
                                                        </span>
                                                        <code className="text-xs font-mono text-slate-800 break-all">
                                                          {typeof value ===
                                                            'object' &&
                                                          value !== null
                                                            ? JSON.stringify(
                                                                value
                                                              )
                                                            : String(value)}
                                                        </code>
                                                      </div>
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            );
                                          }

                                          // Fallback: raw display for primitives
                                          return (
                                            <div className="p-3 bg-slate-50">
                                              <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-slate-700">
                                                {JSON.stringify(
                                                  payload,
                                                  null,
                                                  2
                                                )}
                                              </pre>
                                            </div>
                                          );
                                        } catch (e) {
                                          // If parsing fails, show raw data with error info
                                          console.error(
                                            'Failed to parse event data:',
                                            e
                                          );
                                          return (
                                            <div className="p-3 bg-amber-50 border-l-4 border-amber-400">
                                              <p className="text-xs text-amber-800 mb-2">
                                                ⚠️
                                                无法解析事件数据，显示原始格式：
                                              </p>
                                              <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-slate-700 leading-relaxed">
                                                {String(event.eventName)}
                                              </pre>
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-400 truncate font-mono">
                                      {(() => {
                                        try {
                                          const payload =
                                            typeof event.eventName === 'string'
                                              ? JSON.parse(event.eventName)
                                              : event.eventName;
                                          if (
                                            Array.isArray(payload) &&
                                            payload[0]
                                          ) {
                                            return (
                                              `${payload[0]} ${JSON.stringify(payload[1] || {})}`.substring(
                                                0,
                                                60
                                              ) + '...'
                                            );
                                          }
                                          return (
                                            String(event.eventName).substring(
                                              0,
                                              60
                                            ) + '...'
                                          );
                                        } catch {
                                          return (
                                            String(event.eventName).substring(
                                              0,
                                              60
                                            ) + '...'
                                          );
                                        }
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
