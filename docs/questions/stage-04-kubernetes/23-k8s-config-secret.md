# 第 23 篇：ConfigMap、Secret 与配置管理：练习题与面试题

> 本页由 [第 23 篇：ConfigMap、Secret 与配置管理](../../chapters/stage-04-kubernetes/23-k8s-config-secret.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. ConfigMap 和 Secret 的职责边界是什么？
2. 为什么 Secret 的 base64 不是加密？
3. `envFrom` 和 `configMapKeyRef` 有什么区别？
4. ConfigMap 作为环境变量和作为卷挂载时，更新行为有什么不同？
5. TLS Secret 为什么通常和 Ingress / Gateway 放在同一个 Namespace？

实操题：

1. 把 `TODO_LOG_LEVEL` 从 `info` 改成 `debug`，观察旧 Pod 环境变量不变，重启后新 Pod 生效。
2. 新增一个 ConfigMap key：`TODO_FEATURE_EXPERIMENTAL=true`，通过 `envFrom` 注入后验证 Pod 中能看到该变量。
3. 故意删除 `todo-api-auth` Secret，重启 Deployment，观察 Pod 错误；再恢复 Secret 并让服务 Ready。
4. 创建一个 `test` 版本 ConfigMap，并把 `TODO_ENV` 切换为 `test`，通过 rollout restart 验证生效。

思考题：

1. 如果生产环境要求 Secret 每 90 天轮换一次，你会如何设计流程，避免服务中断？
2. 如果多个团队共用一个集群，谁应该有读取 Secret 的权限？应用开发、SRE、CI/CD 系统、Ingress Controller 的权限边界有什么不同？
3. 如果配置文件热更新后应用没有重新加载，你会选择改应用支持 reload，还是统一滚动重启？为什么？

## 面试题

### 面试题 1：ConfigMap 和 Secret 的区别是什么？

**一句话结论**：ConfigMap 保存非敏感配置，Secret 保存敏感配置，但 Secret 的安全还依赖 RBAC、etcd 加密和密钥管理流程。

**展开解释**：ConfigMap 适合运行环境、日志级别、功能开关、配置文件模板等内容。Secret 适合密码、Token、私钥、JWT Secret、镜像拉取凭据等敏感数据。Secret 默认是 base64 编码，不等于加密，拥有读取权限的人可以还原原文。

**深入追问**：生产环境应限制 Secret 读取权限，开启 etcd 加密，避免把 Secret 打进日志或 Git，并建立密钥轮换流程。

### 面试题 2：ConfigMap 更新后，Pod 会自动使用新配置吗？

**一句话结论**：不一定。环境变量不会热更新，卷挂载文件会更新，但应用是否重新加载取决于程序实现。

**展开解释**：容器启动时环境变量已经固定，ConfigMap / Secret 后续变化不会改变进程环境。通过 volume 挂载的 ConfigMap 文件会由 kubelet 周期性更新，但如果应用只在启动时读取文件，仍然需要重启应用。

**深入追问**：常见做法是在配置变化后触发 Deployment 滚动重启，或者用 Helm / Kustomize 生成配置 hash annotation，让 Pod template 变化并产生新 ReplicaSet。

### 面试题 3：`envFrom` 有什么风险？

**一句话结论**：`envFrom` 简洁，但会把对象里的所有 key 都注入容器，配置边界不如逐项引用清晰。

**展开解释**：如果 ConfigMap 中新增了一个 key，使用 `envFrom` 的容器会自动得到这个环境变量。对于统一前缀、同一应用专用的配置对象，这很方便；对于共享 ConfigMap 或敏感边界严格的团队，逐项 `configMapKeyRef` / `secretKeyRef` 更容易审查。

**深入追问**：生产中可以约定每个 ConfigMap 只服务一个应用，并用命名规范、代码评审和策略工具限制配置扩散。

### 面试题 4：Kubernetes Secret 如何做生产加固？

**一句话结论**：用最小权限 RBAC 控制读取，开启 etcd 静态加密，避免明文入 Git，并接入外部密钥管理和轮换流程。

**展开解释**：Secret 对象本身不是完整安全方案。需要限制谁能 `get/list/watch` Secret，避免管理员之外的角色批量读取；etcd 存储层应启用 encryption at rest；GitOps 场景应使用 Sealed Secrets 或 External Secrets；应用日志和审计日志必须脱敏。

**深入追问**：Secret 轮换要考虑应用是否支持多密钥、旧 Token 失效策略、滚动重启顺序和回滚风险。

### 面试题 5：镜像拉取 Secret 和应用 Secret 有什么区别？

**一句话结论**：镜像拉取 Secret 给 kubelet 拉镜像使用，应用 Secret 注入容器给应用进程使用。

**展开解释**：`kubernetes.io/dockerconfigjson` Secret 通常通过 `imagePullSecrets` 引用，作用在 Pod 拉取私有镜像阶段。应用 Secret 例如 `TODO_JWT_SECRET` 通过环境变量或文件挂载进入容器，被业务进程读取。二者的读取者、权限边界和泄露影响不同。

**深入追问**：生产中镜像拉取 Secret 可以绑定到 ServiceAccount，应用 Secret 则应按 Namespace 和应用拆分，避免一个应用读取另一个应用的密钥。
