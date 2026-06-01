# 第 28 篇：Kustomize 多环境配置管理：练习题与面试题

> 本页由 [第 28 篇：Kustomize 多环境配置管理](../../chapters/stage-04-kubernetes/28-kustomize.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. 用一句话解释 Kustomize base 和 overlay 的区别。
2. `configMapGenerator` 默认追加 hash 后缀解决什么问题？
3. 为什么本篇关闭 Helm Secret 模板，改用 overlay 的 `secretGenerator`？
4. `kubectl kustomize` 和 `kubectl apply -k` 的区别是什么？
5. 为什么 RoleBinding subject Namespace 和 Role `resourceNames` 需要显式 patch？

### 9.2 实操题

1. 给 dev overlay 增加一个 `TODO_RELEASE=chapter-28-dev-v2`，重新 `kubectl apply -k`，观察 ConfigMap 名称和 Pod 是否滚动更新。
2. 给 test overlay 增加一个 JSON Patch，把 Deployment 的 `terminationGracePeriodSeconds` 改为 `20`，用 `kubectl kustomize` 验证输出。
3. 给 prod overlay 的 `images` 增加 `digest` 字段，思考 tag 与 digest 同时出现时团队应该如何制定发布规范。

### 9.3 思考题

1. 如果某个字段 dev/test/prod 都会变，它应该放 Helm values，还是放 Kustomize overlay？判断依据是什么？
2. GitOps 控制器同步的是 `overlays/prod`。如果 base 由 Helm 重新渲染，应该如何审查这次变更是否安全？

## 面试题

### 面试题 1：Kustomize 和 Helm 的核心区别是什么？

**一句话结论**：Helm 是应用打包与 release 管理工具，Kustomize 是对已有 Kubernetes YAML 做环境叠加和补丁的工具。

**展开解释**：Helm 用模板和 values 生成对象，并记录 release history；Kustomize 不维护 release 状态，而是从 base 和 overlay 生成最终 YAML。Helm 更适合分发应用包，Kustomize 更适合管理环境差异和 GitOps 目录。

**深入追问**：两者可以组合使用。常见方式是 Helm 渲染 base，Kustomize overlay 管理环境差异；也可以由 Argo CD 分别支持 Helm source 和 Kustomize source。

### 面试题 2：为什么 ConfigMap / Secret generator 默认带 hash？

**一句话结论**：hash 后缀让配置内容变化反映到对象名和 Pod template 中，从而触发滚动更新。

**展开解释**：Kubernetes 不会因为 ConfigMap 内容变化自动重启 Pod。Kustomize 生成新名字后，会自动改写 Deployment 中的引用，Pod template 变化，Deployment 才会创建新 ReplicaSet。

**深入追问**：生产环境不要为了“名字好看”轻易关闭 hash。固定名适合少数外部系统约定场景，但需要额外设计滚动重启机制。

### 面试题 3：Kustomize patch 为什么应该尽量小？

**一句话结论**：小 patch 更容易审查、定位和组合，大 patch 会让 overlay 变成第二套 base。

**展开解释**：overlay 的价值是只描述环境差异。如果复制完整 Deployment，base 升级时 overlay 很可能漏同步，最终 dev、test、prod 实际运行结构越来越分裂。

**深入追问**：生产评审中可以要求 patch 文件名表达意图，并在 CI 中输出最终渲染 YAML 做策略检查。

### 面试题 4：为什么 `namespace:` 不一定能修正所有 Namespace 引用？

**一句话结论**：Kustomize 会处理 Kubernetes 对象常见的 Namespace 字段，但不会推断每个字符串都代表 Namespace。

**展开解释**：对象的 `metadata.namespace` 会被 transformer 设置，但 RoleBinding `subjects[].namespace` 如果来自 Helm 渲染并写成固定值，就需要显式 patch。否则 RoleBinding 可能指向错误 Namespace 的 ServiceAccount。

**深入追问**：排查这类问题时，不要只看 `kubectl get rolebinding` 的 Namespace，还要看 `subjects` 内容。

### 面试题 5：Kustomize overlay 如何进入生产流水线？

**一句话结论**：生产流水线应先渲染 overlay，再做服务端 dry-run、策略校验、审查和 GitOps 同步。

**展开解释**：典型步骤包括 `kubectl kustomize overlays/prod`、`kubectl apply --dry-run=server -k overlays/prod`、禁止明文 Secret、检查资源限制和安全标签、最后由 GitOps 控制器同步到集群。

**深入追问**：如果 overlay 引用的 base 来自 Helm 渲染，流水线还要检查 Chart 版本、values 输入和生成 base 的命令，保证 base 可追溯。
