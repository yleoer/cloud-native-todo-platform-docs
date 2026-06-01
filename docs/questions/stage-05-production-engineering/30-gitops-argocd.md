# 第 30 篇：GitOps 与 Argo CD：练习题与面试题

> 本页由 [第 30 篇：GitOps 与 Argo CD](../../chapters/stage-05-production-engineering/30-gitops-argocd.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. GitOps 中“Git 是唯一事实来源”是什么意思？它和普通 `kubectl apply` 有什么区别？
2. Argo CD 的 Sync Status 和 Health Status 分别表示什么？
3. `prune` 和 `selfHeal` 分别解决什么问题？各自有什么风险？
4. 为什么 Argo CD 不能直接读取第 28 篇本地 `.secrets/` 目录？
5. AppProject 在生产环境中的作用是什么？

实操题：

1. 给 dev overlay 增加 `TODO_LOG_LEVEL=info`，提交并推送。验收标准：Argo CD 自动同步，新的 ConfigMap 名称发生变化，Deployment 完成滚动更新。
2. 暂时关闭 dev Application 的 `selfHeal`，手工把副本数改成 2，观察 Argo CD 状态。验收标准：能看到 `OutOfSync`，但副本数不会自动恢复；重新开启后能恢复。
3. 在 ApplicationSet 中增加一个 `test` 元素，并创建 `deployments/gitops/envs/test`。验收标准：Argo CD 自动生成 `todo-platform-test` Application。

思考题：

1. 如果生产环境出现紧急故障，你会先暂停 Argo CD 同步、直接手工改集群，还是先提交 Git revert？什么情况下选择不同方案？
2. 如果 CI 构建镜像后自动提交 GitOps PR，你会如何设计审批、镜像扫描、回滚和审计，避免坏镜像进入 prod？

## 面试题

### 面试题 1：CI 直接部署和 GitOps 部署有什么区别？

**一句话结论**：CI 直接部署是流水线主动改集群，GitOps 是流水线改 Git，再由集群内控制器把 Git 期望状态同步到集群。

**展开解释**：CI 直接部署简单，适合 dev、临时环境或小团队，但 CI 需要持有集群写权限，部署历史散在 workflow 日志中。GitOps 把部署配置放进 Git，所有变更走 PR、审计和回滚，Argo CD 负责持续同步、漂移检测和自愈，更适合多环境和生产集群。

**深入追问**：生产中还要讨论 Git 分支保护、Argo CD RBAC、AppProject 限权、Secret 管理、同步窗口、prune 风险和事故时如何暂停同步。

### 面试题 2：Argo CD 的 Synced 和 Healthy 是同一个概念吗？

**一句话结论**：不是。`Synced` 表示集群对象与 Git 期望状态一致，`Healthy` 表示这些对象自身运行正常。

**展开解释**：一个应用可能 `Synced` 但 `Degraded`，例如 Git 中的 Deployment 已经应用，但 Pod 因 Secret 缺失 CrashLoopBackOff。也可能 `OutOfSync` 但 `Healthy`，例如有人手工扩容了 Deployment，应用仍正常服务，但集群状态已经偏离 Git。

**深入追问**：排障时先看 source/path/revision 是否能渲染，再看 sync diff，然后看 Kubernetes 事件、Pod 状态、日志和探针。

### 面试题 3：`prune` 和 `selfHeal` 为什么不能无脑开启？

**一句话结论**：它们能强化 Git 事实来源，但也会放大错误配置和覆盖临时救火动作。

**展开解释**：`prune` 会删除 Git 中已移除的资源，适合清理废弃对象，但路径配错或目录误删时可能删除关键资源。`selfHeal` 会把手工改动修回 Git 状态，适合防止漂移，但事故中直接 `kubectl edit` 的临时修复可能被覆盖。

**深入追问**：生产环境应使用 AppProject 限制作用域，配合 PR 审批、同步窗口、告警确认和分环境策略；dev 可以自动化强一些，prod 要更谨慎。

### 面试题 4：ApplicationSet 解决什么问题？

**一句话结论**：ApplicationSet 用模板批量生成 Application，适合多环境、多集群或 monorepo 场景。

**展开解释**：没有 ApplicationSet 时，dev、test、prod 可能复制三份 Application YAML，只改 path 和 namespace，后续很容易漏改。ApplicationSet 通过 list、git、cluster、matrix 等 generator 生成参数，再渲染模板，统一管理一组应用。

**深入追问**：要注意模板参数缺失、命名冲突、prod 自动同步风险、不同环境的审批策略，以及 ApplicationSet 本身的权限边界。

### 面试题 5：GitOps 中如何做回滚？

**一句话结论**：优先回滚 Git 中的期望状态，例如 `git revert`，再让 Argo CD 同步。

**展开解释**：如果只在集群里手工改 Deployment 或只在 Argo CD 中临时 rollback，Git 仍然保留坏配置，下一次同步可能又把坏状态带回来。Git revert 有审计记录、能走审批、能触发相同的同步链路，也能让团队确认当前生产期望状态。

**深入追问**：数据库迁移、不可逆变更和多服务联动不能只靠 Deployment 回滚。要提前设计备份、兼容性、灰度、feature flag、迁移回滚脚本和发布冻结策略。
