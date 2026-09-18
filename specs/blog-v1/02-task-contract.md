# Blog V1 执行合同

## Contract Rules

- 每个 slice 都产生可运行、可直接访问和可验证的输出。
- 按依赖顺序推进，不在内容基础设施完成前堆叠视觉岛。
- `apps/clone` 是冻结的参考应用；博客功能进入独立应用边界。
- 没有真实内容时使用中性示例，不编造作者事实。

## Status

ACTIVE

## Archive Plan

- Active location: `specs/blog-v1/`
- Archive location: `specs/archive/2026-09-blog-v1/`
- Closeout trigger: 所有 completion checks 完成并保存生产构建、浏览器和内容验证证据。

## Task Objective

交付一个静态优先、可索引、可访问的技术博客 V1，并让现有 eDEX 指挥舱成为可选入口体验。

## In-scope Changes

- 新建博客应用、内容集合、路由、搜索索引和发布元数据。
- 提取可合法复用的 `tron` token 与博客导航 intent。
- 建立首页入口与文章内容之间的链接。
- 增加博客独立验证脚本和浏览器验收。

## Out-of-scope Changes

- 重写或删除 `apps/clone`。
- 真实 shell、主机遥测、本地文件访问、评论、账号或 CMS。
- 为博客放宽现有复刻阈值。

## Target Modules / Files

- `apps/blog/`
- `content/` 或博客应用内的内容集合
- `package.json`
- `docs/architecture.md`
- `docs/maintainer-guide.md`
- 博客专用测试和验证脚本

## Required Implementation Points

- 内容 schema 是路由、RSS、搜索、标签和终端导航的唯一事实源。
- 首页首屏即使不执行启动动画也有可见内容入口。
- 文章页面不加载持续动画和屏幕键盘。
- 偏好存储失败时回退到无声音、低动态且可继续阅读的状态。
- 所有外部内容和 Markdown 输出经过 Astro 默认转义边界，不注入任意 HTML 脚本。

## Key Locked Decisions

- Astro 静态输出、Markdown/MDX 内容集合、构建期搜索索引。
- 指挥舱和博客是两个应用边界，共享数据契约，不共享全局 DOM。
- 博客路由的阅读体验优先于固定画布复刻。

## Validation Steps

- `npm run check`
- `npm test`
- `npm run app:build`
- `npm run app:verify`
- 博客生产构建、链接检查、无 JavaScript 阅读和 Chromium/WebKit 核心导航检查
- Lighthouse 四项分数检查

## Completion Checks

- [ ] 文章、标签、项目、关于、搜索、RSS、站点地图和 404 完成。
- [ ] 普通导航、终端导航和文件导航共享内容 registry。
- [ ] 桌面、平板、移动端和 reduced motion 验证通过。
- [ ] 复刻应用原有门禁通过。
- [ ] 维护和发布文档完成。

## Closeout Notes

- Delivered: 产品边界和执行阶段已锁定。
- Remaining: Slice 1-4 实现。
- Evidence: `specs/blog-v1/01-spec.md` 与本合同。
- Archive decision: KEEP_ACTIVE

## Rollback / Caution Notes

- 不把 `apps/clone` 的固定画布 CSS 作为博客全局样式导入。
- 不删除上游素材或来源记录；共享素材必须继续通过哈希和许可证检查。

---

## Slice 1 — 内容与静态路由

### Goal

建立无 JavaScript 也完整可用的博客骨架。

### Scope

- Astro 应用与内容集合 schema。
- 首页、文章列表、文章详情、标签、项目、关于和 404。
- RSS、站点地图、canonical、Open Graph 和代码高亮。

### Input

- `01-spec.md`
- 已有技术路线和许可证边界。

### Output

- 可生产构建的静态博客。
- 至少两篇明确标记的示例内容，覆盖草稿过滤和标签。

### Non-goals

- 指挥舱交互、搜索 UI、评论和 CMS。

### Acceptance

- [ ] 无 JavaScript 可完成首页到文章、标签、项目和关于页面的导航。
- [ ] 直接访问和刷新任意内容 URL 成功。

## Slice 2 — 统一搜索与导航

### Goal

让普通导航、搜索和命令入口共享同一内容事实。

### Scope

- 构建期搜索索引。
- 键盘可访问的搜索/命令面板。
- `help`、`home`、`posts`、`search`、`open`、`tags`、`projects`、`about`、`clear`。

### Input

- Slice 1 内容 registry。

### Output

- 类型化查询和导航 intent。
- 可分享、可直接访问的搜索结果目标。

### Non-goals

- 任意 shell 命令、模糊执行、服务端搜索。

### Acceptance

- [ ] 三种导航入口解析到相同 URL。
- [ ] 未知命令给出可恢复帮助，不执行输入内容。

## Slice 3 — 指挥舱入口适配

### Goal

把现有复刻体验接到博客，而不让它控制正文布局。

### Scope

- 首页指挥舱岛或独立 `/deck/` 入口。
- 文件面板映射文章、标签和项目。
- 遥测改为真实站点/会话指标。
- 启动、声音和动态偏好持久化。

### Input

- Slice 2 导航控制器。
- `apps/clone` 的来源和视觉基线。

### Output

- 可跳过、可关闭声音且能进入内容的指挥舱体验。

### Non-goals

- PTY、系统监控、磁盘浏览和多键盘布局。

### Acceptance

- [ ] 入口失败或 JavaScript 禁用时仍显示普通内容导航。
- [ ] 所有遥测字段标明真实来源，不显示伪造系统状态。

## Slice 4 — 质量与发布

### Goal

关闭阅读、性能、SEO、无障碍和维护门禁。

### Scope

- Chromium/WebKit 端到端验证。
- Lighthouse、链接检查、RSS 和站点地图验证。
- 视觉截图、性能预算、维护和发布说明。

### Input

- Slice 1-3 完整实现。

### Output

- 可部署构建和可复查证据。

### Non-goals

- 账号、评论、统计平台和在线 CMS。

### Acceptance

- [ ] Lighthouse 四项均达到 90 以上。
- [ ] 现有 `npm run verify` 与博客门禁全部通过。
