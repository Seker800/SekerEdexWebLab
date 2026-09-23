# 生产发布决策门禁

本文档是 `www.seker.wang` 的生产发布总入口。它只负责判断应走哪条发布线；具体步骤分别锁定在
`docs/site-deployment.md` 与 `docs/content-publishing.md`。人工操作和 Agent 都不得把两条发布线合并、
互相代跑，或使用未列出的上传方式。

## 先判断改了什么

| 变更对象 | 唯一入口 | 必读文档 | 允许写入 | 明确禁止 |
| --- | --- | --- | --- | --- |
| 网站代码、样式、依赖、公开示例、构建或运行时 | `npm run deploy:site` | `docs/site-deployment.md` | 除 `content/` 外的站点对象 | 读取作者内容、改写 `content/` |
| 作者文章、Web 图片、内容目录 | `npm run publish:content` | `docs/content-publishing.md` | 仅 `content/` | 构建或上传网站、改写 `deployment.json` |
| 两者都改了 | 先分别完成各自门禁，再分别执行两个入口 | 两份都读 | 两条线各自拥有的对象 | 用一次命令打包发布 |

不存在通用的 `npm run deploy`。看到“发布”“上线”“更新生产”但无法判断对象时，必须先查看变更范围；
仍不明确时停止并询问用户，不能自行选择或同时执行两个入口。

## 不可跨越的边界

- 网站版本由根目录 `deployment.json` 记录，只包含程序版本 `site.revision`。
- 内容版本由 `content/current.json` 记录，只包含作者身份、内容摘要和不可变清单地址。
- 网站运行时读取当前内容版本；网站构建不嵌入作者文章或图片。
- 示例内容只用于本地开发、公开 CI 和示例构建。生产内容失败或为空时不得回退到示例。
- 网站发布的过期对象清理必须排除整个 `content/` 命名空间。
- 内容发布采用“媒体与清单先上传，指针最后切换”；失败不得改变公开指针。
- 两条线都只能在作者 Mac 上使用本项目提供的标准入口，并通过同一个本机 OAuth 配置访问阿里云。
- 不得使用 OSS 控制台、直接执行 OSS 上传命令、临时脚本、GitHub Actions、自托管 Runner 或群晖替代标准入口。

## 机器可执行门禁

```sh
npm run release:verify
```

该门禁会拒绝含糊的 `deploy` 命令、站点发布读取作者内容、内容发布写入站点版本，以及缺失双入口说明的
发布文档。它必须进入公开 CI，也必须由网站发布脚本在上传前再次执行。

## 选择后的流程

- 仅修改程序：继续阅读 `docs/site-deployment.md`，执行 `npm run deploy:site`。
- 仅修改文章或照片：继续阅读 `docs/content-publishing.md`，执行 `npm run publish:content`。
- 同时修改：将其视为两个独立发布。两者可以在不同时间上线，也可以独立回滚，不存在共同版本号。

## 首次迁移顺序

当前线上版本若仍把内容嵌入网站产物，首次切换必须先运行 `npm run publish:content`，确认
`content/current.json` 和清单可用，再运行 `npm run deploy:site`。旧网站会忽略提前发布的内容对象，
因此这个顺序不会影响现有页面；反过来先发布 runtime 网站会产生暂时的空内容状态。完成首次迁移后，
两条发布线不再有固定先后关系。
