# 第 40 篇：Operator 测试、发布与升级：练习题与面试题

> 本页由 [第 40 篇：Operator 测试、发布与升级](../../chapters/stage-06-platform-operator/40-operator-test-release.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. `envtest` 和 fake client 的核心差异是什么？为什么 Operator 测试不能只依赖 fake client？
2. kind 集成测试比 envtest 多验证了哪些内容？
3. 为什么 Webhook 默认值和校验逻辑可以先做直接 Go 测试？
4. Operator 发布清单通常包含哪些资源？这些资源的安装顺序为什么重要？
5. 为什么 CRD 回滚比 Deployment 回滚更危险？

### 实操题

1. 为 `ValidateCreate` 增加一个测试：当 `replicas=0` 时必须被拒绝，并检查错误信息包含 `replicas must be between 1 and 10`。
2. 修改 envtest 用例，验证 `TodoApp` 创建后 Deployment 的 `labels` 包含 `app.kubernetes.io/managed-by=todo-operator`。
3. 给 `run-kind-e2e.sh` 增加扩缩容验证：把 `replicas` 从 2 改为 3，确认 Deployment 最终 Ready 副本数为 3。

### 思考题

1. 如果生产集群禁止安装 cert-manager，你会如何调整 Operator Webhook 证书发布方案？
2. 如果一个 CRD 新版本把 `spec.image` 拆成 `spec.image.repository` 和 `spec.image.tag`，你会如何设计兼容性测试和回滚策略？

## 面试题

### 面试题 1：Operator 的 envtest 主要测试什么？

**一句话结论**：envtest 用真实 API server 和 etcd 测试 CRD、status subresource 和 Reconciler 与 Kubernetes API 的交互。

**展开解释**：它比 fake client 更接近真实集群，能发现 CRD 未安装、schema 不匹配、status 更新路径错误和 deletionTimestamp 语义问题。但它不会调度 Pod，也不会验证镜像拉取和 Service 网络，所以还需要 kind 或真实集群集成测试。

**深入追问**：什么时候不用 envtest？纯函数、字段解析、默认值 helper 可以用普通 Go 单元测试；完整部署链路应该用 kind 或真实集群。

### 面试题 2：为什么 Operator 需要 kind 集成测试？

**一句话结论**：因为 Operator 的关键风险很多发生在真实集群环境里，例如 RBAC、Webhook Service、证书、镜像和 Deployment rollout。

**展开解释**：envtest 可以证明 Reconciler 逻辑大体正确，但不能证明 manager Pod 能启动、Webhook Service 有 endpoints、cert-manager 能注入 CA、镜像能拉取、RBAC 权限足够。kind 集成测试用本地真实集群把这些环节串起来。

**深入追问**：kind 测试应该放在每次提交吗？小项目可以放在 PR；大型项目通常把快速单元测试放在每次提交，把 kind 集成测试放在 PR、夜间构建或发布候选阶段。

### 面试题 3：Helm 发布 Operator 时，CRD 应该怎么处理？

**一句话结论**：CRD 应该被当成 API 契约独立管理，不能只依赖普通 Helm 模板升级回滚。

**展开解释**：CRD 影响所有用户对象和 API server 行为。新增字段、改变 schema、切换 storage version 都可能影响已有 CR。实践中常把 CRD 放在 Chart 的 `crds/` 目录或独立发布包中，升级前先做 server-side dry-run 和兼容性检查。

**深入追问**：回滚时能不能直接回滚 CRD？不能盲目回滚。必须先确认没有新字段对象、没有新 storage version 依赖，并评估旧 Controller 是否能兼容当前 CRD。

### 面试题 4：Operator 发布前你会检查哪些内容？

**一句话结论**：检查测试、镜像、清单、权限、Webhook、CRD 兼容性和回滚路径。

**展开解释**：具体包括 `go test ./...`、envtest、kind 集成测试、镜像 digest、`make manifests` 是否同步、RBAC 是否最小且足够、Webhook 证书和 endpoints 是否正常、旧 CR dry-run 是否通过、Helm `lint/template/install/upgrade/rollback` 是否通过。

**深入追问**：如果只能选一个发布后 smoke test？创建一个最小 `TodoApp`，确认默认值、Deployment/Service、status Ready、Event 和删除清理都正常。

### 面试题 5：为什么 Operator 回滚不能只看 Helm revision？

**一句话结论**：Helm revision 只能说明模板资源回到了某个版本，不能自动证明 CRD、用户对象和外部状态都回到了兼容状态。

**展开解释**：Operator 管理的是长期存在的 API 对象。升级期间用户可能已经创建了带新字段的 CR，CRD status 中可能出现新 storedVersions，外部资源也可能被新 Controller 调谐过。回滚需要同时考虑 Controller、CRD、CR 实例和外部副作用。

**深入追问**：怎么降低回滚风险？保持字段向后兼容，先发布能读旧字段和新字段的 Controller，CRD 变更单独审批，发布前后都跑兼容性测试。
