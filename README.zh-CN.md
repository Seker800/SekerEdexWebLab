<div align="center">

# SekerEdexWebLab

**基于上游源码、为浏览器而生的 eDEX-UI 指挥舱复刻。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/Seker800/SekerEdexWebLab/actions/workflows/ci.yml/badge.svg)](https://github.com/Seker800/SekerEdexWebLab/actions/workflows/ci.yml)
[![许可证：GPL v3](https://img.shields.io/badge/License-GPLv3-8ab4b6.svg)](LICENSE)
[![项目阶段：Phase 0](https://img.shields.io/badge/status-Phase%200-8ab4b6.svg)](#项目状态)

</div>

> [!IMPORTANT]
> SekerEdexWebLab 是基于 GitSquared
> [eDEX-UI](https://github.com/GitSquared/edex-ui) 的非官方移植项目，不由 GitSquared 或上游贡献者维护、认可或背书。

![作为项目固定视觉基准的 eDEX-UI 2.2 tron 上游界面](references/edex-ui-v2.2.8/screenshot_default.png)

<p align="center"><sub>固定的上游视觉基准——eDEX-UI 2.2、<code>tron</code>、<code>neofetch</code>、QWERTY。本项目的浏览器实现会与它进行量化对比；上图不是本项目运行截图。</sub></p>

## 项目简介

SekerEdexWebLab 将 eDEX-UI 2.2 的原始界面带到浏览器，同时保留全屏指挥舱体验：中央终端、
动态面板、文件系统、地球、声音和屏幕键盘共享同一个会话状态。

仓库同时包含浏览器应用和用于复刻、验证它的证据驱动工具链。工具链会固定上游源码、采集确定性的
浏览器状态、测量分区域视觉差异、验证交互与音频行为，并能在不放宽验收门禁的前提下运行有界的
Codex 修复尝试。

## 核心能力

- 基于截图对应时期的准确 eDEX-UI 源码进行移植。
- 使用不可变目标证据完成确定性的 Chromium 截图采集。
- 验证启动、声音、终端、键盘、标签页、鼠标和触摸交互。
- 通过分区域像素与感知对比生成可追溯报告和差异图。
- 有限状态修复流程，包含干净工作树与允许路径保护。
- 固定 1920×1080 桌面画布、等比缩放和移动端降级模式。
- 在 CI 中检查上游来源、复制素材哈希和许可证清单。

## 快速开始

需要 Node.js 22 和 npm。

```bash
git clone https://github.com/Seker800/SekerEdexWebLab.git
cd SekerEdexWebLab
npm install
npm run install:browsers
npm run upstream:sync
npm run app:dev
```

打开命令行输出的本地地址，保持声音开启，然后选择 **Initialize system**。使用 **REBOOT**
重放启动序列，使用 **SOUND ON/OFF** 控制声音。

## 验证

运行完整本地门禁：

```bash
npm run verify
```

该命令会依次验证上游素材完整性、类型检查、单元测试、生产构建、启动与交互行为、分区域视觉对比，
以及确定性复刻流程。

常用的定向命令：

| 命令 | 用途 |
| --- | --- |
| `npm run app:verify` | 验证启动、音频、交互、布局和浏览器错误 |
| `npm run app:verify:webkit` | 在 WebKit 中验证核心交互、固定画布、移动降级和浏览器错误 |
| `npm run app:hotspots` | 排出视觉差异最明显的 64×64 区域 |
| `npm run assets:verify` | 验证复制的上游素材及其 SHA-256 清单 |
| `npm run replicate:verify` | 运行固定视觉目标的复刻状态机 |
| `npm run replicate:repair` | 运行最多三次受保护、源码优先的修复尝试 |

报告和截图写入 `artifacts/`，并会被有意排除在发布内容之外。

## 系统如何协作

```text
固定的上游源码 + 冻结的参考截图
                 │
                 ▼
       apps/clone 中的浏览器应用
                 │
              确定性采集
                 │
                 ▼
      对比 ──► 判定 ──► 持久化报告
                 │
                 └──► 有界修复（主动启用）
```

浏览器观察、图像比较、结果判定和源码修改保持独立的进程边界。Codex 可以提出修复，但只有可执行
门禁有权判定场景是否通过。

扩展系统前请阅读 [NORTH_STAR.md](NORTH_STAR.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 和
[视觉北极星](docs/VISUAL_NORTH_STAR.md)。模块级上游源码索引位于
[docs/SOURCE_PORT_MAP.md](docs/SOURCE_PORT_MAP.md)。

## 来源与可追溯性

原始应用由 [GitSquared](https://github.com/GitSquared) 创建，并以 GPLv3 发布。本项目的标准界面
来源是 `v2.2.0` 标签之后的提交
[`66ba190`](https://github.com/GitSquared/edex-ui/commit/66ba190ee5369523195c4012d0a798fbe4d43391)。
较新的 [`v2.2.8`](https://github.com/GitSquared/edex-ui/releases/tag/v2.2.8) 仅作为次要实现与素材参考。

作者和第三方鸣谢见 [NOTICE.md](NOTICE.md)，文件级复制素材清单见
[apps/clone/UPSTREAM_ASSETS.md](apps/clone/UPSTREAM_ASSETS.md)。

## 项目状态

0.1 版本是 Phase 0 可行性构建，当前验证启动与声音序列、核心交互、桌面与移动端视口、完整指挥舱
外观和浏览器错误门禁。终端与遥测目前使用安全的浏览器模拟数据。

下一阶段会把指挥舱作为个人技术博客的入口体验，建设文章、标签、搜索、项目、RSS、SEO 和响应式
阅读页面。真实 shell、主机遥测、本地磁盘访问和完整桌面设置不进入产品路线。详细边界见
[Blog V1 产品规范](specs/blog-v1/01-spec.md) 与
[ADR 0005](docs/adr/0005-blog-product-boundary.md)。本项目不宣称自己是原始桌面应用的直接替代品。

## 参与贡献

欢迎提交 Issue 和 Pull Request。修改源码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)；除常规测试外，
本项目还要求通过来源检查和确定性视觉门禁。

## 许可证

SekerEdexWebLab 与原始 eDEX-UI 一致，使用 [GNU General Public License v3.0](LICENSE) 发布。
上游代码和素材的版权仍归各自作者所有，第三方材料保留 [NOTICE.md](NOTICE.md) 中记录的声明。
