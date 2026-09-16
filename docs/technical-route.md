# SekerEdexWebLab 技术路线

## 结论

项目采用静态优先的混合渲染路线：

| 层 | 选择 | 用途 |
| --- | --- | --- |
| 站点与内容 | Astro，静态输出 | 路由、内容集合、构建期 HTML、SEO 和直接访问 |
| 交互界面 | React + TypeScript strict | 全屏工作台、面板状态、输入反馈和内容查看器 |
| 终端 | xterm.js + Fit + WebGL addon | ANSI、字符网格、光标、选择、尺寸适配和终端质感 |
| 地球 | Three.js 直接封装 | 点阵地球、标记、连线和受控动画循环 |
| 实时图表 | 原生 Canvas 2D | CPU、内存和网络曲线的精确线宽、网格与采样节奏 |
| 主体视觉 | 语义 DOM + CSS Grid + CSS 自定义属性 | 三栏、底部区域、切角、线框、刻度和响应式布局 |
| 声音 | 原生 Web Audio API | 用户手势解锁后的程序化按键、扫描、成功和错误音效 |
| 状态 | 框架无关 TypeScript 会话引擎 | 命令、intent、状态转换、虚拟文件系统和领域事件 |
| 测试 | Vitest + Playwright | 纯逻辑、键盘交互、浏览器行为、截图和视觉回归 |

基础工具链使用 Node.js 22 LTS 与 pnpm 10。依赖的精确版本由首个 lockfile 固定，不在文档中
手工维护易过期的小版本号。

## 为什么这样组合

### Astro 负责站点，React 负责设备

个人站需要可索引的文章、作品固定链接、元数据和静态部署；Cyberdeck 又需要长期运行的复杂
客户端状态。Astro 在构建期生成页面和内容清单，一个 `CyberdeckApp` React 岛承载桌面交互。
文章、摄影和项目只保留一份内容事实，既生成固定 URL，也注入虚拟文件系统。直接访问内容
URL 时，工作台以对应内容为初始状态打开；移动降级模式读取同一内容对象。

不选择纯 React SPA，因为它会让静态内容、直接访问和 SEO 额外依赖预渲染补丁。不选择
Next.js，因为当前没有账号、数据库、服务端动作或按请求渲染需求。

### DOM、Canvas 与 WebGL 各做擅长的部分

整个界面不能画在单张 Canvas 上。标题、终端辅助输入、文件、按键和文章需要语义、选择、
焦点与响应式布局，所以主骨架使用 DOM/CSS。高频折线放在 Canvas，点阵地球放在 WebGL，
避免 React 因每帧数据更新而重渲染整个工作台。

主体布局使用 CSS Grid 和少量绝对定位。`#aacfd1`、`#05080d`、`#000000`、`#262828`
等默认 `tron` 色值进入视觉 token；几何尺寸从 1934×1094 参考画布推导。首版不引入
Tailwind、组件库或通用图表库，以免抽象层妨碍逐像素调校。

### 终端保留 xterm.js，shell 重新定义

上游本身使用 xterm.js。新版实现继续使用 xterm.js，以保留 ANSI、光标、选择、字符宽度和
WebGL 渲染能力，但不连接 PTY、WebSocket 或服务器 shell。`BrowserShell` 只接受白名单命令，
读取只读虚拟文件系统，并产生类型化 intent：

```text
keyboard / pointer
        ↓
InputCommand
        ↓
BrowserShell ──→ TerminalOutput
        └──────→ NavigationIntent ──→ SessionEngine
```

`help`、`ls`、`cd`、`open`、`clear` 与 `theme` 是应用命令，不执行用户输入的 JavaScript、
系统命令或远程代码。WebGL 上下文丢失时，终端销毁 WebGL addon 并回退到 xterm.js 的 DOM
渲染器。

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
DOM；静音和音量是持久会话偏好。

## 状态与模块边界

核心状态不依赖 React：

