# 第 38 篇：Kubebuilder 入门：练习题与面试题

> 本页由 [第 38 篇：Kubebuilder 入门](../../chapters/stage-06-platform-operator/38-kubebuilder.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. Kubebuilder 项目中 `api/` 和 `internal/controller/` 分别放什么？为什么不要把 API 类型和 Reconcile 逻辑混在一个文件里？
2. `make generate` 和 `make manifests` 的输出分别是什么？修改 `TodoAppSpec` 后为什么两个命令通常都要执行？
3. `+kubebuilder:subresource:status` 解决了什么问题？如果没有 status subresource，用户和 Controller 同时写对象会有什么风险？
4. controller-runtime 默认 client 为什么可能读到缓存中的旧数据？这种行为对 Reconcile 设计有什么影响？
5. `For(&TodoApp{})` 和 `Owns(&Deployment{})` 在 Controller 注册中分别表示什么？

### 9.2 实操题

1. 给 `TodoAppSpec` 增加 `resources` 字段，用来声明 CPU 和内存 requests。验收标准：`make manifests` 后 CRD schema 中能看到 `resources` 字段，并且 Deployment container 中出现对应 requests。
2. 给 `TodoApp` 增加 `Service` 打印列，显示 Service 端口。验收标准：执行 `kubectl get todoapp` 时能看到新增列，且值来自 `spec.port`。
3. 把示例镜像从 `registry.cn-guangzhou.aliyuncs.com/yleoer/hello:plain-text` 改成课程 Todo API 镜像，并通过 `kubectl port-forward` 访问健康检查接口。验收标准：curl 返回 Todo API 的健康检查响应。

### 9.3 思考题

1. 如果业务团队希望一个 `TodoApp` 同时管理 PostgreSQL、Redis、Deployment、Service、Ingress、ServiceMonitor 和告警规则，你会把所有逻辑放在一个 Reconciler 里，还是拆成多个 Reconciler？为什么？
2. 如果 Controller 创建 Deployment 成功，但回写 status 失败，下次 Reconcile 应该怎么处理？这个场景为什么能体现幂等设计的重要性？

## 面试题

### 面试题 1：Kubebuilder 和 controller-runtime 的关系是什么？

**一句话结论**：Kubebuilder 是项目脚手架和生成工具，controller-runtime 是运行 Controller 的库。

**展开解释**：Kubebuilder 负责初始化项目、创建 API、生成 CRD/RBAC、提供 Makefile 和部署清单。controller-runtime 提供 Manager、cache、client、Reconciler、Builder、leader election 等运行时能力。Kubebuilder 生成的 Controller 代码本质上是在使用 controller-runtime。

**深入追问**：不用 Kubebuilder 能不能用 controller-runtime？可以。Kubebuilder 不是必需依赖，但它提供了一套成熟目录结构和生成流程，团队协作成本更低。

### 面试题 2：kubebuilder marker 是什么？为什么生产项目要重视它？

**一句话结论**：marker 是写在 Go 注释里的生成指令，会被转换成 CRD、RBAC、Webhook 等配置。

**展开解释**：例如 `+kubebuilder:validation:Minimum=1` 会生成 OpenAPI 数值校验，`+kubebuilder:rbac` 会生成 ClusterRole 权限，`+kubebuilder:subresource:status` 会启用 status subresource。marker 写错不是注释无效这么简单，而是会直接影响 API 校验、权限和运行行为。

**深入追问**：如何避免 marker 漂移？把 `make manifests` 纳入 CI，要求生成文件无 diff，并对关键 CRD schema 做兼容性评审。

### 面试题 3：controller-runtime client 为什么默认读缓存？

**一句话结论**：读缓存可以减少 API server 压力，提高 Controller 在大量对象场景下的性能。

**展开解释**：Controller 通常要频繁读取被管理对象和子资源。如果每次都直接访问 API server，大规模集群中很容易触发限流。cache 通过 List-Watch 同步对象，本地读取速度更快、压力更小。

**深入追问**：读缓存的代价是什么？可能读到短暂旧状态。Reconcile 必须幂等并容忍重复执行，不能假设写后立即读一致。

### 面试题 4：OwnerReference 在 Operator 中有什么作用？

**一句话结论**：OwnerReference 表达资源归属关系，用于级联删除和子资源事件反向触发主资源 Reconcile。

**展开解释**：本篇中 Deployment 和 Service 都由 `TodoApp` 拥有。删除 `TodoApp` 时，garbage collector 可以清理子资源；Deployment 状态变化时，controller-runtime 可以通过 `Owns` 把事件映射回拥有者 `TodoApp`。

**深入追问**：OwnerReference 有什么限制？跨 namespace owner reference 不能随意使用，外部云资源也不能靠 Kubernetes garbage collector 清理，这些场景需要 Finalizer 或显式引用索引。

### 面试题 5：如何判断一个 Reconciler 是否幂等？

**一句话结论**：同一个输入状态下多次执行 Reconcile，最终集群状态一致，不产生重复资源或无意义副作用。

**展开解释**：幂等 Reconciler 会先读取当前状态，再创建缺失资源、更新差异字段、跳过已满足状态。它不会因为收到重复事件就重复创建 Service，也不会每次都写 status 造成事件风暴。

**深入追问**：怎么测试？连续创建同一个 `TodoApp`、重复 apply 同一份 YAML、重启 Controller，再观察 Deployment/Service 数量、status 更新频率和日志错误是否稳定。
