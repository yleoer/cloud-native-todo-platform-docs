# 第 22 篇：Service、Ingress 与流量入口：练习题与面试题

> 本页由 [第 22 篇：Service、Ingress 与流量入口](../../chapters/stage-04-kubernetes/22-k8s-service-ingress.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. ClusterIP、NodePort、LoadBalancer 分别解决什么问题？
2. 为什么只创建 Ingress 对象不会自动暴露服务？
3. IngressClass 和 GatewayClass 的作用有什么相似和不同？
4. TLS 终止在入口层发生时，后端 Service 看到的是 HTTP 还是 HTTPS？
5. 为什么 kind 中 LoadBalancer Service 经常显示 `<pending>`？

实操题：

1. 把 Ingress 的 `host` 从 `todo.localhost` 改成 `todo2.localhost`，重新 apply，并用 `curl --resolve todo2.localhost:18443:127.0.0.1` 验证。看到 `/readyz` 返回 `200` 说明成功。
2. 故意把 Ingress 的 `service.name` 改成 `todo-api-missing`，观察 Traefik 返回什么状态码；用 `describe ingress` 和 Traefik 日志定位后恢复。
3. 把 HTTPRoute 的 `hostnames` 改成 `todo-gw2.localhost`，验证旧域名失败、新域名成功；实验结束后改回 `todo-gateway.localhost`。

思考题：

1. 如果你的公司有 200 个 Ingress NGINX 规则，你会如何分阶段迁移到 Gateway API？
2. 如果入口层要做灰度发布、限流和统一认证，你会放在 Ingress/Gateway、Service Mesh，还是应用代码里？为什么？

## 面试题

### 面试题 1：Service 的 ClusterIP 为什么比 Pod IP 更适合被调用？

**一句话结论**：Pod IP 会随 Pod 重建变化，Service 提供稳定 DNS、稳定端口和对 Ready Pod 的负载均衡。

**展开解释**：Deployment 会不断创建、删除 Pod，直接依赖 Pod IP 会让调用方随时失效。Service 用 selector 找到一组 Pod，并由 EndpointSlice 记录 Ready 后端。调用方访问 Service DNS 或 ClusterIP，不需要知道具体 Pod IP。

**深入追问**：如果 Service selector 写错，Service 仍然存在，但 EndpointSlice 为空。排查入口 502 时，应同时看 Service selector、Pod labels、EndpointSlice 和 readinessProbe。

### 面试题 2：NodePort、LoadBalancer 和 Ingress 的区别是什么？

**一句话结论**：NodePort 暴露节点端口，LoadBalancer 请求外部负载均衡器，Ingress 管理 HTTP/HTTPS 七层路由。

**展开解释**：NodePort 是四层端口转发，适合实验或给外部 LB 做后端；LoadBalancer 依赖云控制器或本地 LB 实现；Ingress 需要 Controller，按 Host/Path 把 HTTP/HTTPS 流量转发到 Service，并可做 TLS 终止。

**深入追问**：生产入口常常是云 LoadBalancer 指向 Ingress Controller，Controller 再按 Ingress/Gateway 规则转发到业务 Service。它们不是互斥关系，而是不同层级。

### 面试题 3：为什么创建 Ingress 后没有任何效果？

**一句话结论**：Ingress 是声明，必须有 Ingress Controller 读取并实现它。

**展开解释**：Kubernetes API Server 只保存 Ingress 对象，不会自己配置 NGINX、Traefik 或云负载均衡器。Controller 需要 watch Ingress、Service、EndpointSlice、Secret，并生成实际代理配置。IngressClass 决定哪一个 Controller 处理这条规则。

**深入追问**：排查时先看 `kubectl get ingressclass`、`describe ingress`、Controller Pod 日志和 Controller 是否 Ready。多 Controller 集群里，IngressClass 写错会让规则被忽略。

### 面试题 4：Gateway API 相比 Ingress 解决了什么问题？

**一句话结论**：Gateway API 把基础设施入口和应用路由拆开，减少 annotation 依赖，更适合多团队协作。

**展开解释**：传统 Ingress 很多能力依赖 Controller-specific annotations，迁移困难，也不容易表达平台团队和应用团队的职责边界。Gateway API 用 GatewayClass、Gateway、HTTPRoute 分层，平台团队定义入口，应用团队定义路由，还能用 ReferenceGrant 控制跨 Namespace 引用。

**深入追问**：Gateway API 不是“所有 Controller 行为完全一样”的魔法。不同实现仍有扩展能力差异，迁移时要关注 conformance、扩展字段、TLS、流量拆分、鉴权和可观测性。

### 面试题 5：TLS Secret 放在哪里？为什么？

**一句话结论**：Ingress TLS Secret 必须和 Ingress 在同一 Namespace；Gateway 证书引用也要遵守 Gateway API 的引用规则。

**展开解释**：Secret 是命名空间级资源。Ingress 引用 `secretName` 时不会跨 Namespace 查找。Gateway API 可以通过更明确的引用模型和 ReferenceGrant 支持受控跨命名空间引用，但本篇为了降低复杂度，把 Gateway、HTTPRoute、TLS Secret 都放在 `todo-workloads`。

**深入追问**：生产环境中，证书 Secret 的读权限非常敏感。Ingress Controller 需要读取证书，但应用团队不一定应该能读取所有证书；这要通过 RBAC、命名空间边界和证书自动化工具设计。
