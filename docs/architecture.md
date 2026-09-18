# SekerEdexWebLab Architecture

## North star

SekerEdexWebLab 的长期产品是一个具有 eDEX 指挥舱入口的个人技术博客。访问者首先获得具有
辨识度的 Cyberdeck 氛围，随后可以直接发现、阅读、搜索和分享文章与项目。中央终端、文件面板
和普通导航共享同一内容索引；它们是内容入口，不模拟一台完整桌面电脑。

Phase 0 已完成高保真体验验证。博客演进边界由 `adr/0005-blog-product-boundary.md` 锁定：
`apps/clone` 继续承担冻结参考和视觉证据，文章路由建立独立的静态内容边界。技术路线已经在
`adr/0003-web-technology-route.md` 中锁定，框架不能代替视觉、内容和交互验收。

## Blog product boundary

- 指挥舱负责品牌入口、导航反馈和氛围；文章页面负责阅读、SEO 和分享。
- 终端只执行白名单博客命令，不连接 PTY 或远程 shell。
- 文件面板展示文章、标签和项目，不访问访客磁盘。
- 遥测只展示真实站点、构建或会话数据，不模拟主机状态。
- 屏幕键盘、地球和密集动态图表不常驻文章页面。
- 文章页面不受固定 1920×1080 画布约束，并必须在无 JavaScript 时可用。

实现范围和阶段见 `specs/blog-v1/01-spec.md` 与 `specs/blog-v1/02-task-contract.md`。

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
| telemetry | 提供真实浏览器指标、会话指标和明确标注的模拟设备指标 |
| keyboard | 显示布局、实体按键同步、触摸输入和组合键状态 |
| audio | 用户手势解锁、音效播放与音量控制 |
| motion | 启动、面板、扫描、故障与恢复动画 |
| scheduler | 统一管理周期采样和逐帧渲染，随页面可见性启停 |

当前浏览器实现通过 `CommandDeckController` 落实上述状态边界：所有输入路径发送类型化 intent，
控制器返回不可变快照，DOM 层只负责渲染和焦点。页面级 `DisposableRegistry` 统一释放事件监听、
音频、启动任务、Globe 渲染器与调度器，避免重启、隐藏页面或热重载后遗留写入者。

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
