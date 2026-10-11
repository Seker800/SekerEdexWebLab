# ADR 0007：内容服务独立建仓

- Status: Accepted for repository migration; production rollout remains separate
- Date: 2026-10-11
- Extends: ADR 0006 的运行与数据隔离边界

## 背景

eDEX Web 和极简 Web 是两个独立的静态前端。内容服务虽然作为独立进程运行，但源码、测试、Docker 模板和 CI 仍归 eDEX 仓库，导致后端升级被前端构建与发布工作流牵连，也使第二前端的代码所有权难以说明。

## 决策

- 将内容 API、后台、SQLite 模型、服务测试与构建模板迁移到独立 `SekerContentApi` 仓库。真实数据和凭据仍在仓库外私有运行目录；拆仓不迁移任何生产数据。
- 保持 `/api/v1/content`、`/api/v1/media/:id` 和管理接口的行为与响应结构。两个前端只通过 HTTP 访问，不导入服务源码，也不共享数据库文件。
- eDEX 保留自己的内容客户端测试和基于公共 HTTP 契约的浏览器验收；服务仓库负责后台、发布过滤、媒体流和构建后的运行验收。两个仓库分别运行 CI。
- eDEX 的 `deploy:site` 只拥有 eDEX 静态对象。内容服务生产升级仍需单独审查和授权；新仓库的 CI 与 Docker 模板不构成部署授权。

## 后果

修改内容服务不再触发 eDEX 的程序构建。跨仓协议修改需要先验证兼容并按服务、前端顺序分别上线；不能用源码同步或临时复制实现来绕过契约。此前已进入 eDEX 公共 Git 历史的服务源码不能因新仓库设为私有而恢复保密。
