# 第 37 篇：手写简化版 Controller：练习题与面试题

> 本页由 [第 37 篇：手写简化版 Controller](../../chapters/stage-06-platform-operator/37-handwritten-controller.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. dynamic client 为什么使用 GVR，而不是直接使用 YAML 中的 kind？
2. 为什么事件处理器只入队 `namespace/name`，不直接在事件回调里 patch status？
3. `WaitForCacheSync` 解决了什么启动竞态？
4. 为什么 status 子资源需要单独的 RBAC？
5. 本篇为什么不写 `Available=True`？

**实操题**

1. 把 `--workers=1` 改成 `--workers=2` 部署，观察日志是否仍然能正常 Reconcile 同一个 `TodoApp`。
2. 修改 `TodoApp.spec.image`，验证 `metadata.generation` 增加后 `status.observedGeneration` 会跟上。
3. 临时删除 `todoapps/status` RBAC 权限，观察 Controller 日志中的 forbidden 错误，再恢复权限。

**思考题**

1. 如果要让本篇 Controller 创建 Deployment，需要新增哪些 RBAC、代码结构和状态判断？
2. 为什么生产 Controller 通常需要 leader election？
3. 如果 `TodoApp` 有上千个实例，Informer 缓存、worker 数和队列指标应该如何设计？

## 面试题

### 面试题 1：手写 Controller 的核心组件有哪些？

**一句话结论**：client-go 手写 Controller 通常由 client、Informer、Indexer、Workqueue、Worker 和 Reconcile 组成。

**展开解释**：client 负责访问 API server；Informer 负责 List-Watch 并维护本地缓存；Indexer 提供按 key 读取对象；Workqueue 提供去重、重试和限速；Worker 从队列取 key；Reconcile 根据当前状态做调谐并写回 status。

**深入追问**：为什么不是收到事件就直接处理？因为事件对象可能过期，Reconcile 应该从缓存或 API server 读取当前状态。

### 面试题 2：dynamic client 和 typed client 怎么选？

**一句话结论**：dynamic client 适合不想生成类型的通用操作，typed client 适合生产 Operator 的类型安全开发。

**展开解释**：dynamic client 操作 `unstructured.Unstructured`，只需要 GVR，不需要 Go 类型；typed client 需要类型、Scheme 和 clientset，但字段访问有编译期检查。Kubebuilder 会生成类型并使用 controller-runtime client，属于 typed 开发体验。

**深入追问**：dynamic client 最大风险是什么？字段路径是字符串，重构时编译器帮不上忙，容易把 `spec.replicas`、`status.conditions` 这类字段拼错。

### 面试题 3：为什么写 status 要走 `/status` 子资源？

**一句话结论**：`spec` 是用户期望，`status` 是系统观察结果，二者应由不同主体写入并分别授权。

**展开解释**：用户或 GitOps 系统修改 spec；Controller 回写 status。开启 status subresource 后，主资源 update/patch 不会顺手修改 status，Controller 必须请求 `/status` 路径。RBAC 也可以只授予 Controller 写 status 的权限，减少误改 spec 的风险。

**深入追问**：如果 RBAC 只有 `todoapps` 的 patch 权限，能写 status 吗？不能。需要 `todoapps/status` 的 patch 或 update 权限。

### 面试题 4：Workqueue 中 `Forget` 和 `Done` 有什么区别？

**一句话结论**：`Done` 表示本次处理结束，`Forget` 表示清理该 key 的重试历史。

**展开解释**：每次 `Get` 之后都应该 `Done`，否则队列会认为该 key 仍在处理。Reconcile 成功后还要 `Forget`，否则 rate limiter 可能保留失败历史，后续同一个 key 的重试延迟会异常增长。

**深入追问**：失败时先 `Done` 还是先 `AddRateLimited`？本篇用 `defer Done`，失败分支调用 `AddRateLimited` 后返回。client-go 队列会处理好重入队状态，但生产代码要遵循官方推荐模式，避免漏掉 `Done` 和 `Forget`。

### 面试题 5：为什么本篇没有创建 Deployment？

**一句话结论**：本篇目标是理解手写控制循环，创建子资源会引入 OwnerReference、资源模板、更新策略、RBAC 扩展和真实 Ready 判断，适合放到下一步。

**展开解释**：一个能写 status 的最小 Controller 已经覆盖 Informer、Workqueue、Reconcile、RBAC、status subresource 和部署流程。第 38 篇使用 Kubebuilder 后再创建 Deployment/Service，能更清楚地对比框架封装和手写样板代码。

**深入追问**：如果非要在本篇创建 Deployment，最容易出错的地方是什么？幂等更新、OwnerReference、selector 不可变字段、status 真实性和 RBAC 权限范围。
