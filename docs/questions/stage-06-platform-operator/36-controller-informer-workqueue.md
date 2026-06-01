# 第 36 篇：Controller 机制：Informer 与 Workqueue：练习题与面试题

> 本页由 [第 36 篇：Controller 机制：Informer 与 Workqueue](../../chapters/stage-06-platform-operator/36-controller-informer-workqueue.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. Controller 为什么不能只处理创建事件？
2. Informer 缓存解决了什么问题？它带来了什么新问题？
3. Workqueue 为什么通常只保存 `namespace/name`，而不是保存完整对象？
4. 什么是 `dirty` key？它解决什么并发问题？
5. Reconcile 幂等和 HTTP 幂等有什么相似点？

**实操题**

1. 修改模拟程序，把 `Deployment` Ready 事件从 `Replicas: 3` 改成 `Replicas: 2`。验收标准：程序不会输出 `Available=True`。
2. 再增加一个 `TodoApp`，名字为 `todo-admin`。验收标准：队列能处理两个不同 key。
3. 把 `TodoDatabase` 事件删除。验收标准：程序会持续重试，并能解释为什么。

**思考题**

1. 如果 `TodoDatabase` 被多个 `TodoApp` 共享，Index 应该如何设计？
2. 如果 Controller 写 status 又触发自己 Reconcile，如何避免无意义循环？
3. 为什么 controller-runtime 默认 client “读缓存、写 API server” 对新手来说容易造成误解？

## 面试题

### 面试题 1：Informer 和 Watch 有什么区别？

**一句话结论**：Watch 是 API server 提供的事件流，Informer 是客户端对 List-Watch、缓存和事件分发的封装。

**展开解释**：Watch 只告诉你对象变化；Informer 会先 List 初始对象，再 Watch 增量变化，并维护本地 Store。多个处理器可以共享 SharedInformer，减少 API server 压力。

**深入追问**：为什么要等 cache sync？因为 worker 启动前必须确认本地缓存已有初始状态，否则 Reconcile 可能误判对象不存在。

### 面试题 2：Workqueue 为什么不直接处理事件？

**一句话结论**：队列把不稳定的事件流转换成可控的调谐任务。

**展开解释**：Workqueue 支持去重、限速、延迟重试和并发控制。同一个对象多次变化时，Controller 只需要处理最终状态。失败时也不能立刻无限重试，而要按退避策略重新入队。

**深入追问**：为什么队列 key 通常是 `namespace/name`？因为 Reconcile 应读取当前状态，而不是依赖事件里的旧对象。

### 面试题 3：什么是幂等 Reconcile？

**一句话结论**：同一个 Reconcile 运行多次，最终结果仍然正确，不产生重复副作用。

**展开解释**：幂等 Reconcile 会先读取当前状态，再决定创建、更新、删除或跳过。资源已存在时更新，不存在时创建；status 没变化时不重复 patch。

**深入追问**：如何测试幂等？连续调用两次 Reconcile，第二次不应创建新资源，也不应产生无意义更新。

### 面试题 4：secondary resource 变化如何触发主资源 Reconcile？

**一句话结论**：通过 owner reference、label index 或字段索引，把底层资源事件映射回主资源 key。

**展开解释**：Deployment Ready 状态变化会影响 `TodoApp.status.readyReplicas`，所以 Deployment 事件也要入队对应 TodoApp。没有这种反向映射，主资源状态会滞后。

**深入追问**：什么时候 owner reference 不够？跨 namespace、外部云资源或共享依赖资源通常不能只靠 owner reference，需要显式索引或引用关系。

### 面试题 5：controller-runtime 的 Manager 解决了什么问题？

**一句话结论**：Manager 统一管理 Controller 运行所需的 cache、client、scheme、leader election 和生命周期。

**展开解释**：手写 client-go Controller 要自己创建 Informer、Workqueue、worker 和信号处理。controller-runtime 把这些通用能力封装起来，让开发者专注 Reconcile 业务逻辑。

**深入追问**：controller-runtime client 为什么可能读到旧数据？默认 client 通常读缓存、写 API server，缓存同步存在延迟，所以 Controller 不能依赖强读写一致性。
