# 阶段五附录：生产工程作品集验收

本附录用于出版前和学习完成后的总验收。第 29-33 篇已经分别完成 CI/CD、GitOps、监控、日志、Trace 和生产排障，本页把这些产物收束成一套可以用于求职、团队评审和真实工作的作品集。

## 1. 阶段五能力闭环

阶段五不是单点工具学习，而是一条从代码提交到故障复盘的生产工程链路：

| 环节 | 对应章节 | 核心产物 | 验收信号 |
|---|---|---|---|
| CI/CD | 第 29 篇 | GitHub Actions workflow、镜像构建、部署验证 | PR 自动测试通过，镜像带 commit tag 和 digest |
| GitOps | 第 30 篇 | Argo CD Application、ApplicationSet、dev/prod overlay | Argo CD 显示 `Synced` 和 `Healthy` |
| Metrics | 第 31 篇 | Go 指标、ServiceMonitor、PrometheusRule、Grafana dashboard | QPS、错误率、P95/P99、告警规则可见 |
| Logs & Trace | 第 32 篇 | Loki、Tempo、Grafana Alloy、OpenTelemetry Trace | 能从日志中的 `trace_id` 跳到 Tempo Trace |
| Troubleshooting | 第 33 篇 | 7 类故障注入 YAML、清理脚本、事故复盘模板 | 能完成注入、排查、恢复和复盘 |

完成阶段五后，作品集应能证明你不只是“会部署 Kubernetes 应用”，而是能把一个服务接入交付、可观测性、排障和复盘闭环。

## 2. 版本与环境锁定

表 5-A 是阶段五出版版推荐锁定的实验环境。课程蓝图使用 Kubernetes 1.36.x；本阶段为了复用第 30 篇创建的 `todo-gitops` kind 集群，实验统一锁定在 Kubernetes v1.35.0。第 29-33 篇不使用 Kubernetes 1.36 专属能力，如果你的本地环境已升级到 1.36.x，核心命令仍然适用。

| 组件 | 出版版实验值 | 说明 |
|---|---:|---|
| Go | 1.26.x | 构建 Todo API、运行测试和埋点代码 |
| kind | v0.31.0 | 本地 Kubernetes 集群 |
| Kubernetes | v1.35.0 | 阶段五连续实验环境 |
| kubectl | v1.35.x | 与实验集群版本保持一致 |
| Helm | v4.2.x | 安装 Argo CD、Prometheus、Loki、Tempo、Alloy |
| Argo CD CLI | v3.x | 同步和验证 GitOps 应用 |
| kube-prometheus-stack | 86.0.1 | 第 31 篇监控栈 |
| prometheus/client_golang | v1.23.2 | Todo API 指标埋点 |
| k9s | v0.50.18 | 第 33 篇交互式排障工具 |
| stern | v1.34.0 | 第 33 篇多 Pod 日志追踪 |

出版前还需要验证以下公共镜像 tag 可以访问；如果企业网络无法直接访问 Docker Hub、GHCR 或 `registry.k8s.io`，请使用企业镜像代理或私有 registry，并在命令中替换镜像地址：

```bash
docker manifest inspect registry.k8s.io/pause:3.10 >/dev/null
docker manifest inspect registry.k8s.io/e2e-test-images/busybox:1.36.1-1 >/dev/null
docker manifest inspect registry.k8s.io/e2e-test-images/agnhost:2.53 >/dev/null
docker manifest inspect curlimages/curl:8.16.0 >/dev/null
docker manifest inspect nicolaka/netshoot:v0.14 >/dev/null
```

替代流程：

```bash
docker pull <your-registry>/<image>:<tag>
kind load docker-image <your-registry>/<image>:<tag> --name todo-gitops
```

## 3. NetworkPolicy 验证说明

阶段五多次使用 NetworkPolicy：第 30 篇保护 dev/prod namespace，第 31 篇允许 Prometheus 跨 namespace 抓取指标，第 33 篇讨论 DNS egress 和服务访问排障。

NetworkPolicy 的语义由 Kubernetes API 定义，但是否真正执行取决于 CNI 插件。kind 默认的 kindnet 不执行 NetworkPolicy，因此本地 kind 实验可以验证 YAML 结构和排障思路，但不能完整证明策略 enforcement。需要验证真实阻断效果时，请使用 Calico、Cilium 或云厂商托管 CNI。

出版前应在正文中保持同一口径：

