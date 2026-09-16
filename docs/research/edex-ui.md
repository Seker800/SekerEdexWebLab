# eDEX-UI 参考记录

## Authoritative source

- Repository: <https://github.com/GitSquared/edex-ui>
- Reference tag: `v2.2.8`
- License: GPL-3.0
- Status: upstream archived in 2021

不要把低关注度 fork 当作上游依据。引用代码、提交或行为时优先链接原仓库和固定 tag。

## Locked visual reference

Phase 0 的唯一视觉基准是上游 README 中的默认截图：

- Caption: `neofetch on eDEX-UI 2.2 with the default "tron" theme & QWERTY keyboard`
- Path: `media/screenshot_default.png`
- Commit: `04a00c4079908788b371c6ecdefff96d0d9950f8`
- Native size: 1934×1094
- Opaque UI bounds: `(5, 5)` through `(1924, 1084)`, exactly 1920×1080
- SHA-256: `c72ddbab1fc89c9ceb35ab18e864084f603861ba629ec72bd072ea9015173ef4`
- Source: <https://github.com/GitSquared/edex-ui/blob/04a00c4079908788b371c6ecdefff96d0d9950f8/media/screenshot_default.png>

参考截图不复制进仓库，只通过固定上游地址和摘要识别。其他官方截图可用于理解组件行为，
不能混入首个视觉基准。

PNG 外层含透明和抗锯齿边缘；像素 alpha 大于 127 的包围区域是 `(5, 5)` 开始的
1920×1080。视觉比较以该裁剪为准，项目逻辑画布因此固定为 16:9。

## What we study

- 固定全屏模块比例和视觉层级。
- 启动、自检、扫描、授权与错误反馈的时间组织。
- 中央终端、文件系统、监控、地球和键盘之间的联动。
- 实体键盘映射到屏幕键盘的即时反馈。
- 高频小音效如何强化触感。
- 无用户操作时仍保持运行感的动态密度。

## What we do not copy by default

- Logo、项目名称和品牌表现。
- 截图、演示媒体和原始音频。
- 字体文件与文件图标子模块。United Sans 只允许从本地忽略目录临时加载，不进入仓库。
- Electron、本地 shell、PTY、系统进程和文件系统访问实现。
- 未经文件级来源核查的第三方 vendor 代码。

## Import procedure

若复用上游实现确实比重写更合理，变更必须同时包含：

1. 固定的上游 commit 或 tag。
2. 原文件路径与本仓库目标路径。
3. 许可证和版权声明。
4. 修改摘要。
5. 为什么复用优于重新实现。
6. 对整个发布物许可证边界的影响。

未完成以上记录时不得复制代码或素材。
