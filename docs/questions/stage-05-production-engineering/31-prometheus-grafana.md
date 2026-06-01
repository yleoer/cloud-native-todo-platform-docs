# 第 31 篇：Prometheus 与 Grafana 监控：练习题与面试题

> 本页由 [第 31 篇：Prometheus 与 Grafana 监控](../../chapters/stage-05-production-engineering/31-prometheus-grafana.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. RED 指标体系中的 Rate、Errors、Duration 分别对应 Todo API 的哪些 PromQL？
2. 为什么 Counter 不能直接用于当前并发请求数？当前并发应该用哪类指标？
3. `rate(todo_api_http_requests_total[5m])` 和 `increase(todo_api_http_requests_total[5m])` 有什么区别？
4. `histogram_quantile(0.95, sum by (le) (...))` 中为什么必须保留 `le` label？
5. ServiceMonitor 的 `selector.matchLabels` 匹配的是 Pod label 还是 Service label？

**实操题**

1. 增加一个按 route 维度展示 QPS 的 Grafana 面板。验收标准：面板中能看到 `/healthz`、`/readyz` 或 `/api/v2/auth/login` 等路由的曲线。
2. 把 `TodoApiHighP95Latency` 的阈值临时改成 `0.001`，生成流量并观察告警进入 firing 状态。验收标准：Prometheus Alerts 页面能看到 firing，然后把阈值改回 `0.5`。
3. 给 Dashboard 增加 namespace 变量，让查询不再写死 `todo-dev`。验收标准：Grafana 顶部出现 namespace 下拉框，并能选择 `todo-dev`。

**思考题**

1. 如果某次发布后 P95 延迟升高，但 CPU 和内存都正常，你会如何利用指标继续缩小范围？
2. 如果团队要求把 `user_id` 加到所有 HTTP 指标 label 中，方便按用户排查问题，你会如何解释风险，并给出替代方案？

## 面试题

### 面试题 1：Prometheus 为什么通常采用 pull 模型？

**一句话结论**：Pull 模型让 Prometheus 主动发现和抓取目标，更适合 Kubernetes 这类目标频繁变化的环境，也便于统一控制抓取频率和目标健康状态。

**展开解释**：在 Kubernetes 中，Pod 会滚动更新、扩缩容和重建。如果每个应用主动 push，监控系统需要处理大量客户端配置、重试和身份问题。Prometheus 通过 ServiceMonitor 发现 Service，再周期性拉取 `/metrics`，Targets 页面还能直接显示 up/down 和 scrape error。Pushgateway 只适合短生命周期批处理任务，不适合长期运行服务替代 pull。

**深入追问**：如果服务在 NAT 后面或无法被 Prometheus 访问怎么办？可以使用 Agent、remote write、Pushgateway 或边缘 Prometheus 代理，但要明确场景和数据可靠性边界。

### 面试题 2：Counter、Gauge、Histogram 分别适合什么场景？

**一句话结论**：Counter 适合累计事件，Gauge 适合当前状态，Histogram 适合请求耗时这类分布数据。

**展开解释**：请求总数只能增加，所以用 Counter，再通过 `rate` 计算 QPS；当前并发请求数会上升下降，所以用 Gauge；请求延迟不能只看平均值，需要 P95/P99，所以用 Histogram bucket 配合 `histogram_quantile`。类型选错会导致 PromQL 语义错误，例如对 Gauge 使用 `rate` 通常没有业务意义。

**深入追问**：Summary 和 Histogram 怎么选？Prometheus 生态中更推荐 Histogram，因为它能在服务端聚合多个实例的 bucket；Summary 的客户端分位数跨实例聚合困难。

### 面试题 3：为什么要控制 Prometheus label 基数？

**一句话结论**：每一组 label 都是一条时间序列，高基数会迅速放大 Prometheus 内存、磁盘和查询成本。

**展开解释**：`route="/api/v2/todos/:id"` 可能只有几十条序列，但 `path="/api/v2/todos/123456"` 会随着每个 ID 生成新序列。如果再叠加 user_id、status、method、pod，就会产生爆炸式增长。Prometheus 适合统计聚合，不适合承载请求级明细。请求级定位应该使用日志和 Trace。

**深入追问**：如果确实需要按租户看指标怎么办？可以只对有限租户、付费租户或稳定 tenant_id 维度做 label，并设置采样、聚合、保留周期和容量预算；大规模明细仍建议进入日志或分析系统。

### 面试题 4：PrometheusRule 中 recording rule 和 alerting rule 有什么区别？

**一句话结论**：Recording rule 把 PromQL 结果预计算成新时间序列，alerting rule 根据 PromQL 条件生成告警状态。

**展开解释**：Dashboard 中反复计算复杂查询会增加 Prometheus 压力，也容易出现各面板写法不一致。Recording rule 把标准查询固化为 `todo_api:p95_latency_seconds5m` 这类序列，Dashboard 和告警都能复用。Alerting rule 则关注持续条件，例如 P95 延迟超过 500ms 持续 2 分钟后触发 warning。

**深入追问**：为什么告警要加 `for`？因为瞬时尖峰可能是短暂抖动，`for` 可以过滤噪声，让告警更接近真实用户影响。

### 面试题 5：Grafana 面板显示 No data，你会怎么排查？

**一句话结论**：从数据源、PromQL、Prometheus target、ServiceMonitor selector 和应用 `/metrics` 逐层排查。

**展开解释**：先在 Grafana Explore 中执行同一条 PromQL，确认是否是 dashboard 配置问题；再到 Prometheus UI 执行查询，确认数据源是否有数据；接着看 Targets 中 Todo API 是否 up；如果 target 不存在，看 ServiceMonitor selector、namespaceSelector 和 Service 端口名；如果 target up 但没有业务指标，直接 curl `/metrics` 看应用是否暴露 `todo_api_` 指标。

**深入追问**：如果 Prometheus 有数据但 Grafana 没有？重点检查 Grafana datasource uid、时间范围、变量值、面板查询和 dashboard JSON 导入日志。
