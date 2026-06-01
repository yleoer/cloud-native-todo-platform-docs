# 阶段四验证命令附录

本附录整理阶段四验证时实际使用、可加入教材的命令。外网访问按要求优先设置代理；访问本机回环地址时补充 `NO_PROXY`，避免代理干扰 `127.0.0.1` 和 `localhost`。

## 通用代理环境

```bash
export HTTP_PROXY=http://192.168.2.1:7890
export HTTPS_PROXY=http://192.168.2.1:7890
export ALL_PROXY=socks5://192.168.2.1:7890
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
export GOPROXY=https://goproxy.cn,direct
```

## 工具基线

```bash
docker version
kind version
kubectl version --client
helm version
```

## 第 20 篇：Kubernetes 架构与集群搭建

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl get namespace
docker image inspect todo-api:v0.1.0 --format '{{.Id}} {{.RepoTags}}'
```

## 第 21 篇：Kubernetes 核心工作负载

```bash
kubectl -n todo-workloads get deploy,svc,pod,job,pvc,configmap,secret -o wide
kubectl -n todo-workloads rollout status deployment/todo-api --timeout=180s
kubectl -n todo-workloads wait pod -l app.kubernetes.io/name=todo-api --for=condition=Ready --timeout=180s
```

## 第 22 篇：Service、Ingress 与流量入口

```bash
kubectl -n traefik get pods,svc,deploy,ingress,httproute,gatewayclass,gateway -o wide
kubectl -n traefik logs deployment/traefik --tail=120
kubectl -n todo-workloads describe ingress todo-api
kubectl -n todo-workloads describe gateway todo-api
kubectl -n todo-workloads describe httproute todo-api
```

入口验证：

```bash
kubectl -n traefik port-forward svc/traefik 18443:443
curl -k -i --resolve todo.localhost:18443:127.0.0.1 https://todo.localhost:18443/readyz
curl -k -i --resolve todo-gateway.localhost:18443:127.0.0.1 https://todo-gateway.localhost:18443/readyz
```

## 第 23 篇：ConfigMap、Secret 与配置管理

```bash
kubectl -n todo-workloads get configmap todo-api-config todo-api-config-file
kubectl -n todo-workloads get secret todo-api-auth
kubectl -n todo-workloads exec "$POD" -- printenv TODO_ENV
kubectl -n todo-workloads exec "$POD" -- printenv TODO_API_ADDR
kubectl -n todo-workloads exec "$POD" -- printenv TODO_RELEASE
kubectl -n todo-workloads exec "$POD" -- sh -c 'test -n "$TODO_JWT_SECRET" && echo "jwt secret exists"'
kubectl -n todo-workloads exec "$POD" -- sh -c 'test -n "$TODO_AUTH_USERS" && echo "auth users exists"'
```

## 第 24 篇：Kubernetes 存储

```bash
kubectl -n todo-workloads get job todo-api-migrate -o wide
kubectl -n todo-workloads logs job/todo-api-migrate
kubectl -n todo-workloads get pvc
kubectl -n todo-workloads describe pod todo-postgres-0
kubectl -n todo-workloads exec "$POD" -- printenv TODO_DATABASE_DSN
```

## 第 25 篇：Kubernetes 网络原理

```bash
kubectl --context kind-todo-network-lab get nodes -o wide || true
kubectl --context kind-todo-network-lab get pods -A -o wide || true
kubectl --context kind-todo-network-lab-retry get nodes -o wide || true
kubectl --context kind-todo-network-lab-retry get pods -A -o wide || true
```

```bash
sysctl fs.inotify.max_user_instances fs.inotify.max_user_watches
sysctl -w fs.inotify.max_user_instances=1024
```

```bash
kind create cluster --name todo-network-lab-retry --config deployments/k8s-network/kind-calico-config.yaml --wait 120s
```

```bash
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
```

```bash
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23

kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0 --name todo-network-lab-retry
kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0 --name todo-network-lab-retry
kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0 --name todo-network-lab-retry
kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 --name todo-network-lab-retry
```

```bash
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  curl -fL https://raw.githubusercontent.com/projectcalico/calico/v3.32.0/manifests/calico.yaml -o /tmp/calico-v3.32.0.yaml

sed \
  -e 's#quay.io/calico/cni:v3.32.0#registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0#g' \
  -e 's#quay.io/calico/node:v3.32.0#registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0#g' \
  -e 's#quay.io/calico/kube-controllers:v3.32.0#registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0#g' \
  /tmp/calico-v3.32.0.yaml > /tmp/calico-v3.32.0-yleoer.yaml
```

```bash
kubectl --context kind-todo-network-lab-retry apply -f /tmp/calico-v3.32.0-yleoer.yaml
kubectl --context kind-todo-network-lab-retry -n kube-system wait --for=condition=Ready pod -l k8s-app=calico-node --timeout=600s
kubectl --context kind-todo-network-lab-retry -n kube-system wait --for=condition=Available deployment/calico-kube-controllers --timeout=600s
kubectl --context kind-todo-network-lab-retry get nodes -o wide
kubectl --context kind-todo-network-lab-retry -n kube-system get pods -o wide
```

```bash
kubectl --context kind-todo-network-lab-retry apply -f deployments/k8s-network/manifests/todo-network-app.yaml
kubectl --context kind-todo-network-lab-retry apply -f deployments/k8s-network/manifests/todo-network-clients.yaml
kubectl --context kind-todo-network-lab-retry apply -f deployments/k8s-network/manifests/todo-network-policy.yaml

