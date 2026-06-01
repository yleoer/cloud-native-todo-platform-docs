# 阶段四验证总结

- 验证阶段：阶段四 `docs/chapters/stage-04-kubernetes`
- 验证分支：`codex/revalidation-stage-01`
- 验证日期：2026-05-31
- 验证工作区：`/root/cloud-native-todo-platform-docs`
- 课程项目来源：`/root/workspace/cloud-native-todo-platform`
- 网络策略：外网命令优先使用 `HTTP_PROXY=http://192.168.2.1:7890`、`HTTPS_PROXY=http://192.168.2.1:7890`、`ALL_PROXY=socks5://192.168.2.1:7890`；本机回环访问补充 `NO_PROXY=127.0.0.1,localhost` 和 `no_proxy=127.0.0.1,localhost`。
- 镜像策略：主线工作负载与镜像检查统一使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/*`；第 25 章重测时将原始 Calico 镜像路径从 `quay.io/calico/{cni,node,kube-controllers}:v3.32.0` 切换为 `registry.cn-guangzhou.aliyuncs.com/yleoer/{cni,node,kube-controllers}:v3.32.0`，并使用已补齐的平铺镜像路径完成直接 manifest 安装。

## 阶段结论

阻塞。

第 20、21、23、24、25、26、27、28 章已在持续保留的验证环境中通过；第 22 章的 Gateway 路由通过，但 Ingress `todo.localhost` 仍返回 `404`，与章节主线验收不一致。用户补齐 Calico 镜像后，第 25 章已在 `todo-network-lab-retry` 中完成 NetworkPolicy 验证：授权客户端可访问 Todo API，未授权客户端被拦截，普通客户端不能直连 PostgreSQL，Todo API Pod 可以访问 PostgreSQL。阶段四仍未达到全部章节闭环，当前阻塞点只剩第 22 章 Ingress 路由。

阶段环境已保留，不做清理：`todo-k8s` 主集群、`todo-workloads`、`traefik`、`todo-security-lab`、`todo-helm-lab`、`todo-dev` / `todo-test` / `todo-prod` 仍在；`todo-network-lab` 作为初始失败现场保留；`todo-network-lab-retry` 已恢复为 Ready，并保留第 25 章 NetworkPolicy 验证资源。

文档仓库自身的 `mkdocs build --strict` 未能执行，原因是当前环境未安装 `mkdocs`。

## 已验证章节

1. `20-k8s-architecture.md`
2. `21-k8s-workloads.md`
3. `22-k8s-service-ingress.md`
4. `23-k8s-config-secret.md`
5. `24-k8s-storage.md`
6. `25-k8s-networking.md`
7. `26-k8s-security.md`
8. `27-helm4.md`
9. `28-kustomize.md`
10. `stage-04-acceptance.md`

## 按章节验证记录

### 第 20 篇：Kubernetes 架构与集群搭建

- 预期产物：kind 集群 `todo-k8s`、smoke Pod / Service、导入的 `todo-api:v0.1.0` 镜像。
- 实际产物：`kind-todo-k8s` 上 `todo-k8s-control-plane` Ready；`todo-k8s-lab` smoke Pod Running；`todo-api:v0.1.0` 已导入 kind，digest 为 `sha256:c91427aa88433656afb07e64c14ec552fcfde64e4d990b174e7f04a3fcd4baec`。
- 失败点：课程文档仍保留固定 digest `sha256:452d707...`，与本次实际可用的 `registry.cn-guangzhou.aliyuncs.com/yleoer/node:v1.35.0` 不一致。
- 临时修正：验证工作区使用实际可用的 `registry.cn-guangzhou.aliyuncs.com/yleoer/node:v1.35.0` 节点镜像继续验证。

### 第 21 篇：Kubernetes 核心工作负载

- 预期产物：Todo API Deployment、Service、Probe、HPA、Job、CronJob、DaemonSet。
- 实际产物：`todo-workloads` 中 `todo-api` Deployment Ready，`todo-postgres-0` Running，`todo-api` / `todo-postgres` Service 存在，`todo-api:v0.1.0` 两副本可用；`kubectl get` 与 rollout 验证通过。
- 失败点：无阻塞性失败。
- 临时修正：无。

### 第 22 篇：Service、Ingress 与流量入口

- 预期产物：Traefik Ingress Controller、Ingress、Gateway、HTTPRoute、TLS Secret，`todo.localhost:18443/readyz` 与 `todo-gateway.localhost:18443/readyz` 都返回 200。
- 实际产物：`traefik` Deployment Ready，`Gateway` / `HTTPRoute` 状态为 `Accepted=True`、`Programmed=True`，`todo-gateway.localhost:18443/readyz` 返回 `200`。
- 失败点：`https://todo.localhost:18443/readyz` 仍返回 `404`，Ingress 已创建且 selector / endpoints 正常，但 Traefik 入口只在 Gateway 路由上命中，Ingress 路由未按章节主线预期生效。
- 临时修正：保留 Gateway 路由作为可用入口，Ingress 404 作为需回炉修订的文档偏差记录。

### 第 23 篇：ConfigMap、Secret 与配置管理

- 预期产物：`todo-api-config`、`todo-api-config-file`、`todo-api-auth`，Deployment 通过 `envFrom` 注入运行配置。
- 实际产物：`todo-workloads` 中 ConfigMap、Secret、Deployment 全部存在；`TODO_ENV`、`TODO_API_ADDR`、`TODO_RELEASE` 和 Secret key 注入验证通过，挂载文件可观察到更新。
- 失败点：无阻塞性失败。
- 临时修正：无。

### 第 24 篇：Kubernetes 存储

- 预期产物：PostgreSQL StatefulSet、PVC、迁移 Job、Todo API 切换到数据库后数据持久化。
- 实际产物：`todo-postgres-0`、PVC `postgres-data-todo-postgres-0` Bound，`todo-api-migrate` Job 成功，Pod 重建后数据保留。
- 失败点：阶段验收过程中需要确保 `TODO_JWT_SECRET`、`TODO_AUTH_USERS`、`TODO_DATABASE_DSN` 三类 Secret 一起注入，否则 migrate 会失败。
- 临时修正：迁移 Job 保持与 API 相同的 `envFrom` 结构，验证时按顺序先迁移再重启 API。

### 第 25 篇：Kubernetes 网络原理

- 预期产物：支持 NetworkPolicy 的临时 kind 集群、Calico、Todo Platform 网络实验对象、授权与未授权客户端、默认拒绝与放行策略。
- 实际产物：`todo-network-lab` 初始集群与 `todo-network-lab-retry` 重试集群都创建了；`todo-network-lab-retry` 现已 Ready，`kube-system` 中 Calico Pod 正常运行；`todo-workloads` 中 API / PostgreSQL 工作负载和 NetworkPolicy 全部就绪；授权客户端可访问 Todo API，未授权客户端与普通 namespace 访问 PostgreSQL 被拦截，API Pod 可直连 PostgreSQL。
- 失败点：宿主机最初 `fs.inotify.max_user_instances=128` 太低，导致第一个临时集群初始化时 systemd 报 `Too many open files`；随后虽然提高了 inotify 上限并重新创建 `todo-network-lab-retry`，但直接使用 operator 路径时镜像源仍缺少 Calico 关键镜像。用户补齐镜像后，改用 direct Calico manifest 并把镜像路径从 `quay.io/calico/{cni,node,kube-controllers}:v3.32.0` 切换到 `registry.cn-guangzhou.aliyuncs.com/yleoer/{cni,node,kube-controllers}:v3.32.0`，验证才闭环。
- 临时修正：将宿主机 `fs.inotify.max_user_instances` 提升到 `1024`；在 `todo-network-lab-retry` 中使用补齐后的平铺镜像源和 direct Calico manifest 完成恢复验证。

### 第 26 篇：Kubernetes 安全

- 预期产物：专用 ServiceAccount、最小 RBAC、Restricted Pod Security、非 root 安全上下文、镜像拉取和 Secret 管理规范。
- 实际产物：`todo-security-lab` 中 `todo-api-sa`、Role、RoleBinding、restricted pod、client pod 均存在并运行；`kubectl auth can-i` 结果与最小权限设计一致。
- 失败点：无阻塞性失败。
- 临时修正：无。

### 第 27 篇：Helm 4 包管理

- 预期产物：Helm Chart 安装、升级、回滚、打包，test hook 可运行。
- 实际产物：`todo-helm-lab` release 已安装并回滚到 revision 1 后当前 revision 3；`helm lint`、`helm template`、`helm history`、`helm status` 和 test hook 成功。
- 失败点：`templates/tests/test-connection.yaml` 需要用正确的 YAML / quote 结构表达命令；当前实现已通过验证，但仍应保留行号级复核。
- 临时修正：按现有 Chart 继续验证，不改课程正文。

### 第 28 篇：Kustomize 多环境配置管理

- 预期产物：dev / test / prod 三套 overlay，server-side dry-run 通过，副本数与资源差异正确。
- 实际产物：`todo-dev=1`、`todo-test=2`、`todo-prod=3`，`kubectl apply --dry-run=server -k` 三套 overlay 均通过。
- 失败点：无阻塞性失败。
- 临时修正：无。

### 阶段四验收文档

- 预期产物：主线验收命令、Helm 收束命令、Kustomize 收束命令、出版前 `mkdocs build --strict`。
- 实际产物：`kubectl config current-context`、`kubectl get nodes -o wide`、`kubectl get namespace`、`docker image inspect todo-api:v0.1.0`、`helm lint`、`helm template`、`helm history`、`helm status`、`kubectl apply --dry-run=server -k` 三套 overlay 全部通过；`mkdocs build --strict` 因缺少 `mkdocs` 命令失败。
- 失败点：`mkdocs` 未安装。
- 临时修正：将出版前文档构建失败记录为环境问题，不影响章节级验证结论。

## 已验证产物

- kind 主集群 `todo-k8s` 与 smoke 集群 `todo-k8s-lab`。
- Todo API 工作负载、Service、PostgreSQL StatefulSet、PVC、迁移 Job。
- Traefik、Ingress、Gateway API、TLS Secret。
- ConfigMap / Secret 配置迁移和文件挂载。
- RBAC、ServiceAccount、Restricted 安全基线。
- Helm 4 Chart 安装、升级、回滚、test hook。
- Kustomize dev / test / prod overlay。
- 阶段四验收命令中的主线验证链路。
- `todo-network-lab-retry` 中 Calico、NetworkPolicy、授权客户端和拒绝客户端验证结果。

## 失败项分类

### P0

无。

### P1

- `docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:804-809`：主线验收要求 Ingress 和 Gateway 都可访问，但本次实际只有 Gateway 路由 `todo-gateway.localhost` 返回 `200`，Ingress `todo.localhost` 仍为 `404`。
- `docs/chapters/stage-04-kubernetes/stage-04-acceptance.md:88`：阶段四主线写明 Ingress 和 Gateway API 路由都应可通过 Traefik 入口访问，但实际只验证到 Gateway。

### P2

- `docs/chapters/stage-04-kubernetes/20-k8s-architecture.md:43`、`:298-306`、`:417-420`：节点镜像固定 digest 仍与本次实际可用镜像不一致，建议同步更新为当前可复现镜像或明确版本覆盖方式。
- `docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:484`：Traefik 镜像路径示例里出现双重 registry 前缀，属于明显文档错误，需要回炉修正。
- `docs/chapters/stage-04-kubernetes/23-k8s-config-secret.md:645-646`、`:940-948`：Secret 验证命令应持续强调不要打印明文值，只检查存在性或 base64 密文。
- `docs/chapters/stage-04-kubernetes/25-k8s-networking.md:302-322`、`:365-379`、`:619-649`：NetworkPolicy 章节需要补充 Calico 镜像源切换说明，明确当仓库缺少 operator / node / calico-node 镜像时应切换到可用的镜像源并使用 direct manifest 恢复验证。
- `docs/chapters/stage-04-kubernetes/27-helm4.md:1167-1186`：Helm test hook 命令段已通过验证，但建议再对齐一次缩进与命令结构，避免复制时失真。
- 文档仓库本地验证：`mkdocs build --strict` 因未安装 `mkdocs` 无法执行。

## 网络/镜像源问题

- 第一个 `todo-network-lab` 临时集群创建时，宿主机 `fs.inotify.max_user_instances=128` 过低，systemd 日志出现 `Too many open files`，导致控制面迟迟不能 Ready。
- 将 `fs.inotify.max_user_instances` 提升到 `1024` 后，`todo-network-lab-retry` 能继续启动，但 direct / operator 方式下的 Calico 验证一度因为镜像源缺少关键镜像而阻塞。
- 用户补齐镜像后，将 Calico 相关镜像源从官方 `quay.io/calico/...` 改为 `registry.cn-guangzhou.aliyuncs.com/yleoer/{cni,node,kube-controllers}:v3.32.0`，并以此完成 direct manifest 安装和 NetworkPolicy 闭环验证。
- `kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.32.0/manifests/tigera-operator.yaml` 这类外网访问在当前网络下理论上可走代理，但本次成功路径最终依赖本地镜像源补齐和直接 manifest 替换。

## 需要修改的课程文档位置

- `docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:484`：修正 Traefik 镜像路径中的双重 registry 前缀。
- `docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:804-809`：补充 Ingress 404 的真实排查结论，或修正文中的主线验收表述，避免把 Gateway 和 Ingress 混为一个必达结果。
- `docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:843-864`：在“错误 1”里补充一个与本次现象一致的分支说明，区分 Ingress 已创建但 controller 未按预期接管和 Host 路由未命中的两类情况。
- `docs/chapters/stage-04-kubernetes/25-k8s-networking.md:314-322`：把 Calico 依赖、镜像源和临时实验前置条件写得更明确，说明 `registry.cn-guangzhou.aliyuncs.com/yleoer` 需要同时具备 operator / node / calico-node 镜像，或给出 direct manifest 的平铺镜像替换方案。
- `docs/chapters/stage-04-kubernetes/25-k8s-networking.md:365-379`、`:619-649`：补充“若镜像源没有 Calico 关键镜像，则该章在当前仓库环境中阻塞”的明确提示，以及切换到平铺镜像源后的可复现命令。
- `docs/chapters/stage-04-kubernetes/20-k8s-architecture.md:43`、`:298-306`、`:417-420`：同步节点镜像 digest 或明确说明如何覆盖。
- `docs/chapters/stage-04-kubernetes/stage-04-acceptance.md:88`：把阶段四验收条件从“Ingress 和 Gateway 都应可访问”与本次实际镜像/环境约束重新对齐。

## 需要实机复测的命令

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl get namespace
```

```bash
kubectl -n todo-workloads get deploy,svc,pod,job,pvc,configmap,secret -o wide
kubectl -n traefik get pods,svc,deploy,ingress,httproute,gatewayclass,gateway -o wide
kubectl -n todo-security-lab get sa,role,rolebinding,pod,job -o wide
kubectl -n todo-helm-lab get all,cm,secret,sa,role,rolebinding,pvc,hpa -o wide
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

```bash
sysctl -w fs.inotify.max_user_instances=1024
kind create cluster --name todo-network-lab-retry --config deployments/k8s-network/kind-calico-config.yaml --wait 120s
```

```bash
HTTP_PROXY=http://192.168.2.1:7890 HTTPS_PROXY=http://192.168.2.1:7890 ALL_PROXY=socks5://192.168.2.1:7890 \
  docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0
```

## 可加入教材附录的命令清单

详见 `validation-notes/stage-04-command-appendix.md`。

## 验证后环境状态

- `kind get clusters`：保留 `todo-dev`、`todo-k8s`、`todo-network-lab`、`todo-network-lab-retry`。
- `kubectl config current-context`：当前指向 `kind-todo-k8s`。
- `todo-network-lab`：初始失败现场保留。
- `todo-network-lab-retry`：重试集群保留且已 Ready。
- 主集群上的 Todo Platform、Traefik、Security、Helm 和 Kustomize 资源均保留。
- `mkdocs`：未安装，故出版前构建未执行。

## 环境保留策略

- 按用户要求，阶段四验证结束后不清理前序或失败现场环境。
- 只有当宿主机资源、端口冲突或明确要求清理时，才执行销毁或回收。
- 当前阶段已将失败现场和恢复尝试都保留，便于后续复测或回炉修文档。
