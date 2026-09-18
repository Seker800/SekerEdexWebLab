# SekerEdexWebLab 技术路线

## 结论

项目采用静态优先的双应用路线：冻结的 `apps/clone` 负责参考复刻和证据，博客应用负责内容、
路由与发布。两者只通过显式 token、素材清单和类型化导航契约共享能力。

| 层 | 选择 | 用途 |
| --- | --- | --- |
| 博客站点 | Astro，静态输出 | 内容集合、路由、构建期 HTML、SEO 和直接访问 |
| 参考应用 | Vite + TypeScript strict | 冻结的全屏工作台、视觉证据和交互回归 |
| 博客命令入口 | 语义 DOM + TypeScript | 白名单导航、搜索、焦点与可访问反馈 |
| 地球 | Three.js 直接封装 | 点阵地球、标记、连线和受控动画循环 |
| 实时图表 | 原生 Canvas 2D | CPU、内存和网络曲线的精确线宽、网格与采样节奏 |
| 主体视觉 | 语义 DOM + CSS Grid + CSS 自定义属性 | 固定 16:9 三栏、底部区域、切角、线框和刻度 |
| 声音 | 原生 Web Audio API | 用户手势解锁后的程序化按键、扫描、成功和错误音效 |
| 状态 | 框架无关 TypeScript 会话引擎 | 命令、intent、状态转换、虚拟文件系统和领域事件 |
| 测试 | Vitest + Playwright | 纯逻辑、键盘交互、浏览器行为、截图和视觉回归 |

基础工具链使用 Node.js 22 LTS 与 pnpm 10。依赖的精确版本由首个 lockfile 固定，不在文档中
手工维护易过期的小版本号。

## 为什么这样组合

### Astro 负责博客，参考应用保持独立

站点需要静态部署、稳定入口和可索引的完整内容；Cyberdeck 又有固定画布、持续动画和历史视觉
门禁。Astro 在构建期生成博客页面，可选的交互岛只承载命令面板、搜索和入口反馈。冻结的
`apps/clone` 继续使用自身 Vite 入口，不被嵌入文章正文，也不向博客泄漏全局样式。

不选择纯 SPA，因为它会让静态内容、直接访问和 SEO 依赖额外预渲染补丁。不选择 Next.js，
因为 V1 没有账号、数据库、服务端动作或按请求渲染需求。没有出现复杂共享客户端状态前，博客
也不引入站点级 React 状态树。

### DOM、Canvas 与 WebGL 各做擅长的部分

整个界面不能画在单张 Canvas 上。标题、终端辅助输入、文件和按键需要语义、选择、
焦点与固定画布缩放，所以主骨架使用 DOM/CSS。高频折线放在 Canvas，点阵地球放在 WebGL，
避免 React 因每帧数据更新而重渲染整个工作台。

主体布局使用 CSS Grid 和少量绝对定位。`#aacfd1`、`#05080d`、`#000000`、`#262828`
等默认 `tron` 色值进入视觉 token；几何尺寸从裁剪后的 1920×1080 参考内容推导。Shell
内部只按该逻辑画布布局，外层 `ViewportScaler` 负责等比缩放和居中留边。首版不引入
Tailwind、组件库或通用图表库，以免抽象层妨碍逐像素调校。

### 参考终端与博客命令入口分离

`apps/clone` 保留已经验证的安全命令会话，不连接 PTY、WebSocket 或服务器 shell。博客不需要
ANSI、字符网格或 `curses`，因此命令入口使用语义化输入框、结果列表和状态区域。两者都只接受
白名单命令，并产生类型化导航 intent：

```text
keyboard / pointer
        ↓
InputCommand
        ↓
BlogCommandParser ──→ AccessibleFeedback
             └──────→ NavigationIntent ──→ ContentRegistry
```

博客命令固定为 `help`、`home`、`posts`、`search`、`open`、`tags`、`projects`、`about` 与
`clear`，不执行用户输入的 JavaScript、系统命令或远程代码。普通链接、命令和文件隐喻必须
通过同一个 `ContentRegistry` 解析 URL。

