# 第 21 篇：Kubernetes 核心工作负载：练习题与面试题

> 本页由 [第 21 篇：Kubernetes 核心工作负载](../../chapters/stage-04-kubernetes/21-k8s-workloads.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. Pod phase 和 container state 有什么区别？
2. Deployment、ReplicaSet、Pod 三者是什么关系？
3. `maxSurge` 和 `maxUnavailable` 分别影响滚动更新的哪一部分？
4. `startupProbe`、`readinessProbe`、`livenessProbe` 分别应该检查什么？
5. 为什么 HPA 需要 CPU request？

实操题：

1. 把 `replicas` 改成 `4`，执行 `kubectl apply`，观察 ReplicaSet 和 Pod 数量变化。
2. 把 `readinessProbe.path` 临时改成 `/not-found`，观察 Service Endpoints 是否为空；实验结束后恢复。
3. 把 `resources.requests.cpu` 从 `50m` 改成 `10m`，在 metrics-server 可用时观察 HPA 是否更容易扩容；实验结束后恢复。
4. 将 CronJob 的 `suspend` 改为 `false`，等待一次调度后观察 Job；实验结束后改回 `true`。

思考题：

1. 如果一次滚动更新中，新版本 readiness 一直失败，但旧版本仍然可用，你会如何判断是否需要回滚？
2. 如果服务 CPU 很低但延迟很高，HPA 只看 CPU 有什么问题？
3. 数据库迁移应该用 Job、Init Container，还是放在应用启动逻辑里？分别有什么风险？

## 面试题

### 面试题 1：Deployment 和 Pod 的区别是什么？

**一句话结论**：Pod 是实际运行单元，Deployment 是管理 Pod 副本、滚动更新和回滚的控制器入口。

**展开解释**：裸 Pod 创建后，如果节点故障或需要发布新版本，Kubernetes 不会像 Deployment 那样自动维持副本和管理历史 revision。Deployment 通过 ReplicaSet 保持期望副本数，并在 Pod template 变化时创建新 ReplicaSet，实现滚动更新和回滚。

**深入追问**：生产中通常不直接管理 ReplicaSet，因为它缺少 Deployment 的发布语义。手工删除 Pod 通常只是触发控制器重建，不等于发布新版本。

### 面试题 2：readinessProbe 和 livenessProbe 配错会怎样？

**一句话结论**：readiness 配错会影响是否接流量，liveness 配错会导致容器被反复重启。

**展开解释**：readinessProbe 失败时，Pod 可以继续运行，但不会进入 Service 的可用后端；livenessProbe 失败时，kubelet 会重启容器。如果把依赖数据库的深度检查放进 liveness，数据库短暂抖动可能把所有 API Pod 重启，造成更大事故。

**深入追问**：startupProbe 可以保护启动慢的应用，避免 liveness 过早介入。生产中还要给探针设置合理的 timeout、period、failureThreshold，并结合应用日志和指标验证。

### 面试题 3：Kubernetes 滚动更新为什么可能卡住？

**一句话结论**：新 Pod 没有变 Ready 时，Deployment 会等待，不会贸然删掉旧 Pod。

**展开解释**：滚动更新要满足 `maxSurge` 和 `maxUnavailable` 约束。新 ReplicaSet 的 Pod 如果镜像拉取失败、Probe 失败、Secret 缺失或资源不足，就无法 Ready。此时 Deployment 可能保持旧 Pod 继续服务，同时 `rollout status` 卡住或超时。

**深入追问**：排查时先看 `kubectl rollout status`，再看 ReplicaSet、Pod、Events 和日志。恢复时可以修正配置继续发布，也可以 `kubectl rollout undo` 回滚。

### 面试题 4：HPA 为什么需要 metrics-server 和 resources.requests？

**一句话结论**：metrics-server 提供当前资源使用量，CPU request 提供计算利用率的基准。

**展开解释**：HPA 不是直接猜测负载，它从 metrics API 读取 Pod CPU / memory 指标，再和目标值比较。CPU 利用率通常是“当前 CPU 使用量 / CPU request”。如果没有 metrics-server，HPA 没有数据；如果没有 CPU request，HPA 无法计算百分比。

**深入追问**：CPU HPA 不适合所有业务。IO 密集、队列消费、延迟敏感服务可能需要自定义指标、外部指标或 KEDA，同时还要考虑扩容冷启动和下游容量。

### 面试题 5：Job、CronJob、DaemonSet 分别适合什么？

**一句话结论**：Job 适合一次性任务，CronJob 适合定时任务，DaemonSet 适合节点级常驻进程。

**展开解释**：数据库迁移、批量修复、一次性导入更适合 Job；日报、清理过期数据、定期巡检适合 CronJob；日志采集、监控 agent、网络插件适合 DaemonSet。它们的控制目标和 Deployment 不同，不应混用。

**深入追问**：Job 和 CronJob 要关注幂等、重试、超时和历史清理；DaemonSet 要关注权限、节点选择、滚动更新和对宿主机的影响。

### 面试题 6：为什么生产发布不建议只用 `latest` 或复用同一个 tag？

**一句话结论**：可变 tag 会让“这次发布到底运行了什么镜像”变得不可审计、不可复现。

**展开解释**：如果多个构建都推送到同一个 tag，集群中不同节点可能缓存了不同内容，回滚也无法确认回到哪个二进制。更好的做法是使用 Git SHA、构建号或 digest，并把镜像扫描、SBOM、签名和发布记录关联起来。

**深入追问**：Kubernetes 的 `imagePullPolicy`、节点缓存、私有仓库代理都会影响镜像拉取行为。生产发布应使用不可变引用，并由 CI/CD 修改 Deployment 的镜像字段。
