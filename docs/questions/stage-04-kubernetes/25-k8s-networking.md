# 第 25 篇：Kubernetes 网络原理：练习题与面试题

> 本页由 [第 25 篇：Kubernetes 网络原理](../../chapters/stage-04-kubernetes/25-k8s-networking.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. Pod IP、Service ClusterIP 和 Node IP 分别解决什么问题？
2. CNI 插件在 Pod 创建过程中负责哪些事情？
3. CoreDNS 如何把 `todo-api.todo-workloads.svc.cluster.local` 解析成可访问地址？
4. Service selector 写错时，EndpointSlice 会有什么表现？
5. NetworkPolicy 的默认允许和默认拒绝规则是什么？

实操题：

1. 故意把 `todo-api` Service selector 改成错误 label，观察 EndpointSlice 和访问结果。验收标准：能说明 Service 存在但后端为空的现象。
2. 新增一个 `todo-observer` Namespace，未加 `todo-platform.io/client=allowed` 标签，验证它不能访问 Todo API；加上标签后再验证可以访问。验收标准：能解释 `namespaceSelector` 的作用。
3. 把 `allow-api-to-postgres` 中的来源 label 改错，验证 Todo API 访问 PostgreSQL 被阻断，再恢复。验收标准：能从 Pod label 和 NetworkPolicy YAML 定位原因。

思考题：

1. 如果生产环境要按“前端 -> API -> 数据库”三层隔离，你会如何设计 Namespace、标签和 NetworkPolicy？
2. 如果 Ingress 到后端 Service 返回 502，你会按什么顺序排查 DNS、Service、EndpointSlice、Pod readiness 和 NetworkPolicy？

## 面试题

### 面试题 1：Kubernetes 中 Pod 到 Service 的访问链路是什么？

**一句话结论**：客户端先通过 DNS 或 Service 名称找到 ClusterIP，再由 kube-proxy 规则把流量转发到 EndpointSlice 中的后端 Pod。

**展开解释**：Service 提供稳定名字和 ClusterIP，EndpointSlice 记录实际后端 Pod IP 和端口。kube-proxy 观察这些对象，在节点上维护转发规则。应用应该访问 Service 名称，而不是直接写 Pod IP。

**深入追问**：如果 Service 不通，要检查 DNS 是否解析、Service selector 是否匹配、EndpointSlice 是否为空、Pod 是否 Ready、NetworkPolicy 是否拦截，以及入口层是否把流量转发到正确 Service。

### 面试题 2：CNI 插件在 Kubernetes 中做什么？

**一句话结论**：CNI 插件负责为 Pod 配置网络接口、分配 IP、配置路由，并可能执行网络策略。

**展开解释**：kubelet 通过容器运行时创建 Pod sandbox，容器运行时调用 CNI 插件完成网络配置。不同 CNI 插件能力不同：有的只解决连通，有的还能执行 NetworkPolicy、加密流量或提供高级可观测性。

**深入追问**：NetworkPolicy 是否生效取决于 CNI。默认 kindnet 不执行 NetworkPolicy，而 Calico、Cilium 等插件可以执行策略。因此不能只看 NetworkPolicy 对象存在，就认为隔离已经生效。

### 面试题 3：CoreDNS 解析失败如何排查？

**一句话结论**：先确认名称是否正确，再看 CoreDNS Pod、Service 对象和 Pod 内 `/etc/resolv.conf`。

**展开解释**：跨 Namespace 建议使用完整域名，例如 `todo-api.todo-workloads.svc.cluster.local`。如果 Service 不存在或 Namespace 写错，CoreDNS 无法返回正确记录。CoreDNS Pod 不 Ready、日志报错或 Pod resolv.conf 异常，也会导致解析失败。

**深入追问**：DNS 解析成功不代表服务可用。解析只说明名字到地址这一步完成了，还要继续检查 EndpointSlice、后端 Pod readiness、kube-proxy 转发和 NetworkPolicy。

### 面试题 4：NetworkPolicy 是默认拒绝还是默认允许？

**一句话结论**：没有被策略选中的 Pod 默认允许；一旦被某个方向的策略选中，该方向就只允许策略明确放行的流量。

**展开解释**：NetworkPolicy 是允许列表模型。创建一个 `podSelector: {}` 且 `policyTypes: [Ingress]` 的策略，会让该 Namespace 内所有 Pod 的入口流量进入默认拒绝状态。后续需要用其它策略逐项放行。

**深入追问**：Ingress 和 Egress 是两个方向，互不自动等价。只限制 Ingress 时，Pod 出口流量仍可能默认允许；生产策略要同时考虑谁访问我，以及我能访问谁。

### 面试题 5：kube-proxy iptables 和旧 IPVS 模式有什么区别？

**一句话结论**：iptables 模式通过节点上的规则链做 Service 转发；IPVS 模式曾用 Linux IPVS 做虚拟服务负载均衡，但已进入 deprecated 路径，本课程只把它作为旧集群背景知识。

**展开解释**：iptables 模式会把访问 ClusterIP 的流量通过 DNAT 转到后端 Pod。IPVS 模式在旧集群里常用于更高规模的 Service 转发，但 Kubernetes 官方从 v1.35 起已将 IPVS proxy mode 标记为 deprecated，并推荐 nftables 作为更现代的替代方向。学习时要知道这些模式的历史差异，但实操应以当前课程锁定版本和发行版默认配置为准。

**深入追问**：接手旧集群时，应先看 kube-proxy ConfigMap、节点内核模块和发行版文档，再决定排障工具。升级前要确认旧模式是否仍受支持，以及迁移到 iptables / nftables 会不会影响业务流量。
