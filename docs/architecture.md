# SekerEdexWebLab Architecture

## North star

SekerEdexWebLab 是一个浏览器中的实时个人终端。它应让访问者感觉自己进入了一台正在运行的
Cyberdeck：中央终端、文件系统、遥测面板、活动日志、声音与屏幕键盘共享同一会话状态。

当前 North Star 是先验证高保真体验，再将其扩展为长期可维护的个人站。技术路线已经在
`adr/0003-web-technology-route.md` 中锁定，框架不能代替视觉和交互验收。

## Locked reference profile

Phase 0 只实现一个参考配置：eDEX-UI 2.2、默认 `tron` 主题、QWERTY 键盘和中央
`neofetch` 输出。参考画面中的三栏结构、底部文件系统与屏幕键盘、面板比例、线框、切角、
网格、字号层级和灰蓝色阶构成第一阶段不可随意改写的视觉合同。

桌面 Shell 始终在固定 1920×1080 逻辑画布中布局。浏览器视口不是 16:9 时，只允许按
`min(viewportWidth / 1920, viewportHeight / 1080)` 等比缩放、居中并留出背景边，不允许为了
填满视口重新排列或非等比拉伸面板。

主题系统、其他 eDEX-UI 皮肤和持续故障效果不进入首个垂直切片。

## Experience direction

```text
用户输入（实体键盘 / 屏幕键盘 / 鼠标 / 触摸）
                         ↓
                  command + intent
                         ↓
              session state / event bus
          ↙                              ↘
  terminal renderer                 telemetry models
          ↘                              ↙
              visual feedback + audio cues
```

模块通过稳定事件和状态契约协作。终端不得直接修改监控图表 DOM，屏幕键盘也不得通过查询
选择器猜测终端状态。

核心会话是与框架无关的 TypeScript 模块。输入适配器把实体键盘、屏幕键盘、鼠标和触摸
转换成类型化命令；会话引擎产生不可变快照与领域事件；React、xterm.js、Three.js、Canvas
和 Web Audio 只消费这些输出。渲染器不得成为业务状态的唯一持有者。

## Expected module boundaries

名称描述职责，不指定具体框架：

| 模块 | 职责 |
| --- | --- |
| shell | 固定全屏布局、面板生命周期、焦点与降级模式 |
| terminal | 命令输入、历史、补全、输出和可访问输入路径 |
| virtual-fs | 提供可导航的浏览器安全只读目录 |
| content | 从仓库 Markdown 与媒体生成经过校验的类型化内容清单、内容树和安全相对引用 |
| telemetry | 提供真实浏览器指标、会话指标和明确标注的模拟设备指标 |
| keyboard | 显示布局、实体按键同步、触摸输入和组合键状态 |
| audio | 用户手势解锁、音效播放与音量控制 |
| motion | 启动、面板、扫描、故障与恢复动画 |
| scheduler | 统一管理周期采样和逐帧渲染，随页面可见性启停 |

当前浏览器实现通过 `CommandDeckController` 落实上述状态边界：所有输入路径发送类型化 intent，
控制器返回不可变快照，DOM 层只负责渲染和焦点。页面级 `DisposableRegistry` 统一释放事件监听、
音频、启动任务、Globe 渲染器与调度器，避免重启、隐藏页面或热重载后遗留写入者。

博客内容位于仓库级 `content/blog`。`apps/clone/vite.config.ts` 在构建边界发现 Markdown 与受支持
的图片，内容注册表使用 YAML 与 Zod 校验 frontmatter、路径碰撞、图片 alt 和相对资源，再生成不含
解析器运行时代码的类型化清单。内容树保留仓库真实层级并挂载到 `/home/squared/Blog`；canonical
eDEX 目录独立挂载到 `/home/squared/.config/eDEX-UI`，静态参考模式不接收个人内容。虚拟文件系统
只投影目录、文件和预览，不拥有内容发现逻辑；投影边界根据内容节点类型分配项目自有的 `markdown`
与 `image` 图标语义，界面不解析扩展名猜测类型。文章链接、文件点击与 hash 地址统一发送类型化
content intent；Blog 外的沙箱目录写入类型化 `history.state`，文章内锚点只在阅读器中定位，二者都不
占用内容 hash 路由。文章与图片作为两种内容视图挂载到同一个 `FullscreenContentOverlay`：它统一
全屏几何、背景隔离、关闭按钮、Escape 行为和生命周期，并在打开时把整个 command deck 切换为
`inert` 与 `aria-hidden`。图片序列、缩放、关闭与浏览器历史仍走同一 content route，不建立第二套
弹层状态。图片显现由查看器内部的一次性、可取消状态机管理：真实图片解码完成后，查看器按
`object-fit: contain` 计算实际媒体边界，并用引用同一媒体资源的 10×6 裁片重建画面；裁片从主题蓝
逐块恢复原色后才切换到原始图片元素。切图、关闭或销毁会使旧异步结果失效，减少动态效果时直接
进入就绪状态。

内容发现只接受内容根内的真实普通文件和目录，符号链接与其他特殊文件会使构建失败；开发服务器
监听内容根并通过 Vite 7 `hotUpdate` 在新增、删除或修改内容时失效虚拟清单。当前阶段把 Markdown 正文保留在清单中，是为
了让阅读器与同步终端 `cat` 共享完全相同的文件内容。若实际内容规模证明首屏预算不足，应先引入
异步 content repository 端口并同时迁移终端读取协议，不能只把阅读器改成惰性加载而让虚拟文件为空。

## Invariants

- 桌面主页是固定单屏工作台，不通过整页纵向滚动承载主要内容。
- 桌面工作台保持 16:9；非 16:9 视口通过等比缩放和留边承载同一构图。
- 用户可以只用鼠标完成核心路径，也可以只用键盘完成核心路径。
- 点击文件与输入命令收敛到同一个 intent，不维护两套导航事实。
- 真实数据和模拟数据在模型与界面上均可区分。
- 音频不阻塞使用；声音控制、减少动态效果和性能降级是正式状态。
- 每个持续动画都有统一调度和暂停机制，页面隐藏时停止无意义工作。
- 第三方实现只有在来源和许可证记录完成后才能进入代码库。
- 可行性原型也必须有可删除边界，不把临时实验渗透成长期核心。

## Feasibility slices

### Slice 1 — living shell

完成全屏布局、启动序列、中央终端、两侧活动面板和持续时钟/图表，证明画面能够“活着”。

### Slice 2 — synchronized input

加入完整屏幕键盘、实体键盘同步、鼠标点击按键、命令历史和程序化音效，证明反馈链闭环。

### Slice 3 — fidelity and limits

完成桌面视觉对比、性能测量、减少动态效果、移动端降级并记录最终可行性结论。

## Decision rule

按 ADR 0003 建立 Slice 1 与 Slice 2。只有实际测量证明所选渲染器无法满足视觉、交互或性能
合同，才能替换对应适配器；不能因为实现困难就整体换栈。若原型不能在目标视口和性能预算
内成立，应记录失败原因并调整体验目标，不能用静态假界面宣布完成。
