# 全栈 SEO / 埋点检测器实施方案

## 1. 产品目标与用户流程

- **目标**：提供一个可以检测单页或整站 SEO 基础项、链接 UTM 追踪以及 Mixpanel/GA 埋点覆盖情况的高性能全栈应用，并保留本地检测历史。
- **用户流程**：用户在首页输入网址 → 选择“单页 / 整站”模式 → 确认开始检测 → 右下角浮窗实时展示最多 5 条并行任务的状态 → 用户可继续排队新的检测 → 历史列表展示所有检测记录并支持搜索/排序 → 点击进入历史详情查看汇总指标与逐页数据。
- **关键约束**：并行任务数通过环境变量（建议 `SCAN_WORKERS_MAX_CONCURRENCY`）配置；数据需持久化到本地 Postgres（Drizzle ORM）。

## 2. 技术栈与运行环境

| 层       | 技术                                                    | 说明                                                                        |
| -------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| 后端 API | Bun + Hono                                              | `server/app.ts` 已集成 Hono，可扩展 RESTful / streaming 端点。              |
| 数据层   | Drizzle ORM + Postgres                                  | 通过 `server/lib/db` 访问 Neon 或本地 Postgres，`drizzle-kit` 负责迁移。    |
| 前端     | React 19 + Vite + TanStack Router & Query + Tailwind v4 | 已在 `frontend` 初始化，支持文件路由和 Query 缓存。                         |
| 类型共享 | `@shared/types`                                         | 通过 Bun workspace 共享 API 与 schema 类型，确保端到端类型安全。            |
| 背景任务 | Bun Worker / Bun Queue                                  | 负责抓取页面、分析指标、写库并推送进度。可在同一 Bun 进程内运行 worker 池。 |

## 3. 系统架构

1. **API 层**：暴露扫描任务 CRUD、任务进度查询、历史列表/详情、页面指标查询等端点。继续沿用 Hono + zod-validator。
2. **扫描调度器**：在收到创建任务的请求后写入数据库并推送到内存队列，队列遵循 `SCAN_WORKERS_MAX_CONCURRENCY` 限制，worker 消费时实时更新进度。
3. **分析执行器**：对于整站扫描，先收集站点地图/链接，根据用户配置的“整站深度”控制层级（默认参考 sitemap 首层），再逐页并发执行页面分析；单页模式仅分析给定 URL。
4. **数据存储**：任务、逐页结果、指标汇总拆分多张表，方便历史查询和聚合。
5. **前端**：使用 TanStack Router 提供 3 个视图（首页、历史列表、历史详情），React Query 订阅任务与进度，Tailwind V4 和 shadcnui 负责 UI。
6. **实时进度**：右下角浮窗通过 `/api/tasks/live` SSE 或长轮询获取任务状态。

## 4. 数据模型（建议）

| 表                   | 核心字段                                                                                                                                             | 说明                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `scan_jobs`          | `id`, `target_url`, `mode`, `status`, `pages_total`, `pages_finished`, `issues_summary (jsonb)`, `created_at`, `started_at`, `completed_at`, `error` | 记录一次检测任务。`mode ∈ ('single','site')`。 |
| `scan_pages`         | `id`, `job_id`, `url`, `status`, `http_status`, `load_time_ms`, `issue_counts (jsonb)`                                                               | 每个被检测页面的基础记录。                     |
| `seo_metrics`        | `page_id`, `title`, `meta_description`, `canonical`, `h1`, `robots_txt_blocked`, `schema_org`, `score`                                               | 基础 SEO 指标。                                |
| `link_metrics`       | `page_id`, `internal_links`, `external_links`, `utm_params`, `broken_links`, `redirects`                                                             | 链接与 UTM 追踪情况。                          |
| `tracking_events`    | `page_id`, `element`, `trigger`, `platform` (mixpanel/ga), `status`                                                                                  | 埋点覆盖清单。                                 |
| `task_events` (可选) | `job_id`, `type`, `payload`, `created_at`                                                                                                            | 记录进度/错误日志，便于前端订阅。              |

Drizzle schema 可以通过 `drizzle-kit` 迁移生成，`zod` schema 用于 API 入参/出参验证。

## 5. 扫描流水线

1. **入队**：`POST /api/scans` 校验 URL & 模式 → 写入 `scan_jobs` → 发出队列事件。
2. **调度**：调度器读取最旧的 `pending` 任务，若当前运行任务 < `SCAN_WORKERS_MAX_CONCURRENCY`（默认 5）则开始执行。
3. **站点爬取**：整站模式先抓取 `robots.txt`、`sitemap.xml` 或通过 BFS 限制深度/域名；默认按照 sitemap 第一层展开，可由用户输入的“整站深度”覆盖；支持 `SCANNER_MAX_PAGES` 限制。
4. **页面分析**：
   - 使用 `fetch`/无头浏览器抓取 HTML。
   - SEO 模块解析 `<title>、meta、canonical、h1、结构化数据`.
   - 链接模块统计内部/外部链接、UTM 参数覆盖、异常链接。
   - 埋点模块查找 `mixpanel.track/ga('send')` 等脚本或 data attributes，定位按钮元素与上报平台。
