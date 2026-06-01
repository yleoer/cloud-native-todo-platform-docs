# 第 10 篇：Go Web API 开发——Gin 框架：练习题与面试题

> 本页由 [第 10 篇：Go Web API 开发——Gin 框架](../../chapters/stage-02-go-backend/10-go-web-api.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. Gin 为什么仍然需要 `http.Server`？请用一句话说明两者关系。
2. `c.Param("id")` 和 `c.Query("status")` 分别读取请求的哪一部分？
3. `ShouldBindJSON` 和 service 层校验分别适合处理哪类问题？
4. 为什么错误响应里要有稳定的 `error.code`？
5. `/healthz` 和 `/readyz` 在语义上有什么区别？

### 9.2 实操题

1. 给 `GET /api/v2/todos` 增加 `limit` 查询参数，限制最多返回多少条 Todo。验收标准：`curl -s 'http://127.0.0.1:18080/api/v2/todos?limit=1'` 只返回 1 条数据；非法 `limit` 返回 `400`。
2. 给响应 Header 增加 `X-API-Version: v2`。验收标准：`curl -i -s http://127.0.0.1:18080/healthz` 能看到该 Header。
3. 在 OpenAPI 文档中补充 `Error` schema 的引用。验收标准：`go run ./api/cmd/todo-api openapi > /tmp/todo-openapi.yaml` 后，文档中每个 `400` 或 `404` 响应都能找到错误结构说明。

### 9.3 思考题

1. 如果团队已经有第 9 篇的标准库 API，什么时候值得迁移到 Gin？迁移收益和风险分别是什么？
2. 如果线上出现大量 `invalid_request`，你会从前端、测试、网关、后端日志和 OpenAPI 文档哪些角度排查？

## 面试题

### 面试题 1：Gin 和 net/http 是什么关系？

**一句话结论**：Gin 是构建在 `net/http` 之上的 Web 框架，最终仍然通过 `http.Server` 接收请求和返回响应。

**展开解释**：`gin.Engine` 实现了标准库 Handler 所需的 `ServeHTTP` 能力，所以可以作为 `http.Server.Handler`。Gin 主要封装了路由匹配、路径参数、JSON 绑定、中间件链和响应写法，但连接监听、超时、优雅关闭这些底层能力仍然来自 `net/http`。

**深入追问**：如果不用 `http.Server` 而直接 `router.Run()`，也能启动服务，但你会少一些显式控制。生产代码通常更建议自己创建 `http.Server`，明确设置 `ReadHeaderTimeout`、`ReadTimeout`、`WriteTimeout`、`IdleTimeout` 和 `Shutdown`。

### 面试题 2：Gin 的中间件顺序为什么重要？

**一句话结论**：中间件像洋葱一样层层包裹请求链，按注册顺序进入、按相反方向返回，顺序会影响日志、panic 恢复、超时和响应状态。

**展开解释**：request ID 应尽量放在最外层，让后续日志和错误响应都能带上同一个 ID；访问日志也应靠外，才能记录完整耗时和最终状态码；Recovery 要包住业务 Handler，避免 panic 逃逸；BodyLimit 要在 JSON 绑定前执行，才能限制请求体大小。

**深入追问**：如果 Handler 已经写出了响应头，再发生 panic，Recovery 也无法把状态码改成 `500`。这说明 Handler 最好先完成校验和业务调用，最后统一写响应。

### 面试题 3：ShouldBindJSON 是否可以替代业务校验？

**一句话结论**：不能。`ShouldBindJSON` 适合协议层输入校验，业务规则仍然应放在 service 层。

**展开解释**：binding tag 可以检查字段是否存在、字符串长度、数字范围等输入形态问题。但“标题是否允许重复”“用户是否有权限更新”“状态能否从 done 改回 pending”这类业务规则不属于 Web 框架职责。放在 service 层可以让 CLI、HTTP API、测试和未来的消息消费者复用同一套规则。

**深入追问**：如果业务规则写在 Handler 里，后续换框架、加 gRPC 或加异步任务时就容易复制规则，导致不同入口行为不一致。

### 面试题 4：为什么要生成 OpenAPI 文档？

**一句话结论**：OpenAPI 把 HTTP API 的路径、参数、请求体、响应和错误结构变成可审查、可测试、可协作的契约。

**展开解释**：没有 API 文档时，前端和测试只能看代码或问后端。OpenAPI 文档可以用于生成客户端、生成测试、接入接口平台，也能让评审者检查状态码、字段命名和版本策略是否一致。本篇通过 `openapi` 命令和 `/openapi.yaml` 同时支持离线和在线查看。

**深入追问**：文档必须跟代码同步。大型团队通常会在 CI 中校验 OpenAPI 格式，甚至做契约测试，避免接口行为变了但文档没变。

### 面试题 5：为什么 Handler 包里要定义 todoService 接口？

**一句话结论**：接口定义在使用方，可以让 Handler 只依赖自己需要的行为，而不是依赖完整具体类型。

**展开解释**：Gin Handler 只需要 `List`、`Get`、`Create`、`Update`、`MarkDone`、`Delete` 这些方法。把接口定义在 Handler 包里，能让测试替换假服务，也能避免 Handler 知道 Service 的内部字段或构造细节。这符合 Go 的小接口习惯。

**深入追问**：接口也不能滥用。如果只有一个实现，且测试不需要替换，过早抽象会增加阅读成本。本篇保留接口，是因为它能帮助你理解 Handler 和 Service 的边界。
