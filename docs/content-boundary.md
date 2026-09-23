# 公开代码、示例内容与作者内容边界

## 边界模型

本项目区分三类材料：

| 类型 | 推荐位置 | 是否进入本公开仓库 | 是否进入网站产物 |
| --- | --- | --- | --- |
| 程序与测试 | `SekerEdexWebLab` | 是 | 是 |
| 公开示例文章 | `SekerEdexWebLab/examples/blog` | 是 | 仅示例构建 |
| 准备公开的个人文章与 Web 图片 | 独立私人仓库，例如 `SekerEdexContent/blog` | 否 | 通过独立内容 release 发布 |
| 草稿、原始照片、秘密或私人记录 | 私人仓库中不参与构建的目录 | 否 | 否 |

Git 边界与发布边界不是同一件事。`SEKER_CONTENT_ROOT` 选中的 Markdown 和媒体会由
`npm run publish:content` 发布到公开的版本化内容目录；生产网站构建不会嵌入它们。访问者仍能保存已经
发布的文字与图片。仓库外的作者内容源保护的是原稿、修改历史、未发布内容和原始素材，不是对已发布
页面实施访问控制。

## 本地配置

默认情况下，应用读取公开且受 Git 跟踪的 `examples/blog`，该根通过 `content-source.json` 声明为
`sample`。要改用作者发布源：

1. 在公开仓库外创建内容目录，例如 `../SekerEdexContent/blog`。
2. 把 `.env.example` 复制为不会被 Git 跟踪的 `.env.local`。
3. 启用以下配置：

   ```dotenv
   SEKER_CONTENT_ROOT=../SekerEdexContent/blog
   ```

4. 在作者内容根新增身份声明：

   ```json
   {
     "schemaVersion": 1,
     "id": "seker-blog",
     "kind": "author",
     "visibility": "public",
     "defaultLicense": "All rights reserved"
   }
   ```

5. 按维护指南中的文章结构添加内容，运行 `npm run content:verify:author` 和 `npm run content:check`。

路径相对于公开仓库根目录解析，也允许绝对路径。配置的是一个完整内容根，而不是附加目录：选择作者根后，
本地预览只显示该根；即使作者根为空，也不会重新显示示例。开发服务器会监听选定目录。生产环境通过
`content/current.json` 选择一个不可变作者 release；加载失败同样不会回退示例。本机绝对路径不会进入
清单或浏览器。

内容发现会忽略 Finder 的 `.DS_Store` 和 AppleDouble `._*` 元数据文件，避免跨平台复制产生的系统文件
被误当成文章或媒体；除身份声明、Markdown 与受支持图片外的未知文件会使门禁失败，避免草稿或原始素材
悄悄滞留在发布根中。

作者内容根必须位于公开程序仓库之外。建议在独立 `SekerEdexContent` 仓库中把 `blog` 作为发布根，
把草稿、原始照片和私人记录放在它的同级 `drafts`、`originals` 等目录，确保它们不进入内容发现范围。

## Git 安全规则

- 不使用公开仓库的“私人分支”保存私人材料；公开仓库的 Git 对象和 fork 不是保密存储。
- Git LFS 只改变大文件的存储方式，不改变仓库可见性。
- `.gitignore` 只阻止尚未跟踪的文件被默认加入；已经提交过的文件必须另行解除跟踪，敏感内容还需要清理历史。
- 提交前运行 `git status --short`，确认私人目录、`.env.local`、原始照片和草稿都未出现。
- 凭据、访问令牌和真正的秘密不能放进任何内容根，因为构建、日志或最终产物都可能暴露它们。

## 图片与许可证

原始照片保留在不参与构建的私人目录；发布目录只保存调整尺寸、压缩并清理敏感元数据后的 Web 版本。
原创文章和图片的授权条款应记录在作者内容仓库及发布站点中，例如“保留所有权利”或明确的 Creative
Commons 许可证。第三方材料仍必须记录作者、来源、许可证和处理方式；公开示例素材继续登记在
`docs/content-image-sources.md`。

程序仓库继续使用 GPL-3.0-only。外部作者内容不因被本项目构建就自动成为本仓库的源文件；发布者仍需
确保站点上的软件声明、个人内容声明和第三方归属彼此清晰。

## 独立发布

网站与内容使用两条互斥工作流：`npm run deploy:site` 只发布程序，`npm run publish:content` 只发布作者
内容。网站以 Git revision 标识，内容以 SHA-256 digest 标识，可以独立上线和回滚。GitHub 继续只验证
公开程序和示例内容，fork 与外部贡献者既无法访问生产内容，也无法取得生产发布身份。

本机使用阿里云 CLI 的浏览器 OAuth 临时凭据；仓库和 GitHub 均不保存 AccessKey。先阅读
`docs/deployment.md` 的决策门禁，再分别遵循 `docs/site-deployment.md` 或 `docs/content-publishing.md`。
