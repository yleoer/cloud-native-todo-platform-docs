# 第 39 篇：Operator 高级机制：练习题与面试题

> 本页由 [第 39 篇：Operator 高级机制](../../chapters/stage-06-platform-operator/39-operator-advanced.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. OwnerReference 和 Finalizer 都能参与删除流程，它们分别解决什么问题？为什么不能互相替代？
2. Mutating Webhook 和 Validating Webhook 的执行目的有什么不同？各举一个 TodoApp 场景。
3. 为什么 `replicas` 和 `port` 改成指针字段后更适合做默认值注入？
4. Conditions、Events 和 Controller 日志分别适合回答哪类排障问题？
5. conversion webhook 解决什么问题？什么情况下只维护多个 CRD 版本还不够？

### 9.2 实操题

1. 给 Webhook 增加规则：镜像必须来自公司内部仓库前缀 `registry.example.com/`。验收标准：外部镜像被拒绝，内部镜像可以创建。
2. 修改 Finalizer 清理函数，模拟删除一个外部 DNS 记录。验收标准：清理成功后删除继续，清理失败时 `TodoApp` 保持 `Terminating` 并写入 Warning Event。
3. 给 Conditions 增加 `Degraded` 类型，当 Deployment Ready 副本数长期小于期望值时置为 `True`。验收标准：镜像不可拉取时能在 status 中看到 `Degraded=True`。

### 9.3 思考题

1. 如果 Webhook 规则升级后会拒绝历史上已经存在的 `TodoApp`，你会如何设计灰度、回滚和兼容策略？
2. 如果 Finalizer 清理的是云数据库实例，怎样避免误删生产数据库？你会记录哪些外部资源标识和审计信息？

## 面试题

### 面试题 1：OwnerReference 和 Finalizer 的区别是什么？

**一句话结论**：OwnerReference 让 Kubernetes garbage collector 清理集群内子资源，Finalizer 让 Controller 在主资源删除前执行自定义清理逻辑。

**展开解释**：Deployment、Service 这类 Kubernetes dependent 可以通过 OwnerReference 归属于 `TodoApp`，owner 删除后由 garbage collector 清理。外部数据库、DNS、云负载均衡这类资源不是 Kubernetes dependent，必须由 Controller 在 Finalizer 阶段主动清理。

**深入追问**：Finalizer 为什么会导致资源卡住？因为只要 finalizer 字符串还在 metadata 中，对象就不会真正删除。Controller 故障或清理逻辑失败都会让对象停在 `Terminating`。

### 面试题 2：Admission Webhook 适合做什么，不适合做什么？

**一句话结论**：Webhook 适合快速、确定地做默认值和校验，不适合做慢速外部调用或创建资源。

**展开解释**：Webhook 位于 API server 写路径上，执行太慢会拖慢用户请求，故障会影响资源创建更新。默认镜像、检查副本数、拒绝 `latest` 标签适合 Webhook；创建数据库、等待 Pod Ready、访问第三方系统不适合 Webhook，应该交给 Reconciler。

**深入追问**：如果 Webhook 必须访问外部系统怎么办？优先重新设计，改为异步 Reconcile；确实必须访问时，要设置短超时、缓存结果、明确 failurePolicy，并评估 API server 写路径风险。

### 面试题 3：为什么 Conditions 要使用固定 type，而不是每次追加一条？

**一句话结论**：Condition 表达当前状态，不是历史日志；固定 type 可以让机器和人稳定读取。

**展开解释**：`Ready=True`、`Ready=False` 是同一类状态的不同取值，应该更新同一个 Condition。每次追加新 Condition 会让对象越来越大，也会让自动化系统不知道该读哪一条。历史变化应该交给 Event、日志和审计系统。

**深入追问**：`ObservedGeneration` 有什么作用？它表示 Controller 观察并处理到的 spec generation。若 `metadata.generation` 大于 `status.observedGeneration`，说明 status 可能还没反映最新 spec。

### 面试题 4：MutatingAdmissionPolicy 和 Mutating Webhook 如何取舍？

**一句话结论**：简单、无副作用、能用 CEL 表达的默认值可以考虑 MutatingAdmissionPolicy，复杂逻辑仍然使用 Webhook。

**展开解释**：MutatingAdmissionPolicy 不需要维护服务和证书，适合简单字段补全。Webhook 可以使用 Go 代码处理复杂规则、跨字段逻辑和版本演进，但也带来部署、证书和可用性成本。

**深入追问**：为什么本篇仍然保留 Webhook？因为我们还需要 programmatic validation、更新前后对象对比和与 Kubebuilder 项目生成流程对齐，这些更适合 Webhook。

### 面试题 5：CRD 多版本升级的核心风险是什么？

**一句话结论**：核心风险是破坏已有用户的 YAML 和控制器对对象结构的假设。

**展开解释**：一旦 `TodoApp` 被业务团队写进 GitOps 仓库，字段就是契约。直接重命名字段、改变类型或收窄枚举会让旧对象无法更新。生产 Operator 通常先新增版本，保证 storage version 和 served versions 的转换，再通过 conversion webhook 保持兼容。

**深入追问**：什么时候必须使用 conversion webhook？当不同版本之间字段结构不再一一对应，或者需要在读写时做语义转换时，就需要 conversion webhook。