- 本地 kind：用于学习资源结构、selector、namespace 和排障路径。
- 生产或准生产：必须确认 CNI 支持 NetworkPolicy，并用正反向流量测试验证策略生效。

## 4. 作品集交付清单

完成阶段五后，建议保留以下截图、命令输出或链接，用于简历、面试和团队评审：

| 作品集证据 | 建议内容 |
|---|---|
| GitHub Actions | PR 检查通过、测试日志、镜像 tag 和 digest |
| Argo CD | `todo-platform-dev` Application 的 `Synced` / `Healthy` 截图 |
| GitOps 目录 | dev/prod overlay、ApplicationSet、Secret 外部化说明 |
| Prometheus Targets | Todo API target 为 `up` 的截图或输出 |
| Grafana Dashboard | QPS、错误率、P95/P99、CPU、内存面板 |
| Alerting Rules | `TodoApiHighP95Latency` 规则和 firing 验证记录 |
| Loki 日志 | 按 `request_id` 查询到 Todo API JSON 日志 |
| Tempo Trace | 通过 `trace_id` 打开的请求瀑布图 |
| 排障演练 | 7 类故障的注入、证据、修复、验证记录 |
| 事故复盘 | 至少一份完整 postmortem 模板填写结果 |

作品集说明应该强调“工程闭环”，不要只罗列工具名。推荐描述方式：

```text
为 Todo Platform 建立生产工程闭环：使用 GitHub Actions 完成测试、扫描、镜像构建和部署验证；使用 Argo CD 管理 dev/prod GitOps 环境；接入 Prometheus/Grafana 监控、Loki 日志、Tempo Trace；设计 7 类 Kubernetes 故障演练并形成排障 runbook 和事故复盘模板。
```

## 5. 阶段五总体验收命令

文档仓库验证：

```bash
mkdocs build --strict
```

应用仓库基础验证：

```bash
go test ./...
go build ./...
```

Kubernetes 基线验证：

```bash
kubectl get nodes
kubectl get namespace todo-dev monitoring observability argocd
kubectl -n todo-dev rollout status deployment/todo-platform --timeout=180s
kubectl -n todo-dev get svc,endpointslice,pod
```

Argo CD 验证：

```bash
argocd app get todo-platform-dev
argocd app sync todo-platform-dev --timeout 300
argocd app wait todo-platform-dev --sync --health --timeout 300
```

Prometheus 与 Grafana 验证：

```bash
kubectl -n monitoring get pod
kubectl -n monitoring get servicemonitor,prometheusrule
kubectl -n monitoring port-forward service/monitoring-grafana 3000:80
```

Loki、Tempo 与 Alloy 验证：

```bash
kubectl -n observability get pod,svc
kubectl -n observability logs daemonset/alloy --tail=80
kubectl -n observability port-forward service/loki-gateway 3100:80
kubectl -n observability port-forward service/tempo 3200:3100
```

排障演练收尾验证：

```bash
./troubleshooting/k8s/99-cleanup.sh
argocd app sync todo-platform-dev --timeout 300
kubectl -n todo-dev rollout status deployment/todo-platform --timeout=180s
kubectl -n todo-dev get pod,svc,pvc,networkpolicy | grep -E 'todo-(pending|broken|pvc|dns|oom|trouble)' || true
```

## 6. 出版前 Checklist

- 第 29-33 篇均通过 `mkdocs build --strict`。
- 第 29-33 篇标题均带 `[C]`，且 12 节结构完整。
- 版本表中的 Kubernetes v1.35.0 说明与课程蓝图 1.36.x 的差异。
- Helm chart 版本、Go module 版本和公共镜像 tag 均已验证。
- GitHub Actions workflow 在应用仓库真实跑通。
- Argo CD 登录、同步、self-heal 和 Git revert 回滚流程真实跑通。
- Prometheus Targets、recording rules、alerting rules 和 Grafana dashboard 均可见。
- Loki 查询、Tempo Trace 查询和 Grafana derived field 跳转真实可用。
- 第 33 篇 7 类故障均可注入、可排查、可恢复。
- 所有 Secret、token、密码、`--insecure` 用法均标注为本地实验或占位。
- NetworkPolicy 段落均说明 CNI enforcement 前提。
- 清理步骤不会误删前序章节后续仍需使用的 `monitoring`、`observability` 或 `argocd` namespace。
- 每篇都有常见错误、排障方法、生产注意事项、面试题和能力验收标准。
- 阶段五作品集至少包含 CI/CD、GitOps、Grafana、Loki/Tempo 和故障复盘五类证据。
