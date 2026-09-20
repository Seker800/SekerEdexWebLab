<div align="center">

# SekerEdexWebLab

**一个真正像系统一样运行，而不只是一张终端截图的浏览器 eDEX-UI 指挥舱。**

[English](README.md) · [快速开始](#快速开始) · [你可以做什么](#你可以做什么) · [验证体系](#验证体系)

[![CI](https://github.com/Seker800/SekerEdexWebLab/actions/workflows/ci.yml/badge.svg)](https://github.com/Seker800/SekerEdexWebLab/actions/workflows/ci.yml)
[![许可证：GPL v3](https://img.shields.io/badge/license-GPLv3-8ab4b6.svg)](LICENSE)
[![Node.js 22](https://img.shields.io/badge/node-22-8ab4b6.svg)](package.json)
[![项目阶段：Phase 0](https://img.shields.io/badge/status-Phase%200-8ab4b6.svg)](#项目状态)

</div>

![SekerEdexWebLab 在 1920×1080 画布中的浏览器指挥舱](.github/assets/readme-command-deck.png)

<p align="center"><sub>本项目浏览器实现的标准 1920×1080 桌面运行画面。</sub></p>

SekerEdexWebLab 在浏览器中重现 eDEX-UI 2.2 的 `tron` 体验：中央终端、实时遥测、文件系统、
地球、声音与屏幕键盘由同一个会话驱动。仓库还包含一套确定性的采集与对比系统，用可执行证据
证明浏览器实现仍然符合冻结的视觉目标。

> [!IMPORTANT]
> SekerEdexWebLab 是基于 GitSquared
> [eDEX-UI](https://github.com/GitSquared/edex-ui) 的非官方移植项目，不由 GitSquared 或上游贡献者维护、认可或背书。

## 为什么做这个项目

| 产品体验 | 工程约束 |
| --- | --- |
| 构建完整的全屏指挥舱，而不是静态的终端风格页面 | 从截图对应时期的 eDEX-UI 源码出发进行复刻 |
| 终端、文件、内容、遥测、键盘、动效和声音共享状态 | 使用不可变参考证据和确定性的浏览器采集 |
| 保持桌面高保真，同时提供明确的移动端降级 | 以分区域像素与感知预算构成可执行验收门禁 |
| 同时覆盖鼠标、实体键盘、屏幕键盘和触摸路径 | 有界修复流程不能修改目标证据或放宽判定器 |

## 你可以做什么

- 运行完整启动序列，体验分阶段面板显现、上游原始音效、重放和持续可见的声音控制。
- 通过实体键盘、QWERTY 屏幕键盘、鼠标或触摸操作终端，并观察整个指挥舱的联动反馈。
- 浏览安全的虚拟文件系统，通过终端命令或直接操作打开仓库中的文章和图片画廊。
- 观察时钟、进程、CPU、内存、网络流量和地球持续更新，同时保持渲染器与业务状态解耦。
- 在任意桌面视口中使用固定 1920×1080 构图，或在小屏设备进入明确的移动端降级模式。
- 复现标准场景、检查分区域差异，并为每次验证生成可追溯证据。

## 快速开始

需要 Node.js 22 和 npm。

```bash
git clone https://github.com/Seker800/SekerEdexWebLab.git
cd SekerEdexWebLab
npm ci
npm run app:dev
```

打开命令行输出的本地地址，然后选择 **Initialize system**。使用 **REBOOT** 重放启动序列，
使用 **SOUND ON/OFF** 控制声音。

安装浏览器引擎并运行完整的本地验收门禁：

```bash
npm run install:browsers
npm run verify
```

## 系统如何协作

```text
实体键盘 / 屏幕键盘 / 鼠标 / 触摸输入
                    │
                    ▼
              类型化命令与意图
                    │
                    ▼
             会话控制器 + 事件总线
           ┌────────┼─────────┐
           ▼        ▼         ▼
         终端      遥测      内容 / 文件
           └────────┼─────────┘
                    ▼
               视觉与声音反馈
```

React 只管理可声明的界面状态。终端渲染、地球、JPEG 故障效果、音频和定时动画等命令式系统都
封装在可销毁适配器之后。浏览器观察、图像比较、结果判定和可选源码修复保持独立的进程边界；
只有可执行门禁有权判定场景是否通过。

### 仓库导览

| 路径 | 职责 |
| --- | --- |
| [`apps/clone`](apps/clone) | 浏览器应用与复制素材的来源记录 |
| [`content/blog`](content/blog) | 仓库内文章与媒体内容 |
| [`src`](src) | 场景配置、采集编排、判定与修复协议 |
| [`scripts`](scripts) | 应用、素材、门禁和复刻验证入口 |
| [`specs`](specs) / [`schemas`](schemas) | 场景合同与进程边界类型数据 |
| [`references`](references) | 固定的上游源码和视觉证据 |

扩展系统前请先阅读 [NORTH_STAR.md](NORTH_STAR.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 和
[视觉北极星](docs/VISUAL_NORTH_STAR.md)。模块级上游源码索引位于
[docs/SOURCE_PORT_MAP.md](docs/SOURCE_PORT_MAP.md)。

## 验证体系

`npm run verify` 会检查门禁完整性、上游素材哈希、类型、测试、覆盖率、生产构建、演示流程、
Chromium 与 WebKit 行为、分区域视觉预算以及确定性复刻流程。

| 命令 | 用途 |
| --- | --- |
| `npm run app:verify` | 在 Chromium 中验证启动、音频、交互、布局和浏览器错误门禁 |
| `npm run app:verify:webkit` | 在 WebKit 中验证核心交互、画布几何、移动降级和浏览器错误 |
| `npm run app:hotspots` | 排出视觉差异最明显的 64×64 区域 |
| `npm run assets:verify` | 根据 SHA-256 清单检查复制的上游素材 |
| `npm run replicate:verify` | 运行冻结视觉目标的复刻状态机 |
| `npm run replicate:repair` | 运行最多三次受保护、源码优先的修复尝试 |

报告和截图会写入 `artifacts/`，并被有意排除在发布内容之外。

## 项目状态

0.1 版本是 Phase 0 可行性构建。启动与声音序列、核心交互路径、桌面与移动视口、内容浏览器、
媒体查看器和浏览器错误门禁已经实现，并纳入仓库的验收流程。

终端和遥测使用明确标注、对浏览器安全的模拟数据；它不是远程 Shell 或真实主机监控器。认证会话、
路由爬取、网络契约对比和真实主机遥测仍是后续扩展点。本项目不宣称自己是原始桌面应用的直接替代品。

## 来源与可追溯性

原始应用由 [GitSquared](https://github.com/GitSquared) 创建，并以 GPLv3 发布。本项目的标准界面
来源是 `v2.2.0` 标签之后的提交
[`66ba190`](https://github.com/GitSquared/edex-ui/commit/66ba190ee5369523195c4012d0a798fbe4d43391)。
较新的 [`v2.2.8`](https://github.com/GitSquared/edex-ui/releases/tag/v2.2.8) 仅作为次要代码和素材参考。
冻结目标的完整定义见[视觉复刻合同](docs/visual-parity.md)。

作者和第三方鸣谢见 [NOTICE.md](NOTICE.md)，文件级复制素材清单见
[apps/clone/UPSTREAM_ASSETS.md](apps/clone/UPSTREAM_ASSETS.md)。

## 参与贡献

欢迎提交 Issue 和 Pull Request。修改源码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)；除常规测试外，
本项目还要求通过来源检查和确定性视觉门禁。

## 许可证

SekerEdexWebLab 与原始 eDEX-UI 一致，使用 [GNU General Public License v3.0](LICENSE) 发布。
上游代码和素材的版权仍归各自作者所有。
