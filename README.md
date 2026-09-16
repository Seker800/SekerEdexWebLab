# SekerEdexWebLab

一个非官方、开源的 Web 视觉复刻实验。当前目标只有一个：验证现代浏览器能否重现
[eDEX-UI](https://github.com/GitSquared/edex-ui) 最有辨识度的全屏终端体验，并形成可用于个人博客主页的可靠基础。

当前唯一视觉基准是上游官方默认截图：**neofetch on eDEX-UI 2.2、默认 `tron` 主题、
QWERTY 键盘**。Phase 0 使用与原版一致的固定 1920×1080、16:9 逻辑画布，一比一复刻
构图、比例、视觉语言和运行状态，再进行博客内容替换；其他主题不属于当前复刻范围。

本项目采用 Astro、React 与专用浏览器渲染层，不继承其他项目的技术路线，也不把普通终端
主题包装成“复刻”。先用可运行垂直切片证明视觉、交互、声音和性能，再扩展博客内容与功能。

## 当前阶段

`Phase 0 — Feasibility`

需要证明：

- 固定 16:9 全屏三段式控制台能够保持 eDEX-UI 的构图和信息密度。
- 中央终端、文件系统、实时监控和屏幕键盘可以互相联动。
- 实体键盘输入、按键发光、程序化音效和动态监控能同时保持稳定帧率。
- 博客文章、摄影和设计作品可以在同一控制台内打开，而不退化为传统长页面。
- 移动端有明确的降级体验，不强行压缩桌面控制台。

详细验收标准见 [`docs/visual-parity.md`](docs/visual-parity.md)。

## 文档导航

| 文档 | 用途 |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Agent 与维护者必须遵守的项目规则 |
| [`docs/architecture.md`](docs/architecture.md) | 北极星、系统边界和长期不变量 |
| [`docs/technical-route.md`](docs/technical-route.md) | 已选技术栈、渲染策略、目录边界与验证门禁 |
| [`docs/visual-parity.md`](docs/visual-parity.md) | 视觉与交互复刻的验收合同 |
| [`docs/research/edex-ui.md`](docs/research/edex-ui.md) | 原项目参考范围和证据记录 |
| [`docs/adr/0002-lock-tron-reference.md`](docs/adr/0002-lock-tron-reference.md) | 锁定默认 Tron 官方截图为一比一复刻基准 |
| [`docs/adr/0003-web-technology-route.md`](docs/adr/0003-web-technology-route.md) | 选择 Astro、React 与专用浏览器渲染层 |
| [`docs/adr/0004-fixed-canvas-and-reference-fonts.md`](docs/adr/0004-fixed-canvas-and-reference-fonts.md) | 固定 16:9 画布与本地临时字体策略 |
| [`docs/maintainer-guide.md`](docs/maintainer-guide.md) | 日常开发、验证、提交与推送入口 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 贡献、DCO 和 Pull Request 规则 |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | 第三方代码、素材和许可证边界 |

## 来源与许可

项目受 eDEX-UI 启发，但当前仓库未复制 eDEX-UI 源码、Logo、截图、字体或音效。
若后续引入其 GPL 代码，必须先记录来源、固定 commit，并在同一个变更中更新许可证边界与
`THIRD_PARTY_NOTICES.md`。

本项目代码按 GPL-3.0-only 发布。个人文章、摄影和设计作品不因进入本仓库而自动采用 GPL；
内容许可证必须由内容目录单独声明。
