# 维护者接手指南

## 十分钟了解项目

这是一个验证 eDEX-UI 级别 Web 体验是否可行的实验仓库。先证明运行效果，再决定长期框架。
任何看起来像普通终端主题或静态 HUD 的实现都不能通过验收。

阅读顺序：

1. [`../AGENTS.md`](../AGENTS.md)
2. [`architecture.md`](architecture.md)
3. [`visual-parity.md`](visual-parity.md)
4. [`research/edex-ui.md`](research/edex-ui.md)
5. [`technical-route.md`](technical-route.md)
6. [`adr/0001-reference-and-license-boundary.md`](adr/0001-reference-and-license-boundary.md)
7. [`adr/0002-lock-tron-reference.md`](adr/0002-lock-tron-reference.md)
8. [`adr/0003-web-technology-route.md`](adr/0003-web-technology-route.md)
9. [`adr/0004-fixed-canvas-and-reference-fonts.md`](adr/0004-fixed-canvas-and-reference-fonts.md)
10. [`adr/0005-independent-site-and-content-releases.md`](adr/0005-independent-site-and-content-releases.md)
11. [`adr/0008-record-verified-browser-stack.md`](adr/0008-record-verified-browser-stack.md)（当前技术路线）

多前端规划另见 [`MULTI_FRONTEND_NORTH_STAR.md`](MULTI_FRONTEND_NORTH_STAR.md)：本仓库的
eDEX Web 不负责实现或发布未来的极简前端与中性入口页。

## 当前开发流程

当前原型使用 Node.js 22、npm、Vite 和严格 TypeScript。完整本地门禁为 `npm run verify`，
依次执行基准策略完整性、上游资产、双发布线边界、静态检查、单元测试、内容核心覆盖率、生产构建、演示场景、
Chromium、WebKit 和冻结视觉复刻验证。内容核心的 statements、branches、functions 与 lines
覆盖率均不得低于 80%。

`app:verify:locales` 自动启动临时预览，验证中英文桌面和移动端；`app:verify:resilience`
独立验证 Chromium / WebKit 的存储受限、输入法、缓存恢复、启动跳过和媒体生命周期。
两项均已进入 `verify` 与相应浏览器 CI。恢复回归报告在 `artifacts/resilience`。
`content:integration` 另验证接口挂起、空内容、重试保留直链，以及大目录的真实鼠标滚动。

本机看示例、本机连接测试内容 API、自动门禁分别怎么运行，以及何时必须停下而不触碰生产，
统一见 [本地测试与预览](local-testing.md)。需要真正上线时先从 [发布决策门禁](deployment.md)
选择网站程序、内容服务程序或作者数据的独立流程；本地门禁通过不是发布许可。

CI 将这些职责拆成 `gate-integrity`、`source`、`app-chromium`、`app-webkit` 和
`visual-canonical`。主分支应把五项全部配置为 required checks。基准、合同、判断器、门禁脚本、
上游资产和许可证由 `.github/CODEOWNERS` 保护；更新这些文件必须保留来源、差异证据和审核记录。

视觉预算以固定 macOS 开发环境和 `ubuntu-24.04` CI 的重复采样为边界。当前正式全屏上限为
3.5%，感知全屏上限为 6%，并对五个区域设置独立上限；调整运行平台时必须重新采样并通过
baseline review，不能直接放宽阈值。

自动修复只能写入 `apps/clone/src` 与 `examples/blog`。不得为了通过门禁扩大可写范围、放宽阈值、
修改参考证据、资产哈希或判定器。

## 添加文章、链接、照片与视频

`examples/blog` 只供公开 CI 与本地示例预览，不能保存作者内容。真实内容在独立数据库后台创建、编辑和发布：
本地先按 [`content-publishing.md`](content-publishing.md) 配置 `SekerContentApi` 仓库的 `npm run serve`，粘贴 Markdown、添加 HTTPS 链接或上传 Web 图片/视频。目录由相对路径形成，顺序由 `sortOrder` 控制，草稿不会进入公开 API。图片和视频须提供可访问说明，上传前清理敏感元数据。相对文章链接仍按内容树解析；原始 HTML 不渲染。

内容修改不需要改 `apps/clone/src`、建立公开 Git 提交或重建阿里云网站。只有改变展示方式、API 协议或后台程序时才属于代码改动。静态网站使用 `npm run deploy:site`，内容服务代码另行审查；禁止恢复旧 `publish:content` 静态上传。具体 Git、发布与许可证边界见 [`content-boundary.md`](content-boundary.md) 和 [`deployment.md`](deployment.md)。

文件系统仍将已发布内容按层级挂载到 `/home/squared/Blog`，使用 `#/blog/...` 内容地址；文章、图片和视频共享全屏覆盖层与浏览器历史。示例内容的源码检查仍可运行 `npm run content:check`，但它不是作者内容发布门禁。

## Commit 与 Push

提交前：

```sh
git status --short
```

运行 `npm run verify` 和 `AGENTS.md` 规定的完整门禁。提交格式：

```text
新增: 建立可运行的全屏终端切片
修复: 同步实体键盘与屏幕按键状态
重构: 隔离遥测采样与界面渲染
测试: 固定启动序列状态转换
文档: 记录上游视觉参考边界
```

使用：

```sh
git commit -s
```

若仓库已经配置正确远端且验证通过，Agent 可以普通 push。禁止 force、`--all` 和
`--mirror`。没有远端时不创建远端，只保留本地提交并报告。

## 里程碑交接

- [ ] 当前 Slice 的必选验收项有明确证据。
- [ ] 已知视觉偏差和性能限制已记录。
- [ ] 第三方代码和素材均有来源及许可证。
- [ ] 程序代码与个人内容许可证边界清晰。
- [ ] 工作树干净，提交不包含实验缓存、录屏原件或用户私有内容。
- [ ] 下一阶段目标来自验证结果，而不是提前扩张范围。
