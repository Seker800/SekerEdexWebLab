# 后台内容管理（不发布网站代码）

此流程负责文章、链接、图片、视频、目录与顺序。它不调用 `npm run deploy:site`，也不把作者数据送进公开 Git 仓库。内容服务程序自身升级是另一项代码变更，不能用编辑文章的动作代替。生产内容服务尚未获批上线；上线后日常内容修改应在其私有后台进行，而不是操作本机测试库。

## 本地启动

以下只创建本地测试环境，不会把数据发布到生产。前后端完整联调步骤见
[本地测试与预览](local-testing.md)；不要把测试目录或下列 HTTP 配置用于生产。

1. 将 `services/content-api/.env.example` 复制为同目录 `.env.local`。把 `CONTENT_DATA_DIR` 改成公开仓库之外的绝对私有目录，并确保只有运行用户能读写。
2. 在终端运行 `npm run content:hash-password`，输入至少 16 个字符的管理员密码。把输出的哈希仅填入私有 `.env.local` 的 `CONTENT_ADMIN_PASSWORD_HASH`；明文密码和哈希都不要上传 GitHub。
3. 本地开发使用 `CONTENT_REQUIRE_HTTPS=false`、回环地址 `CONTENT_LISTEN_HOST=127.0.0.1`，并让 `CONTENT_ADMIN_ORIGIN` 与浏览器实际打开的后台 origin 完全相同，包括端口。`CONTENT_PUBLIC_ORIGINS` 列出允许读取内容的静态前端 origin，逗号分隔，不允许 `*`。
4. 运行 `npm run content:serve`，访问 `http://127.0.0.1:4175/admin`。浏览器会要求输入管理员用户名和密码。数据库首次启动为空，不迁移旧样例。此命令只启动本地服务，不部署生产内容服务。

后台可以粘贴 Markdown 正文、保存 HTTPS 外部链接、上传图片或 MP4/WebM 视频。`relativePath` 使用安全的相对目录，例如 `travel/2026/story.md`、`travel/2026/photo.webp`；目录由路径自然形成。`sortOrder` 较小者先显示，同值按路径排序。上传媒体强制先成为草稿，确认文件与说明后再点“发布”；公开 API 只返回已发布项。修改、撤回、删除和调整顺序都只改变数据库或媒体卷，不触碰阿里云网站代码。

媒体上传以原始文件为请求体，目录路径、标题和说明在请求头中使用 UTF-8 百分号编码；后台会自动编码，服务端解码后仍按原有路径、长度和类型规则校验。直接调用管理 API 的客户端也必须遵守这一约定，不能把中文直接放进 HTTP 请求头。

文章内的相对 Markdown 链接与图片仍按内容树解析；视频可以在文章里使用 `![视频说明](./clip.mp4)` 嵌入，也能从文件树打开。媒体上传限制为 JPEG、PNG、GIF、WebP、AVIF、MP4、WebM，验证类型、文件头与大小；请先清理照片 EXIF/GPS，视频只上传准备公开的压缩版本。第三方素材需自行确认来源和许可证。

## 服务与网络边界

SQLite 数据库和媒体文件都在 `CONTENT_DATA_DIR`，不放在网站静态目录。公开反向代理只能放行 `GET /api/v1/content` 与 `GET /api/v1/media/:id`；`/admin`、`/api/v1/admin/` 和数据库端口不得对公网开放。管理后台只经 VPN 或其他私人入口访问，并在 HTTPS 下使用；服务要求反向代理覆盖并传入可信的 `X-Forwarded-Proto: https`。**不能把容器的 4175 端口直接转发到公网**，否则可能绕过路由隔离或伪造代理头。

`services/content-api/compose.example.yml` 只是隔离部署模板，不是上线命令。容器仅绑定主机回环地址；私有卷需预先归属容器 UID 1000。群晖上的公网 HTTPS、非标准端口或隧道、DNS、备份、升级及回滚仍须单独审查和授权，本轮不执行。外部静态前端能否访问 API，必须从家庭网络以外验证；内网回流成功不能代替公网验证。

备份时把 SQLite 数据库及 `media/` 视为同一数据集，并保留一致性快照；不要只复制一个正在写入的 SQLite 主文件而漏掉 WAL。至少测试一次从备份恢复。后台密码哈希、配置文件、数据库、媒体、备份和日志都属于私有运行数据，不进入开源仓库、CI 产物或前端构建。

## 验证与失败处理

- 本地运行 `npm run check`、`npm test`、`npm run content-api:coverage`、`npm run content-api:build`、`npm run content:integration`、`npm run release:verify`；自动集成测试覆盖草稿不可读、发布后可读、撤回后不可读和视频 Range 请求，生产接入前还须在真实网络上手动复核。
- 若 API 暂时不可用，前端显示空作者内容/错误状态，绝不回退到 `examples/blog`；站点代码版本不会因此改变。
- 内容错误在后台修改或撤回；服务代码错误另开代码变更。不要恢复已删除的 `publish:content` 或手工向旧 OSS `content/` 上传来绕过后台。
- 网站程序发布仍只走 `npm run deploy:site`；具体门禁见 [生产发布决策](deployment.md)。
