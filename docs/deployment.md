# 生产部署

## 发布边界

生产站点由群晖上的 GitHub 自托管 Runner 构建，并发布到阿里云 OSS 与 CDN。GitHub 只保存程序、
测试和工作流。作者内容根固定在群晖的 `/volume1/homes/AI/SekerEdexContent/blog`，不进入公开仓库、
GitHub Artifact 或 Actions 缓存。

站点仍然是公开静态网站。进入 `SEKER_CONTENT_ROOT` 的 Markdown 与媒体会在群晖上编入最终产物，
随后发布到 OSS；不应把秘密、草稿、原始照片或不准备公开的个人记录放入该目录。

## 自动发布流程

1. `main` 分支触发完整 `CI` 工作流。
2. 只有 `CI` 成功后，`Deploy production` 才会进入部署队列。
3. 带有 `seker-edex-deploy` 标签的群晖 Runner 检出通过验证的准确提交。
4. Runner 使用公开默认内容执行静态检查与测试，再使用群晖本地内容根执行生产构建。
5. GitHub OIDC 令牌向阿里云 STS 换取 30 分钟临时凭据，不保存长期 AccessKey。
6. 哈希资源先上传，其他静态文件随后上传，`index.html` 最后覆盖。
7. 刷新 `www.seker.wang` CDN，并用 `deployment.json` 核对线上提交。

部署工作流不响应 Pull Request，手动运行也只接受 `main`。`concurrency` 保证同一时间只有一个生产
写入者，并且不会为了新提交取消已经开始的上传。私人内容的构建输出保存在 Runner 本机；失败时
GitHub 日志只记录通用错误，不打印内容文件名、正文或本机诊断日志。

## 阿里云最小权限

OIDC 身份提供商只信任 GitHub Actions，部署角色的 subject 只接受：

```text
repo:Seker800/SekerEdexWebLab:environment:production
```

部署角色只需要：

- 列出 `seker-edex-web` Bucket 中的对象；
- 在该 Bucket 中上传和覆盖对象；
- 刷新 `www.seker.wang` 的 CDN 缓存。

角色不应获得 Bucket 删除、Bucket 配置、RAM、DNS、账单或其他 OSS Bucket 的权限。当前不自动开启
OSS 版本控制，因为历史版本会持续产生存储费用；需要更强恢复能力时，应另行确认费用后再启用。

## 私人内容维护

作者源文件保存在群晖：

```text
/volume1/homes/AI/SekerEdexContent/blog
```

可以为该目录单独配置本地 Git、快照或备份，但不得把 remote 指向公开程序仓库。部署工作流只读取该目录，
不会把它上传到 GitHub。GitHub 上能看到的只有工作流状态以及不含正文、内容文件名和本机诊断内容的
标准构建日志。工作流文件会公开群晖内容根的位置，但不会公开该目录的清单或文件。

## 发布操作

日常发布只需把程序修改推送到 `main`。若只修改了群晖内容，可在 GitHub Actions 页面手动运行
`Deploy production`；该操作会读取群晖上的最新内容并重新发布。

失败的构建不会上传文件。上传完成但 CDN 验证失败时，OSS 中已经存在完整新版本，可以重新运行工作流；
需要回滚时，手动运行目标提交上的工作流重新发布即可。
