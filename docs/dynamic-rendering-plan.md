## 全页面动态检测方案（Draft）

### Why：现状痛点

当前扫描引擎只下载 HTML 文本并做静态解析。对于 Framer / React / SPA：

1. 同一按钮为不同 breakpoint 预渲染多份 DOM，静态统计会把全部节点算进去。
2. 运行时才注入的埋点（例如 Code Override 内调用 `mixpanel.track`）根本不在 HTML 源里，扫描结果自然是空的。
3. 无法确认按钮是否实际可见，也不能还原真实设备行为。

要获得“与真实页面一致”的结果，需要引入 **headless 浏览器 + 多视口模拟 + 埋点 hook**。

---

### 方案概览

| 模块 | 目标 | 核心实现 |
| ---- | ---- | -------- |
| 动态渲染引擎 | 运行页面 JS，拿到真实 DOM | Playwright Worker（Chromium），限制并发，提供 3 个视口 |
| 链接/UTM 抽取 | 每个设备上实际可见的链接 | 在浏览器上下文注入脚本，遍历 `document.querySelectorAll('a[href]')` |
| 埋点捕获 | Hook Mixpanel/DataLayer/GA 调用 | 在页面加载前重写 `window.mixpanel.track` 等 API |
| 数据存储 | 保留设备、章节、可见性 | `utmSummary.examples[]` 加 `deviceVariant`、`visible` 字段；`tracking_events` 加 `device` |
| 前端 UI | 展示按设备区分的链接 & 埋点 | 现有页面表格展示 “桌面/平板/移动” 标签 |

---

### 1. 动态渲染引擎

1. **工具**：Playwright（Node API），Chromium channel，headless 模式。
2. **Worker 架构**：
   - 在 `server/lib/workers` 下新增 `browserWorker.ts`，负责：
     - 管理浏览器实例（可复用），限制最大并发；
     - 接收 `ScanJob`，为每个 device viewport 执行 `scanPage(job, viewport)`；
     - 将结果序列化交回现有的 `scanSinglePage`.
3. **加载策略**：
   - `page.goto(url, { waitUntil: 'networkidle', timeout: X })`；
   - 添加 `page.waitForTimeout(minimumContentTime)`，给 React Hydrate 时间；
   - 若页面自行暴露 `window.__seoReady`，则改为 `page.waitForFunction`.
4. **安全/隔离**：
   - 通过 `userDataDir` 隔离每个 session；
   - 设置 CSP/禁止下载、禁用通知等；
   - 若需要代理/登录，可在 worker 层扩展。

---

### 2. 多设备（Desktop / Tablet / Mobile）

| 设备 | viewport | UA |
| ---- | -------- | -- |
| Desktop | 1280×720 (deviceScale 1) | 默认 Chrome UA |
| Tablet | 768×1024 | `Mozilla/5.0 (iPad; CPU OS 16_0…)` |
| Mobile | 390×844 | `Mozilla/5.0 (iPhone; CPU iPhone OS…)` |

扫描流程：

1. 默认只跑 Desktop；
2. 若页面含有 Framer、媒体查询、`<meta name="viewport">`等特征，则继续跑 Tablet / Mobile；
3. 每个设备的 DOM/埋点输出单独记录，`utmSummary.examples[].deviceVariant = 'desktop' | 'tablet' | 'mobile'`.

可配置：

- 环境变量 `SCANNER_DEVICE_PROFILES=desktop,tablet,mobile` 控制要扫描的设备；
- 允许某些 job 只跑单设备（例如 `mode=single` 且用户指定）。

---

### 3. 链接 & UTM 抽取（浏览器内脚本）

注入脚本逻辑：

```ts
const collectLinks = () => {
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  return anchors.map((anchor) => {
    const url = new URL(anchor.href, location.origin).toString();
    const params = Array.from(new URL(url).searchParams.entries())
      .filter(([key]) => key.toLowerCase().startsWith('utm_'));
    return {
      url,
      params,
      heading: findNearestHeading(anchor),
      deviceVariant: CURRENT_DEVICE,
      visible: isElementVisible(anchor),
    }
  }).filter((link) => link.params.length > 0 && link.visible);
};
```

辅助函数：

