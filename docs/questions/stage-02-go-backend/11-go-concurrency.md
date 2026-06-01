# 第 11 篇：Go 并发编程：练习题与面试题

> 本页由 [第 11 篇：Go 并发编程](../../chapters/stage-02-go-backend/11-go-concurrency.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. goroutine 和线程有什么关系？为什么说 goroutine 不是越多越好？
2. `sync.Mutex` 和 `sync.RWMutex` 的区别是什么？
3. channel 由谁关闭？为什么接收方通常不应该关闭 channel？
4. `context.Canceled` 和 `context.DeadlineExceeded` 分别表示什么？
5. `go test -race` 能发现什么类型的问题？

### 9.2 实操题

1. 给 `Stats` 增加 `CompletionRate` 字段，表示已完成 Todo 占总数的比例。验收标准：空列表时为 `0`，有数据时计算正确，`go test -race ./api/internal/service` 通过。
2. 给 `todo-load` 增加 `-method` 参数，支持压测 `GET` 和 `POST`。验收标准：`-method GET` 行为保持不变，非法 method 返回错误；如果选择 `POST`，需要同步处理请求体和 `Content-Type`。
3. 给 `StatsService` 增加 Benchmark。可以参考单元测试中的数据准备方式，编写 `BenchmarkStatsServiceRefresh`，在循环中调用 `Refresh(context.Background())`。验收标准：能执行 `go test ./api/internal/service -bench . -benchmem`，并解释 `ns/op` 和 `allocs/op`。

### 9.3 思考题

1. 如果统计任务未来要读取 PostgreSQL，你会把并发数设置为多少？它和数据库连接池有什么关系？
2. 如果压测时 RPS 升高但错误率也升高，你会先看哪些指标和日志？

## 面试题

### 面试题 1：Go HTTP Server 如何处理并发请求？

**一句话结论**：Go 的 `net/http` 会为连接和请求安排 goroutine，因此同一个 Handler 可能被多个请求同时调用。

**展开解释**：Gin 运行在 `net/http` 之上，所以 Gin Handler 也处在并发请求环境中。Handler 内部访问 service、repository 或共享变量时必须考虑并发安全。内存 map 要加锁，数据库连接要走连接池，后台任务要支持取消。

**深入追问**：HTTP Server 的并发不等于业务逻辑自动安全。只读无共享状态通常安全；写共享内存、缓存、统计快照、全局变量时必须有同步机制。

### 面试题 2：什么时候使用 channel，什么时候使用 Mutex？

**一句话结论**：channel 更适合传递任务和结果，Mutex 更适合保护共享状态。

**展开解释**：如果你的问题是“把 Todo 分发给多个 worker 处理”，channel 很自然；如果问题是“保护 latest stats 这个共享字段”，Mutex 或 RWMutex 更直接。不要为了使用 channel 而绕开简单清晰的锁。

**深入追问**：Go 并发不是“只能用 channel”。真实项目里 channel、Mutex、atomic、context、WaitGroup 经常组合使用。选择标准是可读性、正确性和边界清晰。

### 面试题 3：如何避免 goroutine 泄漏？

**一句话结论**：每个 goroutine 都要有明确退出条件，并且阻塞点要能响应取消或关闭。

**展开解释**：常见泄漏来自 channel 永远没人关闭、发送方没人接收、接收方等不到数据、请求取消后后台任务还在跑。解决方式包括：用 context 传递取消信号，明确 channel 关闭责任，用 WaitGroup 等待退出，给外部请求设置超时。

**深入追问**：排查时可以观察 goroutine 数量、pprof goroutine dump、日志中的请求 ID 和任务生命周期。第 14 篇会进一步讲 pprof。

### 面试题 4：`go test -race` 的价值和局限是什么？

**一句话结论**：race detector 能发现测试运行路径上的数据竞争，但不能证明所有并发路径永远正确。

**展开解释**：它会在运行时监控内存访问，发现未同步的并发读写。价值很高，尤其适合 CI 中跑核心包测试。但如果测试没有覆盖某条并发路径，race detector 就看不到那里的问题。

**深入追问**：数据竞争不等于所有竞态条件。例如两个请求都通过了“库存大于 0”的判断，最后超卖，这可能没有内存数据竞争，却是业务竞态，需要事务、锁或幂等设计解决。

### 面试题 5：worker pool 如何设计才适合生产？

**一句话结论**：生产级 worker pool 要控制 worker 数、队列长度、超时、错误处理和关闭流程。

**展开解释**：只固定 worker 数还不够。任务队列不能无限增长，任务执行要支持 context，错误要能被观测，服务关闭时要停止接收新任务并等待已有任务结束。下游是数据库或 HTTP 服务时，还要和连接池、限流、重试策略配合。

**深入追问**：如果 worker 处理速度低于任务进入速度，就会积压。此时要么扩容处理能力，要么限流、降级、丢弃低优先级任务，不能让队列无限占用内存。
