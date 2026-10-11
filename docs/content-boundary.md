# 开源程序仓库与私人内容边界

| 材料 | 放置位置 | 上传到公开 GitHub？ | 公开网站可读取？ |
| --- | --- | --- | --- |
| eDEX 静态前端代码、测试与站点发布脚本 | 本程序仓库 | 是 | 发布前端程序 |
| 内容 API、后台代码、数据库结构、测试、部署模板 | 独立 `SekerContentApi` 仓库 | 由该仓库可见性决定 | 只开放只读 API |
| 标为 `sample` 的示例 Markdown/图片 | `examples/blog` | 是 | 仅本地示例构建；生产绝不回退 |
| 真实文章、链接、标题、目录、顺序与发布状态 | 服务的 SQLite 私有卷 | 否 | 仅 `published` 的公开字段 |
| 准备公开的 Web 图片和视频 | 服务的媒体私有卷 | 否 | 发布后通过受控媒体端点 |
| 草稿、原始照片、EXIF/GPS、备份、数据库 WAL、管理密码哈希、私有配置与日志 | 私有存储 | 绝不 | 否 |

公开仓库的 Git 历史与 fork 无法保密；`.gitignore` 不能撤回已经提交的秘密。所有真实内容使用后台管理，不需为每篇文章建立程序提交。公开接口会让已发布文字和媒体被访客保存，因此后台的“发布”是公开行为，不是访问控制。上传前先压缩媒体并清除敏感元数据；第三方素材要记录合法来源和授权。

前端构建中唯一允许出现的内容服务配置是 `SEKER_CONTENT_API_ORIGIN`：它是公开 HTTPS 地址，不是私有 IP、数据库连接串或密码。`CONTENT_ADMIN_PASSWORD_HASH`、`CONTENT_DATA_DIR`、数据库文件、媒体与备份只在私有运行环境配置。GitHub CI 只使用公开示例与空数据库测试，不取得真实内容或生产凭据。数据库端口不开放给浏览器；公开反向代理只放行只读 API，后台只经私人 HTTPS 入口访问。

旧的 `SEKER_CONTENT_ROOT`/`publish:content` 静态作者发布线已撤销；历史 OSS `content/` 对象本轮既不迁移也不删除。程序网站通过 `npm run deploy:site` 独立发布，作者内容在 `SekerContentApi` 提供的后台独立维护。详见 [决策门禁](deployment.md)、[网站发布](site-deployment.md) 和 [后台内容管理](content-publishing.md)。
