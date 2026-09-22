# 生产部署

## 发布边界

生产站点在作者的 Mac 上构建，并发布到阿里云 OSS 与 CDN。GitHub 只保存程序、测试和公开 CI；
个人文章与图片保存在公开仓库外的 `SekerEdexContent/blog`，不会进入 GitHub checkout、Artifact、
Actions 缓存或日志。

站点仍然是公开静态网站。`SEKER_CONTENT_ROOT` 中的 Markdown 与媒体会编入最终产物并上传 OSS，
因此该目录只能放准备公开的 Web 版本。草稿、秘密、原始照片和私人记录应放在不参与构建的目录。

## 一次性本机设置

1. 安装 Node.js 22 与阿里云 CLI 3.5.1 或更高版本。
2. 在公开仓库外创建内容目录，例如 `../SekerEdexContent/blog`。
3. 在仓库的 `.env.local` 中配置：

   ```dotenv
   SEKER_CONTENT_ROOT=../SekerEdexContent/blog
   ```

4. 使用浏览器 OAuth 创建本机发布配置：

   ```sh
   aliyun configure --mode OAuth --profile seker-edex-local
   ```

OAuth 使用可更新的临时凭据，不需要在仓库、脚本或 GitHub 中保存长期 AccessKey。发布脚本固定使用
`seker-edex-local` 配置、北京地域的 `seker-edex-web` Bucket 和 `www.seker.wang`。

## 发布命令

日常发布先把公开程序代码提交并推送到 `main`，然后在仓库根目录运行：

```sh
npm run deploy
```

脚本会执行以下步骤：

1. 确认当前分支是 `main`，且 `HEAD` 与 `origin/main` 完全一致。
2. 在临时 Git worktree 中检出该提交，避免夹带当前工作区的未提交文件。
3. 从仓库外读取内容，安装锁定依赖并运行类型检查、单元测试和生产构建。
4. 先上传普通文件和哈希资源，再发布 `index.html`，最后写入 `deployment.json`。
5. 刷新 CDN，并从公网确认 `deployment.json` 与目标提交一致。
6. 只在公网验证成功后删除 OSS 中已经不属于当前构建的旧对象，并再次刷新 CDN。
7. 无论成功或失败都移除临时 worktree；失败的构建不会上传文件。

哈希资源使用一年不可变缓存，普通文件使用短缓存，入口页不缓存，部署标记禁止缓存。上传参数通过
进程参数数组传递，不会从文章名或浏览器内容拼接 Shell 命令。

## 恢复与故障处理

- OAuth 过期或被撤销时，重新运行配置命令并在浏览器登录。
- CDN 验证失败时，OSS 中可能已有完整新版本；修复网络或权限后重新执行同一提交即可。
- 需要回滚时，把目标历史提交恢复为新的 `main` 提交并再次运行 `npm run deploy`，线上版本和公开 Git
  历史仍保持可追踪。
- 本机内容目录应单独使用私人 Git、Time Machine 或其他备份。发布脚本只读取该目录，不承担源文件备份。

GitHub 上不再运行生产部署，也不需要自托管 Runner、部署环境变量或 GitHub OIDC 角色。
