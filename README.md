# eDEX Web Lab

一个非官方、开源的 Web 视觉复刻实验。当前目标只有一个：验证现代浏览器能否重现
[eDEX-UI](https://github.com/GitSquared/edex-ui) 最有辨识度的全屏终端体验，并形成可用于个人博客主页的可靠基础。

本项目当前不预设框架，不继承其他项目的技术路线，也不把普通终端主题包装成“复刻”。
先用可运行原型证明视觉、交互、声音和性能，再决定长期实现。

## 当前阶段

`Phase 0 — Feasibility`

需要证明：

- 固定全屏三段式控制台在常见桌面比例下能够保持 eDEX-UI 的信息密度。
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
| [`docs/visual-parity.md`](docs/visual-parity.md) | 视觉与交互复刻的验收合同 |
| [`docs/research/edex-ui.md`](docs/research/edex-ui.md) | 原项目参考范围和证据记录 |
| [`docs/maintainer-guide.md`](docs/maintainer-guide.md) | 日常开发、验证、提交与推送入口 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 贡献、DCO 和 Pull Request 规则 |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | 第三方代码、素材和许可证边界 |

## 来源与许可

项目受 eDEX-UI 启发，但当前仓库未复制 eDEX-UI 源码、Logo、截图、字体或音效。
若后续引入其 GPL 代码，必须先记录来源、固定 commit，并在同一个变更中更新许可证边界与
`THIRD_PARTY_NOTICES.md`。

本项目代码按 GPL-3.0-only 发布。个人文章、摄影和设计作品不因进入本仓库而自动采用 GPL；
内容许可证必须由内容目录单独声明。

