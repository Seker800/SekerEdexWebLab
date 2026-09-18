# ADR 0003: Web 技术路线

- Status: Accepted
- Date: 2026-09-16

## Context

项目同时需要 eDEX-UI 级别的高频交互、固定画布视觉精度、可访问文本、静态部署和移动端降级。
上游 Electron 实现依赖真实 shell、PTY、Node 文件系统和系统遥测，
不能直接成为公开网站架构。

## Decision

- 使用 Node.js 22 LTS、pnpm 10、Astro 静态输出、React 与严格 TypeScript。
- Astro 管理路由和构建期 HTML；单个 React 工作台管理桌面交互状态。
- 主体使用语义 DOM 与 CSS Grid；终端使用 xterm.js；点阵地球使用直接 Three.js；曲线使用
  Canvas 2D；音效使用 Web Audio。
- 用框架无关的 `SessionEngine`、类型化命令和领域事件连接输入与渲染器。
- 不接真实 PTY 或远程 shell；所有命令由浏览器白名单命令引擎执行。
- Vitest 验证纯逻辑，Playwright 验证交互与固定环境视觉回归。
- 首版不使用 Next.js、Electron、整页 Canvas、Tailwind、通用 UI/图表库、React Three Fiber、
  通用状态库或多主题系统。

## Consequences

- 高频图形不驱动整棵 React 树重渲染，渲染器可以单独测量、替换和降级。
- 需要维护少量专用 Canvas 和 Three.js 代码，以换取对参考画面的直接控制。
- 浏览器不能提供原版系统权限，系统数据必须替换为真实浏览器指标或明确标注的模拟数据。
- 只有测量证明某个适配器不能满足合同，才能替换对应技术；不因局部困难整体换栈。

## References

- Astro islands: <https://docs.astro.build/en/concepts/islands/>
- React state structure: <https://react.dev/learn/managing-state>
- Vite guide: <https://vite.dev/guide/>
- xterm.js documentation: <https://xtermjs.org/docs/>
- Three.js scene and render loop: <https://threejs.org/manual/en/creating-a-scene.html>
- Playwright visual comparisons: <https://playwright.dev/docs/test-snapshots>
- Web Audio practices: <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices>
- Page Visibility API: <https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API>
