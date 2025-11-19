# 任务拆分文档

> 所有任务默认使用 Bun + Hono + React/TanStack 技术栈，并以 `server` / `frontend` 目录为边界。每个阶段可以独立验收，阶段内步骤需串行完成。

## 阶段 0：项目准备

- [x] **0.1** 梳理 `.env`，加入 `SCAN_WORKERS_MAX_CONCURRENCY`、`SCANNER_MAX_PAGES`、`SCANNER_DEFAULT_SITE_DEPTH`、`SCANNER_USER_AGENT` 等变量并更新 README（产出：新版 `.env.example`；备注：与 `DATABASE_URL` 一并管理）
- [x] **0.2** 配置 Drizzle schema 框架，新增 `scan_jobs` 等表、关系与 zod schema（产出：`server/lib/db/schema/*`；备注：生成第一版迁移）
- [x] **0.3** 更新共享类型输出（`server/shared/types.ts`）并调整 frontend `tsconfig` alias（产出：同步后的类型文件；备注：确保 API 客户端可访问新类型）

## 阶段 1：后端任务引擎

- [x] **1.1** 搭建扫描任务 CRUD API（`POST /api/scans`, `GET /api/scans`, `GET /api/scans/:id`）（产出：Hono 路由 + zod 校验；验收：可创建任务并查询记录）
- [x] **1.2** 实现任务队列与调度器（内存队列 + worker 池 + 并发限制）（产出：`server/lib/workers/*`；验收：同时运行任务 ≤ 配置并发）
- [x] **1.3** 开发单页分析器（fetch HTML → 解析 SEO/链接/埋点结果）（产出：`server/lib/analyzers/*`；验收：至少 3 个示例页面返回结构化指标）
- [x] **1.4** 扩展整站模式（抓取 sitemap/内部链接、尊重用户填写的整站深度设置，默认 sitemap 首层、深度限制、页面排重）（产出：crawler 模块；验收：可扫描多页并写入数据库）
- [x] **1.5** 记录实时进度并暴露 `/api/scans/progress/live` SSE（产出：`task_events` 表或内存 channel + SSE 路由；验收：前端能订阅任务状态）

## 阶段 2：数据输出与指标 API

- [x] **2.1** 编写页面级 API：`GET /api/scans/:id/pages`、`GET /api/scans/:id/pages/:pageId`（产出：Hono 路由；验收：支持分页/排序/搜索）
- [x] **2.2** 汇总指标计算（SEO/链接/埋点计分、严重问题统计）（产出：SQL 视图或 service；验收：`scan_jobs` 记录包含 summary JSON）
- [x] **2.3** 提供导出/清理接口（可选，如 `DELETE /api/scans/:id`）（产出：API 路由；验收：可删除历史数据）

## 阶段 3：前端页面与交互

- [x] **3.1** 首页 `/`：表单 + 模式切换 + 高级设置组件（含整站深度输入，默认展示“sitemap 一层”）（产出：React 页面 + TanStack Form；验收：表单校验、可触发任务创建）
- [x] **3.2** 任务浮窗组件：订阅实时接口，展示最多 5 个任务进度并可跳转（产出：独立组件 + React Query subscription；验收：状态更新延迟 < 2s）
- [x] **3.3** 历史列表 `/history`：搜索、排序、过滤、列表 item UI（产出：页面 + Query + UI 组件；验收：分页/排序参数与 URL 同步）
- [x] **3.4** 历史详情 `/history/$scanId`：站点汇总、指标图表、页面表格、单页详情（产出：页面 + 图表组件；验收：支持单页/整站两种布局）
- [x] **3.5** 单页详情 `/history/$scanId/pages/$pageId`：展示 SEO/链接/埋点三个板块（产出：详情组件；验收：可复制数据并导出 JSON）

## 阶段 4：体验与质量

- [ ] **4.1** 错误处理与重试：任务失败状态回传、可重新触发扫描、队列异常告警（产出：API + UI 提示；验收：用户能看到失败原因并重试）
- [ ] **4.2** 测试覆盖：后端解析器单测、API 集成测试、前端关键组件测试（产出：`bun test`/`vitest`/`playwright` 套件；验收：核心模块覆盖率 ≥ 70%）
- [ ] **4.3** 性能调优：批量写入、并发限流、缓存 robots/sitemap、压缩前端资源（产出：优化报告；验收：200 页整站扫描稳定运行）
- [ ] **4.4** 部署与监控：启动脚本、Dockerfile、日志/metrics 收集方案（产出：Infra 文档；验收：本地与云主机可一键部署）

## 阶段 5：待办 / 可选增强

- [ ] 多租户 / 团队协作（账号与权限体系）
- [ ] 可视化报告导出（PDF / CSV）
- [ ] Webhook / Slack 通知
- [ ] 接入 Lighthouse / Ahrefs 等第三方 SEO API 补充指标
