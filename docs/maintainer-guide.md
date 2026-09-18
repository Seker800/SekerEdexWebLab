# 维护者接手指南

## 十分钟了解项目

这是一个包含复刻证据系统、冻结 eDEX 参考应用和下一阶段个人技术博客的仓库。Phase 0 已证明
高保真浏览器体验可行；后续产品开发以内容发现、阅读、搜索、SEO 和可访问性为核心。

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
10. [`adr/0005-blog-product-boundary.md`](adr/0005-blog-product-boundary.md)
11. [`../specs/blog-v1/01-spec.md`](../specs/blog-v1/01-spec.md)
12. [`../specs/blog-v1/02-task-contract.md`](../specs/blog-v1/02-task-contract.md)

## 当前开发流程

复刻应用和验证工具链已经建立并由 `npm run verify` 维护。博客进入新的独立应用边界，采用
Astro 静态输出和严格 TypeScript；实现每个 slice 时同时补充可执行的：

- 安装、开发、测试和生产构建命令。
- Node/运行时版本与 lockfile 策略。
- 格式、静态检查、测试和构建组成的统一 `ci:check` 门禁。
- 截图或视觉回归命令。
- 性能采样方法。

`apps/clone` 的固定画布、模拟数据和全局 CSS 不得直接导入博客。不要在文档中保留无法执行的
占位命令。

## Commit 与 Push

提交前：

```sh
git status --short
```

工具链建立后，再运行 `AGENTS.md` 规定的完整门禁。提交格式：

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
