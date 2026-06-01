# 第 34 篇：Kubernetes API 扩展机制：练习题与面试题

> 本页由 [第 34 篇：Kubernetes API 扩展机制](../../chapters/stage-06-platform-operator/34-k8s-api-extension.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. Kubernetes 中 Resource 和 Kind 有什么区别？
2. 为什么 `Pod` 的 `apiVersion` 是 `v1`，而 Deployment 是 `apps/v1`？
3. GVK 和 GVR 分别在哪些场景中出现？
4. 为什么说 CRD 只是扩展 API，而不是自动化逻辑？
5. `spec` 和 `status` 为什么要分开？

**实操题**

1. 使用 `kubectl get --raw /apis/apps/v1` 找到 `deployments` 的 discovery 信息。验收标准：能指出 `kind`、`namespaced` 和 `verbs`。
2. 为 `TodoApp` 增加一个 `spec.autoscaling` 草案字段。验收标准：字段只描述期望状态，不包含实际副本数。
3. 为 `TodoApp` 设计一个 `Degraded` condition 示例。验收标准：包含 `type`、`status`、`reason`、`message` 和 `lastTransitionTime`。
4. 如果你使用 Windows PowerShell，把本篇 Bash 文件生成命令改写成 PowerShell here-string。验收标准：三个文件内容与 Bash 版本等价。

**思考题**

1. 如果把所有 Helm values 原样塞进 `TodoApp.spec.values`，会带来什么长期维护问题？
2. 如果用户可以修改 `status.conditions`，会对排障、告警和自动化产生什么风险？

## 面试题

### 面试题 1：Kubernetes 为什么容易扩展？

**一句话结论**：因为 Kubernetes 把集群能力抽象成资源化、声明式 API，并允许通过 CRD 注册新的资源类型，再由 Controller 基于 watch 和 reconcile 实现自动化。

**展开解释**：API server 负责校验、存储、鉴权和 watch；CRD 让 API server 认识新的 kind；Controller 监听这些对象并调谐底层资源。这样平台团队可以把业务运维知识封装成新的 Kubernetes API，而不需要修改 kube-apiserver 源码。

**深入追问**：CRD 和 Aggregated API Server 有什么区别？CRD 适合大多数声明式资源扩展，API server 负责存储；Aggregated API Server 适合需要自定义存储、复杂子资源或特殊协议行为的高级扩展。

### 面试题 2：GVK 和 GVR 有什么区别？

**一句话结论**：GVK 描述对象类型，GVR 描述 REST API 资源路径。

**展开解释**：YAML 中的 `apiVersion: apps/v1` 和 `kind: Deployment` 是 GVK 视角；API path 和 RBAC 中的 `resources: ["deployments"]` 是 GVR 视角。kubectl 和 client-go 会通过 discovery 和 RESTMapper 在两者之间映射。

**深入追问**：为什么要关心这个区别？写 Controller、RBAC、动态客户端和排查 `no matches for kind` 时，混淆 GVK/GVR 会直接导致 watch 不到对象或权限配置错误。

### 面试题 3：CRD 安装后，为什么创建 CR 不一定有业务资源生成？

**一句话结论**：CRD 只让 API server 认识和存储新资源，业务资源的创建需要 Controller。

**展开解释**：安装 `TodoApp` CRD 后，API server 可以接受 `TodoApp` 对象并存储到 etcd，但它不知道 TodoApp 应该对应哪些 Deployment、Service 或 Ingress。只有 Todo Controller 监听到 TodoApp 后，才会执行调谐逻辑。

**深入追问**：如果 Controller 停止了会怎样？已创建的底层资源通常还在，但新的 spec 变更不会被调谐，status 也不会更新。排障时要同时看 CR、Controller Pod、Event、日志和 status.conditions。

### 面试题 4：为什么 status 应该作为 subresource？

**一句话结论**：status subresource 可以把用户修改 spec 和 Controller 回写 status 的权限与更新路径分开。

**展开解释**：用户通常应该能创建和更新 `todoapps`，但不应该伪造 `todoapps/status`。Controller 回写 status 时也不应该覆盖用户刚刚修改的 spec。status subresource 提供了更清晰的 RBAC 和并发更新边界。

**深入追问**：没有 status subresource 会有什么风险？用户和 Controller 都更新同一个主资源，容易产生字段冲突；RBAC 也很难精细限制谁能写运行状态。

### 面试题 5：如何设计一个好的 Conditions？

**一句话结论**：Conditions 要稳定、结构化、可机器判断，用 `type` 表达状态维度，用 `status` 表达真假或未知，用 `reason` 和 `message` 解释原因。

**展开解释**：常见字段包括 `type`、`status`、`reason`、`message`、`lastTransitionTime`、`observedGeneration`。`type` 和 `reason` 应尽量稳定，便于 UI、告警和脚本消费；`message` 可以提供更详细的人类可读解释。

**深入追问**：Conditions 和日志有什么区别？Conditions 是资源当前状态摘要，适合快速判断和自动化；日志是过程记录，适合追踪细节。两者都需要，但不能互相替代。
