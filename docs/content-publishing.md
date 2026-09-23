# 作者内容发布

本流程只发布作者文章和 Web 图片，不发布网站代码。网站发布的唯一入口是 `npm run deploy:site`；内容
修改不要求创建公开程序仓库提交，也不要求为了文章更新重新构建整站。

## 所有权合同

内容发布只拥有 OSS 的 `content/` 命名空间：

```text
content/
├── current.json
└── releases/
    └── <sha256-content-digest>/
        ├── manifest.json
        └── media/...
```

`releases/<digest>/` 不可变并使用长期缓存；`current.json` 禁止缓存，是唯一可变入口。内容脚本不得写入
`index.html`、`assets/`、`deployment.json` 或其他站点对象，也不得运行网站 Git worktree 发布流程。

## 内容源

在公开仓库外维护作者发布根，例如 `../SekerEdexContent/blog`，并在 `.env.local` 配置：

```dotenv
SEKER_CONTENT_ROOT=../SekerEdexContent/blog
```

该目录必须包含 `content-source.json`，声明 `kind: "author"` 与 `visibility: "public"`。发布根只放准备
公开的 Markdown 和经过压缩、清理元数据的 Web 图片；草稿、原始照片、秘密和私人记录必须放在发布根
之外。内容源建议使用独立私人 Git 和独立备份，但其提交历史不进入公开程序仓库。

## 发布前门禁

1. 阅读 `docs/deployment.md`，确认本次目标只有文章、图片或内容目录。
2. 运行 `npm run content:verify:author` 和 `npm run content:check`，并在本地预览文章、链接和图片。
3. 检查作者内容仓库状态；只把准备公开的修改纳入本次内容版本。
4. 确认没有秘密、原始照片、未清理的 EXIF/GPS 信息或许可证不明材料。
5. 运行 `npm run release:verify`，确认发布入口和命名空间合同仍然有效。

## 唯一执行入口

```sh
npm run publish:content
```

脚本验证作者身份、frontmatter、相对链接、图片 alt、路径和文件类型，然后按全部发布文件计算 SHA-256
摘要。它先上传该摘要下的媒体和 `manifest.json`，再次读取内容根确认上传期间没有变化，最后才更新
`content/current.json` 并刷新该文件的 CDN 缓存。

若上传、校验或稳定性检查在指针切换前失败，访客继续读取旧版本；已经上传的不可变对象不会成为当前
版本。旧 release 不会被网站发布删除，可用于审计和回滚。

## 完成标准

只有以下条件全部满足，才可报告内容发布成功：

1. `npm run publish:content` 正常退出并报告目标摘要。
2. `https://www.seker.wang/content/current.json` 返回 `200`，声明 `author` 身份、目标摘要及同摘要的清单路径，
   并使用 `Cache-Control: no-store`。
3. 指针引用的 `manifest.json` 可读取，清单摘要和作者身份与指针一致。
4. 新文章和图片可以从正式站点打开，缺失内容不会显示示例文章。
5. 根目录 `deployment.json` 的 `site.revision` 不因本次内容发布而改变。

## 回滚与故障

- 内容回滚：在独立内容仓库恢复目标版本，重新完成内容门禁并运行 `npm run publish:content`。相同内容会
  复用相同摘要路径，最后只重新切换公开指针。
- OAuth、内容校验或公网核验失败：修复根因后从同一入口重试，不得手工编辑 OSS 指针。
- 内容发布不得顺便发布网站；如果运行时不支持某种新内容能力，应另开网站代码变更并走
  `npm run deploy:site`。

网站程序发布入口仍为 `npm run deploy:site`，详见 `docs/site-deployment.md`；本流程不得代替它。
