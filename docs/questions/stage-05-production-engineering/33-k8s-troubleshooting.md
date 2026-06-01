# 第 33 篇：Kubernetes 生产排障：练习题与面试题

> 本页由 [第 33 篇：Kubernetes 生产排障](../../chapters/stage-05-production-engineering/33-k8s-troubleshooting.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. Pod `STATUS` 显示 `Pending` 时，为什么不能只看 `kubectl logs`？
2. `CrashLoopBackOff` 和 `ImagePullBackOff` 的本质区别是什么？
3. 为什么 Service DNS 能解析，但请求仍然可能超时？
4. PVC `Pending` 时，应该同时检查哪几个对象？
5. 为什么 distroless 镜像中没有 shell 不是缺陷？

**实操题**

1. 用本篇 YAML 注入 `Pending` 故障，并写出 Event 中的关键原因。验收标准：能指出具体调度约束。
2. 用 `stern` 同时观察 Todo API 和故障演练 Pod 日志。验收标准：能过滤出 `todo-*` 相关日志。
3. 使用 `kubectl debug` 进入 Todo API Pod 的临时容器并执行一次 DNS 查询。验收标准：能解析 `todo-platform.todo-dev.svc.cluster.local`。

**思考题**

1. 如果生产环境出现 `OOMKilled`，你会如何判断是代码泄漏、流量突增还是 limit 设置不合理？
2. 如果 Argo CD 自动把你手工修复的 Deployment 改回故障状态，你会如何调整修复流程？

## 面试题

### 面试题 1：Pod 一直 Pending，你会怎么排查？

**一句话结论**：先看 `describe pod` 的 Event，再按调度约束、资源请求、污点容忍和 PVC 绑定逐层排查。

**展开解释**：Pending 表示 Pod 还没有成功调度或必要依赖没准备好。`kubectl logs` 通常没用，因为容器可能还没启动。要先看 `FailedScheduling`，确认是 CPU/内存不足、nodeSelector/affinity 不匹配、taint 没有 toleration，还是 PVC 未绑定。如果是 PVC，继续看 PVC 和 StorageClass 的 Event。

**深入追问**：为什么 requests 会影响调度？调度器根据 requests 计算节点是否有可分配资源，limits 不直接决定能不能调度。

### 面试题 2：CrashLoopBackOff 怎么定位根因？

**一句话结论**：看上一次容器日志、退出码、lastState 和 Event，判断是应用退出、配置错误、探针问题还是依赖不可用。

**展开解释**：CrashLoopBackOff 是 kubelet 重启失败容器后的退避状态。关键命令是 `kubectl logs POD --previous`，因为当前容器可能刚重启没有日志。还要看 `lastState.terminated.reason`、`exitCode`、restart count 和 Event。对于 Todo API，常见原因包括启动参数错误、JWT Secret 缺失或配置校验失败。

**深入追问**：如果日志为空怎么办？检查容器是否还没启动成功、入口命令是否不存在、镜像是否 distroless、是否需要看 kubelet Event 或容器 runtime 错误。

### 面试题 3：如何排查 Kubernetes Service 不通？

**一句话结论**：按 DNS、Service、EndpointSlice、Pod readiness、端口和 NetworkPolicy 的顺序排查。

**展开解释**：先确认 Service 名称能否解析，再看 Service selector 是否匹配 Pod label。EndpointSlice 为空通常说明 selector 错误或 Pod 未 Ready。EndpointSlice 有地址但请求失败时，再看 targetPort 名称、容器监听端口和 NetworkPolicy。Ingress 502 还要继续检查 Ingress Controller 日志和后端 Service。

**深入追问**：为什么 EndpointSlice 比 Endpoints 更值得看？新版本 Kubernetes 主要使用 EndpointSlice 表达后端切片，能承载更多 endpoint 和更丰富条件。

### 面试题 4：OOMKilled 与 CPU Throttling 有什么区别？

**一句话结论**：OOMKilled 是内存超过 limit 被杀，CPU Throttling 是 CPU 使用超过 limit 后被限速。

**展开解释**：OOMKilled 会导致容器退出并重启，常见 exit code 是 137。CPU Throttling 不一定让容器退出，但会让请求变慢，P95/P99 延迟升高。排查内存看 `lastState`、`container_memory_working_set_bytes`；排查 CPU throttling 看 `container_cpu_cfs_throttled_periods_total` 和延迟指标。

**深入追问**：生产中为什么不建议不给 limit？没有 limit 会增加节点资源争抢和驱逐风险；但 limit 过低又会造成 OOM 或 throttling，需要结合压测和历史指标设计。

### 面试题 5：GitOps 环境中如何处理线上紧急修复？

**一句话结论**：可以用临时操作止血，但永久修复必须回到 Git，并通过 Argo CD 同步。

**展开解释**：GitOps 的期望状态在 Git，不在某个人的终端里。生产故障时可以临时扩容、回滚镜像或修改配置止血，但要记录操作，并尽快把修复提交到 GitOps 仓库。否则 Argo CD self-heal 可能覆盖手工修复，或者长期留下实际状态与 Git 不一致的 drift。

**深入追问**：如何降低紧急修复风险？使用预定义 runbook、最小权限、审计日志、变更窗口、回滚命令和事后复盘。
