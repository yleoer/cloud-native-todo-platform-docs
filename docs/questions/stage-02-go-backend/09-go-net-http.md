# 第 9 篇：Go net/http 标准库与 HTTP 服务：练习题与面试题

> 本页由 [第 9 篇：Go net/http 标准库与 HTTP 服务](../../chapters/stage-02-go-backend/09-go-net-http.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. `http.Handler` 和 `http.HandlerFunc` 有什么关系？
2. 为什么写 JSON 响应前要先设置 `Content-Type` 和状态码？
3. `r.PathValue("id")`、`r.URL.Query()` 和 `r.Header.Get()` 分别读取请求的哪一部分？
4. 为什么本篇用 `http.MaxBytesReader` 限制请求体大小？
5. `/healthz` 和 `/readyz` 有什么区别？

### 实操题

1. 给 `GET /api/v1/todos` 增加 `status=bad` 的测试，确认返回 `400` 和 `invalid_status`。
2. 给 `POST /api/v1/todos` 增加空标题测试，确认返回 `400` 和 `invalid_title`。
3. 新增 `GET /api/v1/todos/count`，返回当前 Todo 总数。Go 1.22+ 的 `ServeMux` 会按模式具体性匹配，但把字面量路径放在通配路径之前，仍然是更清晰的编码习惯。
4. 给 access log 增加 `query` 字段，观察 `GET /api/v1/todos?status=done` 的日志输出。
5. 把 `TODO_API_ADDR` 改成 `127.0.0.1:18081` 启动，验证端口切换是否成功。

### 思考题

1. 标准库 `ServeMux` 已经支持 Method 和 Path 参数，为什么团队仍可能选择 Gin？
2. 如果前端希望错误响应里包含 `request_id`，你会放在 Header、Body，还是两者都放？为什么？
3. 如果 Todo API 被部署成 3 个副本，内存存储会带来什么问题？
4. `server.Shutdown` 和直接 `os.Exit(0)` 的差异是什么？

## 面试题

### 1. Go 的 `http.Handler` 是什么？

**一句话结论**：`http.Handler` 是 Go 标准库对 HTTP 处理能力的最小抽象，只要求实现 `ServeHTTP(ResponseWriter, *Request)`。

**展开解释**：无论是 `ServeMux`、自定义 Handler，还是 Gin 这类框架，最终都要能作为 `http.Handler` 交给 `http.Server`。这使得标准库、框架和中间件可以组合在同一套模型里。

**深入追问**：`http.HandlerFunc` 是适配器类型，它让普通函数也能实现 `Handler` 接口。理解这一点后，中间件的 `func(http.Handler) http.Handler` 形式就很自然了。

### 2. `ServeMux` 做什么？

**一句话结论**：`ServeMux` 根据请求 Method 和 Path 把请求分发给对应 Handler。

**展开解释**：本篇使用 `mux.HandleFunc("GET /api/v1/todos/{id}", h.getTodo)` 注册路由，Handler 内用 `r.PathValue("id")` 读取路径参数。它解决的是“一个 HTTP server 上有多个接口，如何找到对应处理函数”的问题。

**深入追问**：第三方框架通常会在路由匹配、路由分组、中间件链、参数绑定和错误处理上提供更多便利。标准库更透明，框架更高效，团队应理解差异后选择。

### 3. Handler 层和 Service 层应该如何分工？

**一句话结论**：Handler 负责 HTTP 协议转换，Service 负责业务规则。

**展开解释**：Handler 解析路径参数、查询参数、Header 和 JSON Body，然后调用 Service。Service 负责标题校验、状态过滤和调用 Repository。这样 CLI、HTTP API、后台任务和未来 Controller 都能复用业务规则。

**深入追问**：如果把业务规则写在 Handler 中，后续换 Gin、加 gRPC 或写测试都会重复逻辑。清晰分层不是为了目录好看，而是为了降低变更成本。

### 4. 为什么生产 HTTP 服务要设置 `ReadHeaderTimeout`？

**一句话结论**：它限制客户端发送请求头的时间，避免慢连接长期占用服务资源。

**展开解释**：没有 `ReadHeaderTimeout` 时，恶意或异常客户端可以慢慢发送 Header，让连接一直占用。生产服务应显式设置 Header、读、写和空闲超时，配合网关、负载均衡和监控使用。

**深入追问**：不同超时保护不同阶段：`ReadHeaderTimeout` 保护 Header，`ReadTimeout` 保护请求读取，`WriteTimeout` 保护响应写出，`IdleTimeout` 控制 keep-alive 空闲连接。

### 5. 中间件的执行顺序如何理解？

**一句话结论**：中间件像洋葱一样层层包装，最外层最先接收请求，最后完成收尾。

**展开解释**：本篇中 request ID 在最外层，先给请求生成 ID；access log 包装内部 Handler，等请求处理完后记录状态码和耗时；recover 包住路由和业务处理，捕获内部 panic 并返回 `500`。

**深入追问**：顺序设计很重要。日志如果在 recover 外层，就能记录 panic 后的 `500`；request ID 如果在最外层，后续日志和错误都能拿到同一个 ID。注意：如果 Handler 在 panic 前已经写出了响应头，状态码就不能再可靠改写，这也是 Handler 应尽量先完成业务操作、最后统一写响应的原因之一。

### 6. `/healthz` 和 `/readyz` 有什么区别？

**一句话结论**：`/healthz` 判断进程是否活着，`/readyz` 判断服务是否准备好接流量。

**展开解释**：本篇的 `/healthz` 只返回 `ok`，适合作为存活检查；`/readyz` 会触发服务层轻量访问，后续接入数据库时应检查数据库连接。Kubernetes 中 readiness 失败会让 Pod 暂时不接流量，而 liveness 失败可能触发重启。

**深入追问**：不要把重依赖检查都塞进 liveness，否则数据库短暂波动可能导致所有 API Pod 被重启，造成故障扩大。