kubectl --context kind-todo-network-lab-retry -n todo-workloads wait pod -l app.kubernetes.io/name=todo-api --for=condition=Ready --timeout=180s
kubectl --context kind-todo-network-lab-retry -n todo-workloads wait pod -l app.kubernetes.io/name=todo-postgres --for=condition=Ready --timeout=180s
kubectl --context kind-todo-network-lab-retry -n todo-clients wait pod/allowed-client --for=condition=Ready --timeout=180s
kubectl --context kind-todo-network-lab-retry -n todo-denied wait pod/denied-client --for=condition=Ready --timeout=180s
```

```bash
kubectl --context kind-todo-network-lab-retry -n todo-clients exec allowed-client -- \
  wget -qO- --timeout=5 http://todo-api.todo-workloads.svc.cluster.local

kubectl --context kind-todo-network-lab-retry -n todo-denied exec denied-client -- \
  sh -c 'wget -qO- --timeout=5 http://todo-api.todo-workloads.svc.cluster.local || echo blocked by NetworkPolicy'

kubectl --context kind-todo-network-lab-retry -n todo-clients exec allowed-client -- \
  sh -c 'nc -zvw3 todo-postgres.todo-workloads.svc.cluster.local 5432 && echo unexpected || echo postgres blocked for client namespace'

API_POD=$(kubectl --context kind-todo-network-lab-retry -n todo-workloads get pod -l app.kubernetes.io/name=todo-api -o jsonpath='{.items[0].metadata.name}')
kubectl --context kind-todo-network-lab-retry -n todo-workloads exec "$API_POD" -- \
  sh -c 'nc -zvw3 todo-postgres.todo-workloads.svc.cluster.local 5432 && echo postgres tcp endpoint'
```

## 第 26 篇：Kubernetes 安全

```bash
kubectl -n todo-security-lab get sa,role,rolebinding,pod,job -o wide
kubectl auth can-i list configmaps -n todo-security-lab --as=system:serviceaccount:todo-security-lab:todo-api-sa
kubectl -n todo-security-lab exec todo-security-client -- sh -c 'wget -qO- --timeout=3 http://todo-api-restricted.todo-security-lab.svc.cluster.local || echo blocked'
```

## 第 27 篇：Helm 4 包管理

```bash
helm lint deployments/helm/todo-platform
helm template todo-platform deployments/helm/todo-platform -n todo-helm-lab -f deployments/helm/todo-platform/values-dev.yaml -f deployments/helm/todo-platform/values.local.yaml >/tmp/todo-platform-helm.yaml
helm install todo-platform deployments/helm/todo-platform -n todo-helm-lab --create-namespace -f deployments/helm/todo-platform/values-dev.yaml -f deployments/helm/todo-platform/values.local.yaml --wait=watcher
helm upgrade todo-platform deployments/helm/todo-platform -n todo-helm-lab -f deployments/helm/todo-platform/values-prod.yaml -f deployments/helm/todo-platform/values.local.yaml --wait=watcher --rollback-on-failure
helm rollback todo-platform 1 -n todo-helm-lab --wait=watcher
helm history todo-platform -n todo-helm-lab
helm status todo-platform -n todo-helm-lab
```

Helm test：

```bash
helm test todo-platform -n todo-helm-lab
```

## 第 28 篇：Kustomize 多环境配置管理

```bash
kubectl get deploy -n todo-dev todo-platform -o jsonpath='dev={.spec.replicas}{"\n"}'
kubectl get deploy -n todo-test todo-platform -o jsonpath='test={.spec.replicas}{"\n"}'
kubectl get deploy -n todo-prod todo-platform -o jsonpath='prod={.spec.replicas}{"\n"}'
kubectl apply --dry-run=server -k deployments/kustomize/overlays/dev
kubectl apply --dry-run=server -k deployments/kustomize/overlays/test
kubectl apply --dry-run=server -k deployments/kustomize/overlays/prod
```

## 阶段四验收命令

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl get namespace
docker image inspect todo-api:v0.1.0 --format '{{.Id}} {{.RepoTags}}'
```

```bash
helm lint deployments/helm/todo-platform
helm template todo-platform deployments/helm/todo-platform -n todo-helm-lab -f deployments/helm/todo-platform/values-dev.yaml -f deployments/helm/todo-platform/values.local.yaml >/tmp/todo-platform-helm.yaml
helm history todo-platform -n todo-helm-lab
helm status todo-platform -n todo-helm-lab
```

```bash
kubectl apply --dry-run=server -k deployments/kustomize/overlays/dev
kubectl apply --dry-run=server -k deployments/kustomize/overlays/test
kubectl apply --dry-run=server -k deployments/kustomize/overlays/prod
```

```bash
kubectl -n traefik port-forward svc/traefik 18443:443
curl -k -i --resolve todo.localhost:18443:127.0.0.1 https://todo.localhost:18443/readyz
curl -k -i --resolve todo-gateway.localhost:18443:127.0.0.1 https://todo-gateway.localhost:18443/readyz
```

## 失败现场排查命令

```bash
kubectl --context kind-todo-network-lab get nodes -o wide || true
kubectl --context kind-todo-network-lab-retry get nodes -o wide || true
kubectl --context kind-todo-network-lab-retry -n kube-system describe node todo-network-lab-retry-control-plane | sed -n '/Conditions:/,/Addresses:/p' || true
```

```bash
sysctl fs.inotify.max_user_instances fs.inotify.max_user_watches
```

```bash
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0 || true
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0 || true
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0 || true
```