```text
src/
  pages/                 Astro 路由与静态入口
  content/               文章、摄影、设计案例
  content.config.ts      内容 schema 与集合
  cyberdeck/
    core/                命令、事件、状态机、虚拟文件系统
    adapters/            键盘、指针、可见性、浏览器指标
    renderers/           xterm、Three.js、Canvas、Web Audio
    features/            shell、terminal、telemetry、keyboard、viewer
    styles/              token、基准几何、响应式和减少动态效果
  tests/
    unit/
    e2e/
    visual/
```

`SessionEngine` 接收 discriminated union 命令，运行纯转换并发布不可变快照与领域事件。
React 通过窄订阅接口读取所需切片；高频渲染器直接订阅专用数据源。首版不引入通用全局状态
库和无类型事件总线，只有出现无法由现有契约表达的真实需求时才重新评估。

## 内容模型

Astro content collections 定义三类数据：

- `posts`：Markdown/MDX 正文、摘要、日期、标签和封面。
- `photography`：作品组、图片元数据、说明和拍摄信息。
- `projects`：设计案例、角色、过程、成果和媒体清单。

构建阶段从集合生成路由与只读 `VirtualFsManifest`。终端命令和鼠标文件浏览器都通过同一个
内容 ID 打开对象，不能各自维护路径映射。

## 遥测真实性

浏览器无法安全读取访客设备的真实 CPU 温度、进程表或系统内存。遥测 provider 分为：

- `BrowserTelemetry`：Performance API、连接状态、帧率、会话时长等可真实取得的数据。
- `DemoTelemetry`：为复刻参考画面生成的确定性序列，界面必须标记为 `SIMULATED`。
- `SessionTelemetry`：命令数、打开内容数、输入速率等本站会话数据。

渲染器只接收统一采样结构，不知道数据来自哪个 provider。

## 字体与素材

- 终端采用具有明确开放许可的 Fira Mono 自托管版本，不直接复制上游字体文件。
- 上游使用的 United Sans 必须完成独立许可证核查；未确认前不得提交。
- UI 字体先做字宽、字高、数字形状和大写字母 specimen 对比，再确定开放许可替代字体。
- 原版 WAV、截图和 vendor globe bundle 不进入应用；视觉和声音均独立实现。

United Sans 的许可结论会决定字体层面的最终像素差异，是开始视觉验收前必须关闭的资产问题。

## 验证门禁

首个脚手架必须提供一个 `pnpm ci:check`，依次覆盖：

1. 格式检查。
2. ESLint 与 Astro/TypeScript 严格检查。
3. Vitest 纯逻辑和状态转换测试。
4. Astro 静态生产构建。
5. Playwright Chromium/WebKit 核心交互测试。

视觉验证固定浏览器版本、字体、设备缩放和动画时钟：

- 1934×1094：对上游固定参考图生成实现图与差异图。
- 1920×1080：主部署构图和交互截图。
- 1440×900：受控适配截图。
- 移动视口：终端/内容降级路径，不参加桌面一比一比较。

上游参考图下载到被 Git 忽略的缓存目录，并核对文档记录的 SHA-256。项目提交自己的测试基线
与差异报告，不提交上游截图副本。

## 首个垂直切片顺序

1. 建立 Astro + React + TypeScript strict、pnpm lockfile 和验证门禁。
2. 用 DOM/CSS 完成 1934×1094 静态几何骨架与 `tron` token。
3. 接入 xterm.js，显示固定 `neofetch` 状态并完成尺寸校准。
4. 接入 Canvas 曲线和统一调度器。
5. 接入 Three.js 点阵地球及生命周期回收。
6. 建立启动状态机、实体键盘与屏幕键盘同步。
7. 加入 Web Audio 和静音控制。
8. 建立视觉差异流程，通过后再接入真实博客内容。

每一步都保持可运行、可截图、可回退；不得在同一轮同时建设多主题、CMS 或服务端 shell。
