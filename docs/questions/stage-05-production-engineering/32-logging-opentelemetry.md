# 第 32 篇：日志与 OpenTelemetry 链路追踪：练习题与面试题

> 本页由 [第 32 篇：日志与 OpenTelemetry 链路追踪](../../chapters/stage-05-production-engineering/32-logging-opentelemetry.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. `request_id` 和 `trace_id` 有什么区别？为什么生产环境中两者可以同时存在？
2. 为什么 Loki 不建议把 `request_id` 做成 label？
3. OpenTelemetry SDK、OTLP、Tempo 三者分别负责什么？
4. Promtail 和 Grafana Alloy 的关系是什么？为什么本篇实验不再使用 Promtail？
5. `traceparent` Header 中包含哪些关键信息？

**实操题**

1. 在 Grafana Explore 中按某个 `request_id` 查询 Todo API 日志，并跳转到 Tempo Trace。验收标准：能看到对应 HTTP Span。
2. 为 `readyz` 或登录接口增加一个手动 Span。验收标准：Tempo 中能看到新增 Span 名称，并且它挂在对应 HTTP server Span 下面。
3. 把 LogQL 面板改成只统计 `level="ERROR"` 的日志数。验收标准：Dashboard 中出现错误日志计数曲线。

**思考题**

1. 如果一次用户投诉只提供了时间窗口和用户名，没有 `request_id`，你会如何缩小日志和 Trace 搜索范围？
2. 如果业务方希望所有请求 100% Trace 采样并保留 90 天，你会如何评估成本和替代方案？

## 面试题

### 面试题 1：日志、指标和 Trace 分别解决什么问题？

**一句话结论**：指标看趋势和告警，日志看事件上下文，Trace 看一次请求的跨组件路径和耗时分布。

**展开解释**：指标适合回答“错误率是否升高、P95 是否变慢、资源是否打满”；日志适合回答“某次请求当时发生了什么、错误信息是什么、用户和请求 ID 是什么”；Trace 适合回答“请求经过哪些服务或函数、每一步耗时多少、慢点在哪”。生产排障通常先看指标定位时间窗口，再用日志和 Trace 找根因。

**深入追问**：如果只能先接一种数据，怎么选？一般先接指标和关键日志，再接 Trace；但微服务链路复杂时，Trace 的优先级会提高。

### 面试题 2：为什么 Loki 不像 Elasticsearch 那样全文索引所有日志？

**一句话结论**：Loki 主要索引 label，通过更低索引成本换取与 Prometheus/Grafana 更自然的云原生日志查询模式。

**展开解释**：Elasticsearch 适合复杂全文检索和字段分析，但索引成本高。Loki 更强调用低基数 label 先筛选日志流，再通过 pipeline 解析内容。这样更适合 SRE 通过 namespace、app、pod、level、时间窗口查问题。代价是 label 设计很关键，复杂全文分析能力不如 ELK。

**深入追问**：什么时候仍然选择 ELK？需要强全文检索、审计分析、复杂聚合、多业务数据分析时，ELK/EFK 仍然很有价值。

### 面试题 3：OpenTelemetry 中 Trace、Span 和 Context Propagation 是什么？

**一句话结论**：Trace 表示一次完整请求链路，Span 表示链路中的一个操作，Context Propagation 负责把 Trace 上下文传到下游。

**展开解释**：一个 Trace 有一个 Trace ID，包含多个 Span。每个 Span 有 Span ID、父 Span、开始结束时间、属性和状态。HTTP 请求通过 `traceparent` Header 传播上下文，下游服务读取后创建子 Span。没有上下文传播，各服务即使都生成 Trace，也无法拼成一条完整链路。

**深入追问**：消息队列场景怎么传播？需要把 trace context 注入消息 Header，消费者再提取上下文创建消费 Span。

### 面试题 4：如何把日志和 Trace 关联起来？

**一句话结论**：应用在日志中写入 `trace_id`，Grafana Loki datasource 用 derived field 把 `trace_id` 链接到 Tempo。

**展开解释**：OpenTelemetry 中间件把当前 Span 放进请求 context，日志中间件从 context 读取 SpanContext，把 `trace_id` 和 `span_id` 写入 JSON 日志。Loki 采集日志后，Grafana 用正则从日志中提取 Trace ID，并根据 Tempo datasource uid 跳转到 Trace。`request_id` 适合从用户反馈定位日志，`trace_id` 适合从日志跳到 Trace。

**深入追问**：为什么不只用 request_id？Trace 后端通常按 Trace ID 查询；request_id 是团队自定义字段，不一定符合 Trace 系统的索引和传播标准。

### 面试题 5：Trace 采样策略怎么设计？

**一句话结论**：采样策略要平衡排障价值和成本，通常不会对高流量服务长期 100% 采样。

**展开解释**：本地实验 100% 采样方便学习，但生产高流量服务会产生大量 Span。常见策略包括固定比例采样、父级采样、错误请求全采样、慢请求尾采样、按租户或路由差异化采样。尾采样通常由 OpenTelemetry Collector 的 `tail_sampling` processor 实现，它会缓存最近一段时间的 Span，再根据错误、延迟或属性决定保留哪些 Trace；排障价值更高，但对 Collector 内存和吞吐要求也更高。

**深入追问**：采样后会不会影响指标？Trace 采样不应该替代指标。请求量、错误率和延迟 SLO 仍应由指标系统完整统计。
