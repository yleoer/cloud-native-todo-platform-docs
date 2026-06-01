# 阶段五验证命令附录

## 基础验收

```bash
mkdocs build --strict
go test ./...
go build ./...
```

## 集群基线

```bash
kubectl get nodes
kubectl get namespace todo-dev monitoring observability argocd
kubectl -n todo-dev rollout status deployment/todo-platform --timeout=180s
kubectl -n todo-dev get svc,endpointslice,pod
```

## Argo CD

```bash
argocd app get todo-platform-dev
argocd app sync todo-platform-dev --timeout 300
argocd app wait todo-platform-dev --sync --health --timeout 300
```

## 监控与可观测性

```bash
kubectl -n monitoring get pod
kubectl -n monitoring get servicemonitor,prometheusrule
kubectl -n observability get pod,svc
kubectl -n observability logs daemonset/alloy --tail=80
kubectl -n observability port-forward service/loki-gateway 3100:80
kubectl -n observability port-forward service/tempo 3200:3200
kubectl -n monitoring port-forward service/monitoring-grafana 3000:80
```

## OTel / Loki / Tempo

```bash
kubectl -n todo-dev port-forward service/todo-platform 18080:http
curl -sS -H 'X-Request-ID: stage05-observability-001' http://127.0.0.1:18080/healthz
curl -sS -G 'http://127.0.0.1:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={namespace="todo-dev", app="todo-platform"} | json | request_id="..."'
curl -sS http://127.0.0.1:3200/api/traces/<trace-id>
```

## 故障演练与清理

```bash
kubectl apply -f troubleshooting/k8s/01-pending-pod.yaml
kubectl apply -f troubleshooting/k8s/02-broken-service.yaml
kubectl apply -f troubleshooting/k8s/03-pvc-missing-storageclass.yaml
kubectl apply -f troubleshooting/k8s/04-dns-broken.yaml
kubectl apply -f troubleshooting/k8s/05-oom-demo.yaml
./troubleshooting/k8s/99-cleanup.sh
```

## 追加说明

- `stage-05` 的 `tempo` Service 真实 HTTP 端口为 `3200`。
- `33-k8s-troubleshooting` 的原始故障 Pod YAML 在 restricted PodSecurity 命名空间中需要补齐 `securityContext`。
- `mkdocs build --strict` 受仓库级 nav 警告影响，不应单独解释为阶段五章节失败。