### 地球与图表不经过 React 帧循环

Three.js 地球封装成 `GlobeRenderer`，Canvas 图表封装成 `TelemetryChartRenderer`。二者实现
统一的 `mount`、`resize`、`render`、`pause` 与 `dispose` 生命周期，不暴露内部 DOM。
不采用 React Three Fiber：当前只有一个受控场景，直接 Three.js 更容易匹配上游镜头、点阵
和线条，也减少 React 调度与 WebGL 生命周期之间的耦合。

所有持续任务由 `FrameScheduler` 管理：视觉帧使用 `requestAnimationFrame`，遥测按各自低频
采样，页面隐藏时暂停，恢复时从最新状态继续。组件内部不得建立无法统一关闭的定时器。

### 音效采用程序化合成

Web Audio 在首次用户手势后创建或恢复 `AudioContext`。按键、扫描、成功、拒绝和错误由短促
振荡器、滤波器和包络组合生成，不复制上游 WAV。音频层消费领域事件，不读取按钮或终端的
DOM；声音开关和音量是持久会话偏好。

## 状态与模块边界

博客核心状态不依赖 UI 框架：

```text
apps/
  clone/                 冻结参考应用与视觉门禁
  blog/
    src/content/         Markdown/MDX 与内容 schema
    src/pages/           Astro 静态路由
    src/domain/          内容 registry、搜索和导航 intent
    src/components/      语义内容组件与可选交互岛
    src/styles/          博客 token、排版与响应式规则
tests/                   共享纯逻辑与复刻工具测试
```

`ContentRegistry` 在构建期提供文章、标签、项目和搜索数据。`NavigationController` 接收
discriminated union intent 并输出站内 URL 或可访问反馈。交互岛只读取必要切片；V1 不引入
通用全局状态库和无类型事件总线。

## 遥测真实性

浏览器无法安全读取访客设备的真实 CPU 温度、进程表或系统内存。遥测 provider 分为：

- `BrowserTelemetry`：Performance API、连接状态、帧率、会话时长等可真实取得的数据。
- `DemoTelemetry`：为复刻参考画面生成的确定性序列，界面必须标记为 `SIMULATED`。
- `SessionTelemetry`：命令数、输入速率和会话时长等本站会话数据。

渲染器只接收统一采样结构，不知道数据来自哪个 provider。

## 素材

上游素材的来源、版本、目标路径和许可证统一记录在资产清单与仓库级 NOTICE 中，不在技术路线
里重复设置素材级发布门禁。

## 验证门禁

博客脚手架必须提供可执行的统一门禁，依次覆盖：

1. 格式检查。
2. ESLint 与 Astro/TypeScript 严格检查。
3. Vitest 纯逻辑和状态转换测试。
4. Astro 静态生产构建。
5. Playwright Chromium/WebKit 核心交互测试。

视觉验证固定浏览器版本、设备缩放和动画时钟：

- 1920×1080：裁剪上游固定参考图，生成实现图与差异图。
- 1440×900：验证完整工作台缩放为 1440×810，上下各留 45 像素背景边。
- 移动视口：终端降级路径，不参加桌面一比一比较。

上游参考图下载到被 Git 忽略的缓存目录，并核对文档记录的 SHA-256。项目提交自己的测试基线
与差异报告，不提交上游截图副本。

## Blog V1 垂直切片顺序

1. 建立 Astro 静态应用、内容 schema、文章路由和验证门禁。
2. 完成首页、文章、标签、项目、关于、404、RSS 与站点地图。
3. 建立构建期搜索索引、命令面板和统一导航 intent。
4. 提取 `tron` token，把指挥舱作为可选入口接入内容 registry。
5. 用真实站点/会话数据替换入口中的模拟遥测。
6. 关闭 SEO、无障碍、响应式、性能和跨浏览器门禁。

每一步都保持可运行、可直接访问和可回退；不得在同一轮引入账号、评论、CMS 或服务端 shell。
