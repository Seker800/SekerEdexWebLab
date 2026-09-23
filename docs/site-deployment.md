# 网站程序发布

本流程只发布网站程序，不发布作者文章或照片。内容发布的唯一入口是 `npm run publish:content`；即使
`.env.local` 配置了 `SEKER_CONTENT_ROOT`，网站构建也会移除该变量并强制使用运行时内容模式。

## 所有权合同

网站发布拥有根目录入口、`assets/` 和 `deployment.json` 等程序对象，但不拥有 `content/`。脚本对每个
上传或删除对象执行命名空间检查；任何 `content/` 路径都会使网站发布失败。

网站产物中的 `deployment.json` 格式为：

```json
{
  "schemaVersion": 2,
  "site": {
    "revision": "完整 Git 提交"
  }
}
```

它不得记录内容摘要，也不得被当作内容发布状态。当前内容版本只看 `content/current.json`。

## 发布前门禁

1. 阅读 `docs/deployment.md`，确认本次目标确实是网站程序。
2. 检查 `git status --short`，不得覆盖或夹带无关修改。
3. 完成本次改动要求的全部本地门禁；至少运行静态检查、单元测试和生产构建。视觉、动画或交互变更还要
   完成项目规定的浏览器与视觉验证。
4. 使用中文类型和 DCO 签名提交，只执行普通 push 到 `origin/main`。
5. 确认本地分支为 `main`，`HEAD` 与 `origin/main` 完全一致，并等待该提交的 GitHub CI 全绿。

## 唯一执行入口

```sh
npm run deploy:site
```

脚本会在临时 Git worktree 中检出已推送的提交，安装锁定依赖，运行发布边界门禁、类型检查、单元测试和
生产构建。构建环境固定为 `SEKER_CONTENT_DELIVERY=runtime`，并删除 `SEKER_CONTENT_ROOT` 与
`SEKER_CONTENT_PROFILE`，因此作者源文件不会被读取、复制或打包。

上传顺序是哈希资源和普通文件、`index.html`、站点文件索引、`deployment.json`。公网版本验证成功后，
脚本只根据上一版 `site-files.json` 清理明确登记的旧站点对象；它不枚举或推断 Bucket 中的内容对象，
随后再次刷新 CDN。无论成功或失败都会移除临时 worktree。

## 完成标准

只有以下条件全部满足，才可报告网站发布成功：

1. `npm run deploy:site` 正常退出。
2. `https://www.seker.wang/deployment.json` 返回 `200`，`schemaVersion` 为 `2`，`site.revision` 与本地
   `git rev-parse HEAD` 完全一致，并使用 `Cache-Control: no-store`。
3. 首页返回 `200` 且使用 `Cache-Control: no-cache`。
4. 对应提交的 GitHub CI 全绿。
5. 发布前后的 `content/current.json` 不因本次网站发布而改变。

## 回滚与故障

- 网站回滚：把目标历史状态恢复为新的 `main` 提交，完成 CI 后重新运行 `npm run deploy:site`。
- OAuth、CI、构建或公网核验失败：修复根因后从同一入口重试，不得切换上传方式。
- 内容不可用不授权网站发布显示示例；运行时会保留作者内容挂载点并进入明确的内容错误状态。
- 网站发布不得通过重新发布内容来掩盖程序问题。

内容发布入口仍为 `npm run publish:content`，详见 `docs/content-publishing.md`；本流程不得代替它。