- `findNearestHeading`: 向上寻找最近的 `h1-h3`，返回 tag & innerText；
- `isElementVisible`: 检查 `offsetParent`, `getBoundingClientRect`, `getComputedStyle`；
- 结果数组传回 Node 侧，写入 `linkMetrics` / `scanPages`。

这样能确保只统计“当前视口下实际可见的链接”，不会出现静态 HTML 多份 DOM 的问题。

---

### 4. 埋点捕获策略

1. **预注入 hook**：

```ts
await page.addInitScript(() => {
  window.__trackingLog = [];
  const pushEvent = (platform, type, payload) => {
    window.__trackingLog.push({
      platform,
      type,
      payload,
      ts: Date.now(),
    });
  };
  const wrap = (obj, method, platform) => {
    const original = obj?.[method];
    if (!original) return;
    obj[method] = (...args) => {
      pushEvent(platform, method, args);
      try { return original.apply(obj, args); } catch (err) { throw err; }
    };
  };
  wrap(window.mixpanel, 'track', 'mixpanel');
  wrap(window, 'gtag', 'ga');
  const originalPush = window.dataLayer?.push;
  if (originalPush) {
    window.dataLayer.push = function (...args) {
      pushEvent('ga', 'dataLayer.push', args);
      return originalPush.apply(this, args);
    };
  }
});
```

2. **交互模拟（可选）**：
   - 扫描链接时记录 `data-tracking="true"` 的元素，自动 `click()`；
   - 执行表单提交/CTA 点击，用于触发埋点；
   - 需要设定白名单/限流。
3. **回收日志**：
   - 执行完页面后 `const events = await page.evaluate(() => window.__trackingLog)`;
   - 写入 `tracking_events` 表（含 deviceVariant、payload）。

---

### 5. 后端 & 数据结构调整

1. **配置**：`server/lib/config.ts` 增加：
   - `SCANNER_USE_BROWSER` (bool)
   - `SCANNER_DEVICE_PROFILES` (string array)
   - `SCANNER_BROWSER_TIMEOUT_MS`
2. **数据结构**：
   - `utmSummary.examples[]` 增加 `deviceVariant`, `visible`；
   - `tracking_events` 增加 `device_variant`, `payload`, `context`.
3. **执行流程**：
   - `scanSinglePage` 根据配置调用 `dynamicRenderer.fetch(job)`；
   - fallback：若 Playwright 抛错，记录 `issuesSummary.meta.browserFallback = true` 并走原静态流程；
   - job 完成后，`issuesSummary` 中包含 per-device 聚合统计。

---

### 6. 前端展示

1. UTM 表格已经新增 “设备” 列，可用 Pill 标记 `desktop / tablet / mobile`。
2. 历史列表/Utm inline list 若 `deviceVariant` 存在，也显示对应标签。
3. 埋点事件列表支持按设备筛选、按触发方式排序。

---

### 7. 运维 & 资源

1. **资源预算**：Playwright + Chromium 每实例约 200-400MB 内存；建议：
   - 单机限制同时运行 2-3 个浏览器；
   - 使用共享 `browserContext`，每 job 创建 context + page；
   - 定期重启浏览器进程（X 个 job 后重启）。
2. **诊断**：
   - 每个 device 保存一张 screenshot + DOM snapshot（用于 debug）；
   - 日志记录加载耗时、hook 捕获次数、fallback 情况。
3. **安全**：
   - 禁用 `navigator.permissions`, `download`, `clipboard`;
   - 若需要登录/授权，使用隔离 cookie jar；
   - 在 untrusted 环境中考虑启用网络代理。

---

### 路线图 / 落地顺序

1. **P0**：加 Playwright Worker、Desktop 视口动态抓取；保存 DOM & 链接列表。
2. **P1**：加入 Tablet/Mobile 视口，结构化 `deviceVariant`，前端展示。
3. **P2**：埋点 Hook + 自动交互。
4. **P3**：性能优化（浏览器池、截图、错误恢复等）。
5. **P4**：对接 CI/监控，支持周期性扫描/对比。

---

通过以上步骤就能让检测结果与“真实页面”一致，同时也能识别出你提到的 Framer breakpoint 情况 —— 每个视口分别扫描、只记录可见节点，并在 UI 中标注“桌面/平板/移动”。这是一个较大的工程，但可以按阶段逐步替换现有静态分析。*** End Patch
