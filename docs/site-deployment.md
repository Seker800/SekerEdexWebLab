# 网站程序发布

本流程只发布阿里云静态网站程序，不发布作者文章、照片、视频或内容服务代码。作者内容由独立数据库后台管理，见 `docs/content-publishing.md`。只需在本机看效果或运行门禁时请走 [本地测试与预览](local-testing.md)，不要执行本页的发布入口。本轮只做本地改动，不执行生产发布。

## 所有权合同

网站发布拥有根目录入口、`assets/` 和 `deployment.json` 等程序对象，但不拥有旧的 `content/`。脚本对每个上传或删除对象执行命名空间检查；任何 `content/` 路径都会使网站发布失败。旧对象暂时保留、不迁移。

网站产物中的 `deployment.json` 格式为：

```json
{
  "schemaVersion": 2,
  "site": {
    "revision": "完整 Git 提交"
  }
}
```

它不得记录作者内容摘要或数据库凭据。当前内容由运行时 API 返回；站点与数据库没有共同版本号。

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
生产构建。构建环境固定为 `SEKER_CONTENT_DELIVERY=runtime`，只传递经过白名单筛选的环境变量。执行前必须在作者 Mac 的私有环境中显式设置 `SEKER_CONTENT_API_ORIGIN` 为公开 HTTPS 内容接口域名 origin；它是会进入浏览器包的公开地址，绝不是密码或令牌。缺失、使用 HTTP、localhost 或直接使用 IP 时构建失败。网站构建不会读取 SQLite、媒体目录或后台配置。

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
5. 内容服务数据库与媒体卷不因本次网站发布而改变。

## 回滚与故障

- 网站回滚：把目标历史状态恢复为新的 `main` 提交，完成 CI 后重新运行 `npm run deploy:site`。
- OAuth、CI、构建或公网核验失败：修复根因后从同一入口重试，不得切换上传方式。
- 内容不可用不授权网站发布显示示例；运行时会保留作者内容挂载点并进入明确的内容错误状态。
- 网站发布不得通过重新发布内容来掩盖程序问题。

作者内容只在 `npm run content:serve` 提供的后台修改，详见 `docs/content-publishing.md`；本流程不得代替它。
