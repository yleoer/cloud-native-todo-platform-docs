# 第 29 篇：CI/CD 自动化交付：练习题与面试题

> 本页由 [第 29 篇：CI/CD 自动化交付](../../chapters/stage-05-production-engineering/29-cicd.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. CI 和 CD 的核心区别是什么？为什么 PR 上通常只做 CI 门禁？
2. GitHub Actions 中 workflow、job、step、runner 分别是什么？
3. 为什么推送 GHCR 需要 `packages: write`，而 Go 测试 job 不需要？
4. 为什么生产发布不应该只依赖 `latest` 镜像标签？
5. kind 临时集群验证和真实集群部署分别解决什么问题？

实操题：

1. 给 workflow 增加 `go test ./... -run Test` 的单独 step，并故意让一个测试失败。验收标准：PR check 失败，且不会进入 `build-image` job。
2. 把 `deploy-kind` 临时 overlay 里的 `images.name` 故意改错，观察镜像没有被替换时的日志，再恢复。验收标准：能从 `/tmp/todo-dev-image.yaml` 定位 Kustomize 镜像覆盖没有命中。
3. 为 workflow 增加 `workflow_dispatch` 输入 `environment`，允许选择 `dev` 或 `test` overlay。验收标准：手动触发时能根据输入渲染不同 overlay。

思考题：

1. 如果你的团队有 dev、staging、prod 三个集群，你会让 CI 直接部署，还是让 CI 更新 GitOps 仓库？为什么？
2. 如果一次发布包含数据库迁移和镜像升级，流水线应该如何设计回滚、备份和人工审批？

## 面试题

### 面试题 1：你会如何设计一个 Go 服务的 CI/CD 流水线？

**一句话结论**：先做无权限 PR 门禁，再在主干构建不可变镜像并推送 registry，最后通过受控环境部署或 GitOps 同步。

**展开解释**：PR 阶段执行 `go vet`、`go test`、漏洞扫描、Dockerfile 和 Kubernetes manifest 渲染检查。合并到 main 后构建镜像，打 commit SHA tag，推送 registry，记录 digest。部署阶段可以用临时集群验证，也可以通过 environment 审批部署到 dev/staging/prod。生产更推荐 GitOps，让集群控制器从 Git 拉取期望状态。

**深入追问**：要讨论权限隔离、Secret 暴露、镜像 digest、并发部署控制、失败回滚、数据库迁移、审计和告警联动，而不是只说“写个 GitHub Actions”。

### 面试题 2：为什么 CI/CD 中不要滥用 `pull_request_target`？

**一句话结论**：`pull_request_target` 运行在目标仓库上下文，可能拥有更高权限；如果执行 PR 中的未可信代码，会造成 Secret 泄露。

**展开解释**：普通 `pull_request` 对外部 fork 的 Secret 访问受限，这是为了保护仓库。`pull_request_target` 适合做打标签、评论等不执行外部代码的维护动作。如果在这个事件中 checkout PR 代码并执行脚本，攻击者可以通过修改脚本读取 Token 或 Secret。

**深入追问**：安全做法是把 PR 验证设计成无 Secret、只读权限；需要写权限的动作只在受保护分支 push 后执行，并配合 CODEOWNERS 和分支保护。

### 面试题 3：镜像 tag 和 digest 在发布中分别有什么作用？

**一句话结论**：tag 方便人类识别版本，digest 精确标识镜像内容；生产回滚和审计应以 digest 为准。

**展开解释**：`main`、`latest` 这类 tag 可能移动，`sha-<commit>` 更稳定但仍然是 tag。digest 是 registry 对镜像内容生成的不可变哈希。发布记录中保存 digest，能保证后续排查时知道 Pod 运行的具体镜像内容。

**深入追问**：Kubernetes 可以直接使用 digest 拉取镜像。很多团队会让 CI 生成镜像 digest，再更新 Helm values 或 Kustomize images 字段，由 GitOps 同步到集群。

### 面试题 4：CI 直接部署和 GitOps 部署有什么区别？

**一句话结论**：CI 直接部署是流水线主动改集群；GitOps 是流水线改 Git，集群控制器从 Git 同步。

**展开解释**：CI 直接部署简单直接，但流水线需要持有集群凭据，变更历史散在 workflow 日志中。GitOps 把 Git 作为唯一事实来源，Argo CD / Flux 负责同步、漂移检测和回滚，适合多环境和生产审计。

**深入追问**：小团队或 dev 环境可以 CI 直连；生产多集群通常更适合 GitOps。关键不是选哪个名词，而是权限边界、审批、审计、回滚和漂移治理是否清楚。

### 面试题 5：如何排查 GitHub Actions 中镜像推送失败？

**一句话结论**：先看 registry 登录，再看 token 权限、镜像名称、package 权限和组织策略。

**展开解释**：GHCR 推送通常需要 `docker/login-action` 登录 `ghcr.io`，用户名用 `github.actor`，密码用 `secrets.GITHUB_TOKEN`，job 权限包含 `packages: write`。镜像名应是 `ghcr.io/OWNER/REPO/...`。组织可能限制 Actions 创建 package 或访问 package。

**深入追问**：如果推送第三方 registry，还要检查 PAT 权限、Secret 是否在当前 event 可用、PR 是否来自 fork、是否误把 Secret 打印到日志。
