# 第 41 篇：Operator 生产实践：练习题与面试题

> 本页由 [第 41 篇：Operator 生产实践](../../chapters/stage-06-platform-operator/41-operator-production.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. 为什么 RBAC 最小权限不能只靠“删除看起来多余的 verb”完成？还需要哪些验证？
2. `WATCH_NAMESPACE`、label selector 和 Webhook `namespaceSelector` 分别限制的是哪一段流程？
3. controller-runtime cache 默认行为对大规模集群有什么风险？为什么限制 cache 范围通常比直接提高并发更重要？
4. Conditions、Events、日志和 metrics 分别适合回答什么排障问题？
5. 为什么 `replicaCount=2` 时必须开启 leader election？

### 实操题

1. 把 `watch.namespaces` 从 `todo-team-a,todo-team-b` 改为只包含 `todo-team-a`，在 `todo-team-b` 创建带接管标签的 `TodoApp`。验收标准：`TodoApp` 被创建，但不会生成 Deployment。
2. 给 Helm Chart 增加 `manager.maxConcurrentReconciles` 值，并在 `SetupWithManager` 中接入 controller options。验收标准：`helm template` 能看到参数，Controller 启动日志能确认并发配置。
3. 先执行 `curl -s http://127.0.0.1:8080/metrics | grep workqueue` 确认实际 workqueue 指标，再增加一个 PrometheusRule：当 TodoApp 队列深度持续 10 分钟大于 100 时告警。验收标准：`helm template --show-only templates/prometheusrule.yaml` 能渲染出新规则。

### 思考题

1. 如果安全团队要求 Operator 不能使用 ClusterRole，只允许每个租户 namespace 一个 RoleBinding，你会如何调整 Helm Chart 和发布流程？
2. 如果某次升级后 `TodoApp` Reconcile 错误率升高，但业务 Pod 仍然 Running，你会先回滚、先静默告警还是先排查？请说明决策依据。

## 面试题

### 面试题 1：如何判断一个 Operator 是否具备生产可用性？

**一句话结论**：要从权限、隔离、性能、可观测性和运维动作五个维度判断，而不是只看能否安装成功。

**展开解释**：生产 Operator 应该有最小 RBAC、明确 Watch 范围、资源限制、安全上下文、leader election、发布后 smoke test、metrics、日志、Events、Conditions 和回滚手册。它还要证明 CRD、Webhook、Controller 和 Helm Chart 的变更能被测试和审查。

**深入追问**：如果只能先补一个维度，优先补什么？通常先补权限和发布后 smoke test，因为它们分别限制风险上限和验证核心路径是否可用。

### 面试题 2：Predicate、Index 和 Cache 范围有什么区别？

**一句话结论**：Cache 范围决定同步哪些对象，Predicate 决定哪些事件入队，Index 决定如何高效查找关联对象。

**展开解释**：限制 cache namespace 可以减少 List-Watch 对象数量；predicate 可以过滤未被接管的对象或无意义更新；field index 可以避免按标签或 owner 查找子资源时全量扫描。三者可以叠加，但不能互相替代。

**深入追问**：为什么不直接提高 `MaxConcurrentReconciles`？并发只能加快处理已经进入队列的请求，不能减少无关对象同步、无效事件入队或低效 List 的成本。

### 面试题 3：Operator 为什么需要 leader election？

**一句话结论**：多副本 Controller Manager 需要 leader election 来保证同一时刻只有一个副本执行调谐逻辑。

**展开解释**：如果两个副本同时 Reconcile 同一个对象，可能重复写 status、重复记录 Event，或对外部资源执行重复操作。leader election 用 Lease 选出一个活跃副本，其他副本作为热备。当前 leader 失效后，备副本再接管。

**深入追问**：leader election 是否提升吞吐？通常不是。它主要提升可用性，不是让同一个 Controller 并行处理更多对象。吞吐需要结合队列、并发、cache、外部 API 限流和幂等设计一起评估。

### 面试题 4：Webhook 的 `namespaceSelector` 有什么生产价值？

**一句话结论**：它能把 Admission 影响范围限制在目标命名空间，避免 Webhook 故障阻断无关租户。

**展开解释**：Webhook 位于 API server 写路径，`failurePolicy=Fail` 时服务不可用会导致匹配对象创建或更新失败。通过 `namespaceSelector`，平台可以只让带准入标签的 namespace 使用该 Webhook，降低故障影响面，也让租户接入流程更明确。

**深入追问**：只配置 `namespaceSelector` 是否足够隔离？不够。它只限制 Admission，还要配合 Watch namespace、RBAC、ResourceQuota、NetworkPolicy 和发布流程。

### 面试题 5：Operator 的监控应该看哪些指标？

**一句话结论**：至少看 Reconcile 错误率、耗时、队列深度、workqueue 重试、Pod 重启和 Webhook 请求失败。

**展开解释**：controller-runtime 默认暴露 Reconcile 和 workqueue 相关指标，可以用于判断 Controller 是否在持续失败或积压。结合 Kubernetes Pod 指标和 API server admission 指标，可以区分是 Controller 调谐问题、资源不足问题还是 Webhook 写路径问题。

**深入追问**：为什么还需要 Events 和 Conditions？metrics 适合聚合趋势，不能告诉业务用户某个 `TodoApp` 为什么不 Ready。Events 和 Conditions 提供对象级解释，是排障闭环的一部分。
