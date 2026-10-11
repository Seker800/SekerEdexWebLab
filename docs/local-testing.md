# 本地测试与预览（不发布到生产）

本页只描述开发机上的验证。所有命令都不应连接生产数据库、生产媒体卷或生产后台；
也不执行 Git push、OSS 上传、CDN 刷新或内容服务升级。生产决策从
[发布边界](deployment.md) 开始，不从本页的预览进程推断上线许可。

## 先选要验证的内容来源

| 目标 | 内容来源 | 操作 | 会改变什么 |
| --- | --- | --- | --- |
| 检查网站界面和示例 | 仓库内明确标为 `sample` 的 `examples/blog` | `npm run app:dev` | 只启动本地前端；不代表生产内容 |
| 检查真实 API 交互和后台 | 开发机私有目录中的临时/测试 SQLite 与媒体 | 按下文分别启动 `content:serve` 和 runtime 前端 | 只改变选定的本地测试数据 |
| 自动回归 | 测试脚本创建的隔离测试数据 | `npm run content:integration` 或 `npm run verify` | 只生成本地测试产物，不发布 |

默认 `npm run app:dev` 使用嵌入示例模式；它不会读取内容 API。要验证上线后的网站取数路径，
必须显式选择 runtime 模式。两种模式互斥，不能把样例预览当作作者内容已成功发布的证据。

## 手动联调前后端

1. `npm ci` 安装锁定依赖。将 `services/content-api/.env.example` 复制为同目录的
   `.env.local`，按 [后台内容管理](content-publishing.md#本地启动) 设置本地管理员密码哈希。
   `CONTENT_DATA_DIR` 必须是仓库外的**专用测试目录**，不要指向生产数据、同步盘或现有私人资料库。
   保持 `CONTENT_LISTEN_HOST=127.0.0.1`、`CONTENT_PORT=4175`、
   `CONTENT_ADMIN_ORIGIN=http://127.0.0.1:4175`、
   `CONTENT_PUBLIC_ORIGINS=http://127.0.0.1:4174` 和 `CONTENT_REQUIRE_HTTPS=false`；
   这些 HTTP 设置仅供本机回环联调。
2. 在一个终端启动后台：

   ```sh
   npm run content:serve
   ```

   本机后台位于 `http://127.0.0.1:4175/admin`。空数据库不会自动迁移或复制示例；
   如需观察文章、图片或视频，先在这个**测试后台**添加并发布测试内容。
3. 在另一个终端启动从 API 读取内容的前端：

   ```sh
   SEKER_CONTENT_DELIVERY=runtime SEKER_CONTENT_API_ORIGIN=http://127.0.0.1:4175 npm run app:dev
   ```

   本机前端位于 `http://127.0.0.1:4174`。确认已发布内容可见、草稿不可见；API 断开时应
   显示内容错误/空状态，绝不自动回退示例。测试数据的“发布”只在这个本地数据库生效。
4. 联调结束后在两个终端分别按 Ctrl+C 停止服务。保留或清理测试目录前先核对其确实是
   专用测试目录；**不得**拿生产数据执行清理或重置。

`.env.local`、数据库、媒体、密码哈希、备份和测试时使用的私人内容都不能提交到公开 Git。
如果要单独看示例，停止 runtime 前端后直接运行 `npm run app:dev`，不要在同一个终端继承
`SEKER_CONTENT_DELIVERY=runtime` 等变量。

## 自动门禁与生产的界线

`npm run content:integration` 会临时启动内容 API 和浏览器，验证后台、发布状态、媒体及
前端读取；测试结束后清理其临时数据库。`npm run verify` 是完整本地门禁，包含静态检查、
测试、构建及浏览器/视觉验证。运行这些门禁前先停掉占用 4174/4175 端口的手动预览进程，
避免端口冲突；通过本地门禁**不等于**网站或内容服务已上线。

`npm run app:build` 也是本地构建，不会上传网站。只有在生产发布门禁满足且获得相应授权时，
才按 [网站程序发布](site-deployment.md) 单独执行 `npm run deploy:site`。内容服务程序上线
目前没有获批的自动执行入口；`npm run content-api:build` 只验证服务代码，
`npm run content:serve` 只启动本地进程。作者日常发内容则在已经独立部署的**私有后台**操作，
不构建也不发布网站代码。
