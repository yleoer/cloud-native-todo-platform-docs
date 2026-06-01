# 第 26 篇：Kubernetes 安全：练习题与面试题

> 本页由 [第 26 篇：Kubernetes 安全](../../chapters/stage-04-kubernetes/26-k8s-security.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. ServiceAccount 和 Kubernetes Namespace 是什么关系？为什么不建议所有业务 Pod 都使用 `default` ServiceAccount？
2. RoleBinding 可以绑定 ClusterRole 吗？如果可以，它的权限范围是 Namespace 还是整个集群？
3. 为什么 `list secrets` 不是一个安全的“只读权限”？
4. `allowPrivilegeEscalation: false` 和 `runAsNonRoot: true` 分别解决什么问题？
5. Pod Security Standards 中 Baseline 和 Restricted 的差异是什么？

实操题：

1. 把 `todo-api-config-reader` 的权限从指定 ConfigMap 扩展为读取本 Namespace 所有 ConfigMap，再用 `kubectl auth can-i list configmaps` 验证变化。完成后恢复最小权限。
2. 修改 `bad-privileged-pod.yaml`，逐项修复它违反 Restricted 的字段，直到 `kubectl apply --dry-run=server` 通过。
3. 生成一个 `todo-registry-pull` 镜像拉取密钥文件，并把它加入 `todo-api-sa` 的 `imagePullSecrets`。不要把真实密码提交到仓库。

思考题：

1. 如果某个控制器确实需要跨 Namespace 读取资源，应该如何在 ClusterRole、ClusterRoleBinding 和 Namespace 隔离之间做权衡？
2. User Namespaces、非 root、Pod Security Admission、NetworkPolicy 和 RBAC 分别位于哪一层？其中任意一层配置正确，是否可以替代其它层？

## 面试题

### 面试题 1：ServiceAccount、Role 和 RoleBinding 如何配合？

**一句话结论**：ServiceAccount 表示工作负载身份，Role 定义权限，RoleBinding 把这个身份和权限绑定在某个 Namespace 内。

**展开解释**：Pod 通过 `serviceAccountName` 使用 ServiceAccount。Role 中的 rules 描述 API Group、Resource、Verb 和可选的 ResourceName。RoleBinding 的 subjects 指向 ServiceAccount，roleRef 指向 Role。最终 kube-apiserver 在鉴权时根据请求身份和 RBAC 规则判断 allow 或 deny。

**深入追问**：ClusterRole 可以通过 RoleBinding 绑定到某个 Namespace，从而复用权限模板但限制作用范围；ClusterRoleBinding 则把 ClusterRole 扩散到集群范围，普通业务工作负载应谨慎使用。

### 面试题 2：为什么不建议给业务 Pod 自动挂载 ServiceAccount token？

**一句话结论**：没有 API 访问需求的 Pod 不应该携带可用 API 凭据，否则应用漏洞可能变成 Kubernetes API 权限泄漏。

**展开解释**：ServiceAccount token 是 Pod 调用 API Server 的凭据。即使 RBAC 很小，只要 token 存在，攻击者拿到容器执行权后就可以尝试调用 API、探测权限边界或利用误配。`automountServiceAccountToken: false` 可以让无 API 访问需求的 Pod 不暴露 token。

**深入追问**：如果应用确实需要访问 API，应只给专用 ServiceAccount 绑定最小 Role，并优先使用短生命周期的 projected token。不要为了方便给它绑定 `cluster-admin`。

### 面试题 3：Restricted Pod Security 通常会检查哪些内容？

**一句话结论**：Restricted 会阻止特权容器、宿主机命名空间、危险卷类型、root 运行、未设置 seccomp、可提权和未丢弃 capabilities 等配置。

**展开解释**：Restricted 是面向普通业务工作负载的高约束基线。它要求 Pod 明确表达安全意图，例如非 root、`allowPrivilegeEscalation: false`、`seccompProfile: RuntimeDefault`、`capabilities.drop: [ALL]`。这些规则由 Pod Security Admission 或其它策略引擎在准入阶段执行。

**深入追问**：PSS 是策略标准，PSA 是 Kubernetes 内置执行机制。生产环境还可以配合 ValidatingAdmissionPolicy、Kyverno、Gatekeeper 或云厂商策略服务实现更细规则。

### 面试题 4：User Namespaces 和 `runAsNonRoot` 有什么区别？

**一句话结论**：`runAsNonRoot` 控制容器内进程不要以 root 运行；User Namespaces 控制容器内 UID/GID 映射到宿主机时不等于宿主机高权限用户。

**展开解释**：没有 User Namespaces 时，容器内 root 在内核视角仍可能与宿主机 root 有危险关联。启用 `hostUsers: false` 后，容器内用户被映射到宿主机上的非特权范围，降低容器逃逸后的破坏力。即便如此，普通业务仍应优先非 root 运行。

**深入追问**：User Namespaces 是 Linux-only，并依赖内核、文件系统、container runtime 和 OCI runtime 支持；它也不能与 hostNetwork、hostIPC、hostPID 同时使用。

### 面试题 5：Kubernetes Secret 的主要风险是什么？

**一句话结论**：Secret 是敏感数据对象，不是天然加密保险箱；风险来自未加密存储、过宽 RBAC、提交到 Git、被 Pod 滥挂载和应用日志泄漏。

**展开解释**：Secret 数据是 base64 编码，默认可能以未加密形式存储在 etcd 中。拥有 `get`、`list` 或 `watch` Secret 权限的主体可以读取 Secret 内容；能创建 Pod 的用户也可能通过挂载 Secret 间接读取数据。

**深入追问**：生产环境应开启 etcd 静态加密，限制 Secret RBAC，使用外部 Secret 管理系统或 CSI Driver，避免把明文或 base64 后的 Secret Manifest 提交到仓库，并建立轮换与审计机制。