5. **写库 & 进度**：每处理完一个页面即写入 `scan_pages`、指标表，并更新 `scan_jobs.pages_finished`。同时推送 `task_events` 用于 SSE。
6. **完成**：所有页面结束后计算汇总数据（通过 SQL 聚合或 Bun 侧 reduce）并更新 `scan_jobs.status = 'done'`。

## 6. API 设计（草案）

- `POST /api/scans`：创建任务（参数：`url`, `mode`, `depthLimit`, `utmRequired` 等）。
- `GET /api/scans?search=&sort=`：分页/排序历史列表，默认按 `created_at desc`。
- `GET /api/scans/:id`：返回任务基本信息 + 统计汇总。
- `GET /api/scans/:id/pages`：分页返回页面列表（含搜索过滤）。
- `GET /api/scans/:id/pages/:pageId`：单页全部指标。
- `GET /api/scans/progress/live`：SSE / WebSocket / 轮询接口，返回最近运行任务。
- `DELETE /api/scans/:id`：清理旧数据（可选）。
  所有端点沿用 `@hono/zod-validator`，并通过 `@shared/types` 生成前端 API 客户端。

## 7. 前端模块设计

### 7.1 首页（任务创建）

- 居中搜索框 + 模式切换（单页/整站）+ 进阶设置（整站深度、最大页面数、User-Agent）。
- 表单使用 `@tanstack/react-form`，创建任务后通过 React Query mutation 触发。
- 右下角浮窗组件订阅 `useLiveScansQuery`，显示状态条、页数进度、可跳转按钮。

### 7.2 历史检测列表

- 路由：`/history`。React Query 获取 `/api/scans`。
- 筛选：搜索框（URL 关键字）、模式过滤、状态过滤、排序（最新/耗时/问题数）。
- 列表项信息（产品视角）：URL & favicon、模式标签、扫描范围（页数）、开始时间、总耗时、问题摘要（SEO/链接/埋点各类计数）、状态进度条。

### 7.3 历史详情

- 路由：`/history/$scanId`。
- 单页模式：顶部展示页面总体评分 + 三大类指标折线/条形图；下方列出每类问题详情（缺失 title、重复 description、utm 缺失、Mixpanel 未覆盖等）。
- 整站模式：顶部展示站点级别 KPI（已扫描页数、平均分、严重问题数）。下方以表格列出每个页面的关键指标（HTTP 状态、SEO 得分、UTM 完整度、埋点覆盖率、最后检测时间），支持排序/过滤；点击进入 `/history/$scanId/pages/$pageId` 查看明细。
- 详情页组件复用 TanStack Router loader & search params，实现分页和排序的 URL 状态同步。

## 8. 并行控制与配置

- `SCAN_WORKERS_MAX_CONCURRENCY`：默认 5，可通过 `.env` 配置。
- `SCANNER_DEFAULT_SITE_DEPTH`：整站默认抓取层数（1 = sitemap 首层），允许前端覆盖。
- `SCANNER_MAX_PAGES`：整站最大页数，防止无限抓取。
- `SCANNER_REQUEST_TIMEOUT_MS`、`SCANNER_USER_AGENT`：用于 fetch。
- 队列实现：使用 Bun 内置 `Bun.scheduler` 或 lightweight 队列（如 `piscina`）构建 worker 池。调度器在应用启动时初始化并监听 DB 变化。

## 9. 观测与测试

- **日志**：扫描过程中记录结构化日志（jobId、pageUrl、阶段、耗时、错误），可写入 `task_events`。
- **单元测试**：为解析器模块（SEO/UTM/埋点）编写输入 HTML → 输出指标的测试。
- **集成测试**：使用 `bun test`/`vitest` 对 API 端点 + Drizzle 内存数据库运行。
- **前端测试**：在关键组件上使用 Storybook 或 Playwright（可选）验证交互；至少在 React Query 层模拟 API。

## 10. 里程碑（实施步骤）

1. **基础设施**：搭建新的 Drizzle schema、任务队列表、API 骨架、共享类型；完成 `.env` 配置与迁移。
2. **扫描内核**：实现单页分析器、并行调度、整站爬虫、指标计算，并返回结构化结果。
3. **API & 实时接口**：暴露创建/查询/实时进度端点，补充输入验证与错误处理。
4. **前端页面**：完成首页表单 + 任务浮窗、历史列表、历史详情及页面级指标视图。
5. **体验增强**：排序/筛选、错误回退、任务清理、导出报告等。
6. **测试 & 监控**：加入覆盖率、性能监控、可视化日志，并准备部署脚本（生产/本地）。

该实施方案与现有 Bun + Hono + React/TanStack 架构保持一致，可直接在 `server` 与 `frontend` 目录内迭代。
