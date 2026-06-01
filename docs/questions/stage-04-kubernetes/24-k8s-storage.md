# 第 24 篇：Kubernetes 存储：练习题与面试题

> 本页由 [第 24 篇：Kubernetes 存储](../../chapters/stage-04-kubernetes/24-k8s-storage.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. `emptyDir` 和 PVC 的生命周期有什么不同？
2. PV 和 PVC 分别由谁关心？为什么 Pod 通常引用 PVC 而不是直接引用 PV？
3. StorageClass 在动态供给中负责什么？
4. StatefulSet 相比 Deployment 解决了哪些有状态服务问题？
5. 为什么 PVC 不等于数据库备份？

实操题：

1. 不要直接修改 StatefulSet 的 `volumeClaimTemplates` 来扩容，这类字段通常不可原地更新。请先查看当前 StorageClass 是否允许扩容，再尝试 patch 已生成的 PVC：`kubectl -n todo-workloads patch pvc postgres-data-todo-postgres-0 -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'`。验收标准：能说明当前 kind 默认 StorageClass 是否支持扩容，以及 `kubectl describe pvc` 中的事件含义。
2. 故意把 `todo-api-database` Secret 中的 Service 名写成 `todo-postgres-wrong`，重新运行迁移 Job，记录失败日志，再恢复正确 DSN。验收标准：能从 Job 日志中定位 DNS 或连接错误。
3. 删除 `todo-postgres-0` Pod，但不要删除 PVC，验证数据仍然存在；随后在确认不需要数据的前提下删除 PVC，再解释两次操作的结果差异。

思考题：

1. 如果团队要求 PostgreSQL 每天凌晨备份，并且能恢复到任意 15 分钟内的时间点，你会如何设计备份、WAL 归档、恢复演练和权限边界？
2. 如果生产环境已经有云厂商托管 PostgreSQL，你还会把数据库放进 Kubernetes 吗？哪些场景适合放，哪些场景不适合？

## 面试题

### 面试题 1：PV、PVC 和 StorageClass 的关系是什么？

**一句话结论**：PVC 是应用的存储申请，PV 是集群提供的存储资源，StorageClass 定义如何动态创建 PV。

**展开解释**：应用通常只声明 PVC：需要多大容量、什么访问模式、哪个存储类。Kubernetes 根据 PVC 和 StorageClass 创建或匹配 PV，并把 PVC 绑定到 PV。Pod 通过 PVC 挂载存储，不关心底层是云硬盘、本地盘还是网络存储。

**深入追问**：如果 PVC 一直 `Pending`，要检查 StorageClass 是否存在、是否默认、provisioner 是否正常、访问模式是否支持，以及事件里是否有容量或权限错误。

### 面试题 2：为什么数据库更适合用 StatefulSet，而不是 Deployment？

**一句话结论**：StatefulSet 提供稳定 Pod 名称、稳定网络身份和与 Pod 绑定的 PVC 模板，更适合有状态服务。

**展开解释**：Deployment 面向无状态副本，Pod 名称和副本替换都是临时的。数据库需要稳定身份和稳定数据目录，StatefulSet 的 `todo-postgres-0`、Headless Service DNS 和 `volumeClaimTemplates` 能把身份与存储关联起来。

**深入追问**：StatefulSet 不是数据库高可用方案。它只是 Kubernetes 工作负载控制器，复制、备份、故障切换和一致性仍然要由数据库自身、Operator 或外部平台解决。

### 面试题 3：删除 Pod、删除 StatefulSet 和删除 PVC 分别会发生什么？

**一句话结论**：删除 Pod 会被 StatefulSet 重建并复用 PVC；删除 StatefulSet 会停止管理 Pod，但 PVC 通常仍在；删除 PVC 可能导致底层数据被删除。

**展开解释**：StatefulSet 负责维持期望副本数，所以删除 `todo-postgres-0` 后会创建新的 `todo-postgres-0`。删除 StatefulSet 时，如果不级联删除 PVC，数据声明还在。删除 PVC 才是危险操作，因为 PV 的回收策略可能删除底层磁盘。

**深入追问**：生产环境要用 RBAC、审批、备份和 ReclaimPolicy 约束 PVC 删除。误删 PVC 后，不能指望 Kubernetes 自动恢复数据，只能依赖备份或底层存储快照。

### 面试题 4：为什么 PVC 不等于备份？

**一句话结论**：PVC 是在线数据存储，备份是独立副本和恢复流程，两者解决的问题不同。

**展开解释**：PVC 能让 Pod 重建后继续使用同一份数据，但如果数据被误删、表被错误迁移、底层存储损坏或 PVC 被删除，PVC 本身无法提供历史版本。备份需要离线或异地副本、保留策略、恢复命令和验证流程。

**深入追问**：成熟方案通常结合逻辑备份、物理备份、WAL 归档和定期恢复演练，并用 RPO/RTO 指标定义业务可接受的损失范围。

### 面试题 5：Kubernetes 中运行 PostgreSQL 的生产风险有哪些？

**一句话结论**：核心风险是数据可靠性、故障切换、备份恢复、性能抖动、权限边界和运维复杂度。

**展开解释**：数据库比无状态 API 更依赖磁盘性能、稳定网络、升级策略和恢复能力。Kubernetes 可以管理 Pod 和 PVC，但不会自动解决数据库复制、一致性、备份、慢查询和容量规划。没有数据库平台能力的团队，生产中更适合使用托管 PostgreSQL。

**深入追问**：如果必须自建，应优先选择成熟 Operator，明确主从复制、自动故障切换、备份恢复、监控告警、版本升级和演练流程，而不是只写一个 StatefulSet。
