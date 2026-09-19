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

## 当前开发流程

当前原型使用 Node.js 22、npm、Vite 和严格 TypeScript。完整本地门禁为 `npm run verify`，
依次执行基准策略完整性、上游资产、静态检查、单元测试、生产构建、演示场景、Chromium、
WebKit 和冻结视觉复刻验证。

CI 将这些职责拆成 `gate-integrity`、`source`、`app-chromium`、`app-webkit` 和
`visual-canonical`。主分支应把五项全部配置为 required checks。基准、合同、判断器、门禁脚本、
上游资产和许可证由 `.github/CODEOWNERS` 保护；更新这些文件必须保留来源、差异证据和审核记录。

自动修复只能写入 `apps/clone/src` 与 `content/blog`。不得为了通过门禁扩大可写范围、放宽阈值、
修改参考证据、资产哈希或判定器。

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
