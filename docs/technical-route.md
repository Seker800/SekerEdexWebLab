# SekerEdexWebLab 当前技术路线

本页描述已实现并经过门禁验证的路线。2026-09-16 的 Astro / React / xterm.js / pnpm
方案是早期设计；其具体工具选择由 [ADR 0008](adr/0008-record-verified-browser-stack.md) 更新。
本次记录不引入框架迁移，也不调整冻结视觉合同。

## 实际工具与职责

| 层 | 当前实现 | 边界 |
| --- | --- | --- |
| 构建 | Node.js 22、npm lockfile、Vite、严格 TypeScript | 静态输出；无前端服务器运行时 |
| 界面 | 原生语义 DOM、CSS、固定 1920×1080 逻辑画布 | 非移动桌面仅等比缩放与居中留边 |
| 会话 | CommandDeckController、TerminalSessionDeck | 类型化 intent、不可变快照、五个独立会话 |
| 终端 | DOM 文本渲染与浏览器白名单命令 | 不连接 PTY、不执行系统 Shell 或用户 JavaScript |
| 文件与内容 | 类型化内容树、只读虚拟文件系统、Markdown-it | 示例在构建期嵌入；作者内容由独立公共 API 提供 |
| 图表 | SVG 折线与遥测模型 | 演示设备指标标注为模拟数据 |
| 地球 | 经来源与哈希验证的原版 ENCOM bundle | 可销毁适配器，持续渲染交给统一调度器 |
| 图片 | 独立 VFX-JS 适配器，失败时使用裁片显现 | 图片解码、取消、切图与关闭独立于会话 |
| 声音 | Web Audio 解码原版 WAV | 用户手势解锁，持续可见的声音控制 |
| 测试 | Vitest、Playwright Chromium / WebKit | 类型、逻辑、内容边界、交互、截图与视觉预算 |

代码入口是 `apps/clone/src/main.ts`，负责组装适配器、连接输入与渲染。
业务事实由控制器与内容树持有，第三方渲染器不成为状态源。后续拆分入口文件应按导航、
终端展示等实际责任进行；文件行数本身不构成整体更换框架的证据。

## 生命周期与恢复

- `DisposableRegistry` 管理监听器和资源释放；进入浏览器往返缓存时保留可恢复的页面，
  非缓存离开才释放整页资源。
- `RuntimeScheduler` 管理持续采样与逐帧回调，随页面可见性暂停和恢复。
- `FullscreenContentOverlay` 管理文档、图片和视频的显示、背景隔离、键盘焦点与失活通知。
  隐藏内容时暂停内嵌媒体，图片适配器取消未完成解码后的显现任务。
- `withRequestDeadline` 给内容响应和启动日志的完整读取设置八秒截止时间，并支持上层取消。
  “跳过开场”结束等待后立即恢复输入和重启按钮。
- 内容加载、空目录与接口失败有明确状态；失败时保留首次请求的内容地址，并提供重新加载重试。
  API 失败绝不退回示例内容。重试会重新加载页面，不保留当前终端草稿。

## 验证与来源

完整入口为 `npm run verify`。它运行基准完整性、上游素材、发布边界、内容源、类型检查、
单元测试、内容覆盖率、构建、内容 API 联调、演示、Chromium、WebKit、中英文本地化、异常恢复和冻结复刻验证。
修改后的空白格式由 `git diff --check` 检查；目前没有全仓自动排版器或独立 ESLint 门禁。

当前实现的来源映射见 [SOURCE_PORT_MAP](SOURCE_PORT_MAP.md)，许可证与文件级来源以
根目录 NOTICE、THIRD_PARTY_NOTICES 和 `apps/clone/UPSTREAM_ASSETS.md` 为准。
不得把早期“不复用音效”建议当作当前素材事实，也不得跳过新素材的许可核对。

本地预览、生产代码发布与作者内容发布继续遵守各自边界：见
[本地测试](local-testing.md)、[发布决策](deployment.md) 和 [三仓库地图](REPOSITORY_MAP.md)。
