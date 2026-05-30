# 阶段六附录 B：版本锁定与环境矩阵

阶段六涉及 Kubernetes API 扩展、Kubebuilder、controller-runtime、cert-manager、envtest、Helm 和 kind 集成测试。任何一个版本漂移，都可能表现为 Webhook 证书异常、CRD schema 不兼容、envtest 下载失败或 Helm 模板字段变化。出版前应把环境矩阵固定下来。

## 1. 推荐版本矩阵

| 组件 | 出版版实验值 | 用途 | 出版前验证点 |
|---|---:|---|---|
| Go | 1.26.x | 编译 Operator 和运行测试 | `go test ./...`、`go env GOPROXY` |
| Kubernetes | v1.35.0 或 v1.36.x | 第 34-38 篇基础 API/CRD/Controller | 确认不使用 v1.36 专属能力 |
| Kubernetes | v1.36.x | 第 39-42 篇 Webhook、策略型准入、生产基线 | `kubectl version` 服务端为 v1.36.x |
| kubectl | v1.36.x | 操作 API、dry-run、排障 | 客户端与服务端小版本差异不超过 1 |
| kind | v0.31+ | 本地集成测试集群 | 能拉取并启动 `kindest/node:v1.36.0` |
| Docker | 29.x | 构建 Operator 和 Todo API 镜像 | `docker build`、`kind load docker-image` |
| Kubebuilder | 4.11.x | 初始化项目、生成 Webhook/RBAC/CRD | `kubebuilder version` 与正文命令一致 |
| controller-runtime | Kubebuilder 项目依赖版本 | Manager、Client、cache、envtest | `go list -m sigs.k8s.io/controller-runtime`，记录具体版本号 |
| controller-gen | Kubebuilder 项目锁定版本 | 生成 CRD、DeepCopy、RBAC | `make manifests` 后无未预期 diff |
| setup-envtest | Kubebuilder 项目锁定版本 | 下载 API server 和 etcd 测试二进制 | `make envtest`、`go test ./test/envtest -v` |
| cert-manager | 1.20.x（v1.35 验证线）；v1.36 线需复核官方支持矩阵 | Webhook 证书和 CA 注入 | Pod Ready，Certificate/Issuer 正常 |
| Helm | 4.2.x | Operator Chart 安装、升级、回滚 | `helm lint/template/install/upgrade/rollback` |
| kustomize | kubectl 内置或项目锁定版本 | 渲染 Kubebuilder config | `kubectl kustomize config/default` |

版本表中的 `x` 不是随意漂移的意思。正式出版或团队落地时，应记录具体 patch 版本和验证日期。

截至 2026-05-30 的出版前复核结论如下：

- `MutatingAdmissionPolicy` 在 Kubernetes v1.36 中已是 stable，并默认启用；第 39 篇仍把它放在可选实验中，是为了避免学习者被准入策略细节打断主线。
- `kubectl kustomize` 仍是 kubectl 官方命令的一部分，出版前保留 `kubectl kustomize config/default` 作为实际验证口径。
- cert-manager 官方支持矩阵显示 1.20.x 支持和测试到 Kubernetes 1.35；面向 Kubernetes 1.36 的锁定版本应在正式出版前重新确认，优先采用首个官方列出支持 1.36 的 cert-manager 版本。若复核时该版本尚未发布，则 Webhook 证书实验应使用 v1.35 线或明确标注为兼容性待验证。
- Helm 相关命令以实际 `helm version` 为准，至少确认 `helm template --include-crds`、`helm list -A`、`helm version --short`、`helm install/upgrade/rollback` 在锁定版本中可用。

## 2. 阶段六集群策略

阶段六建议使用两段式环境：

| 范围 | 推荐环境 | 原因 |
|---|---|---|
| 第 34-38 篇 | 可复用阶段五 `todo-gitops` 集群，v1.35.0 或 v1.36.x 均可 | 主要使用稳定 API discovery、CRD、status、client-go 和 Kubebuilder 基础能力 |
| 第 39-42 篇 | 新建或切换到 v1.36.x kind 集群 | 第 39 篇包含 `MutatingAdmissionPolicy` 可选实验，后续生产基线也按 v1.36 工具链验收 |

如果你从阶段五一路做到阶段六，最容易出错的是“以为还在同一条环境线”。建议在第 39 篇开始前执行：

```bash
kubectl version
kubectl api-resources | grep -i mutatingadmissionpolicy || true
```

如果服务端不是 v1.36.x，或者没有 `MutatingAdmissionPolicy`，则跳过该可选实验，或重建课程锁定集群：

```bash
kind delete cluster --name todo-operator-e2e
kind create cluster --name todo-operator-e2e --image kindest/node:v1.36.0
```

不要在共享测试、预发或生产集群上为了课程实验随意删除集群或 CRD。

## 3. 工具链验证命令

出版前建议统一收集以下命令输出：

```bash
go version
docker version --format '{{.Server.Version}}'
kubectl version
kind version
kubebuilder version
helm version
go list -m sigs.k8s.io/controller-runtime
go list -m k8s.io/client-go
```

在 `operator/kubebuilder/` 中验证生成链路：

```bash
make generate
make manifests
git diff -- api config
go test ./...
```

如果 `git diff` 出现未预期变化，说明生成工具版本、marker 或模板输入不一致。出版前不要忽略这类 diff。

## 4. envtest 弱网与缓存

envtest 需要下载本地 API server 和 etcd 二进制，首次运行可能较慢。弱网或企业内网环境建议：

```bash
make envtest
go test ./test/envtest -v
```

常见问题：

- `fork/exec .../kube-apiserver: no such file or directory`：envtest 二进制未下载或缓存路径损坏。
- 下载超时：配置 `GOPROXY`、`HTTPS_PROXY` 或企业内部代理。
- CRD 加载失败：执行 `make manifests`，确认 `CRDDirectoryPaths` 指向 `config/crd/bases`。
- status 更新失败：检查 CRD 是否启用了 `subresources.status`。

CI 中建议缓存 Go module、`bin/` 工具目录和 envtest 二进制，避免每次流水线重新下载。

## 5. cert-manager 与 Webhook 验证

Webhook 相关问题通常不是 Reconciler 逻辑错误，而是证书、Service、Endpoint、CA 注入或 namespace selector 问题。出版前至少验证：

```bash
kubectl -n cert-manager get pod
kubectl -n todo-operator-system get certificate,issuer,secret
kubectl -n todo-operator-system get svc,endpointslice
kubectl get mutatingwebhookconfiguration,validatingwebhookconfiguration
kubectl apply --dry-run=server -f config/samples/platform_v1alpha1_todoapp.yaml
```

判断口径：

- cert-manager Pod 必须 Ready。
- Webhook Service 必须有 endpoint。
- `caBundle` 应由 cert-manager 注入。
- 如果 Webhook 故障会阻断写请求，生产必须有故障窗口、回滚方案和告警。

## 6. Helm 与 CRD 升级边界

Helm 的 `crds/` 目录适合首次安装 CRD，但不会像普通模板一样自动升级或删除 CRD。生产中不要把 CRD 破坏性变更混在普通 Chart 升级里。

出版前验证：

```bash
helm lint operator/helm/todo-operator
helm template todo-operator operator/helm/todo-operator --include-crds >/tmp/todo-operator.yaml
kubectl apply --dry-run=server -f /tmp/todo-operator.yaml
```

CRD 变更应单独检查：

- 是否删除字段。
- 是否改变字段类型。
- 是否收窄 enum。
- 是否改变默认值。
- 是否新增 storage version。
- 是否需要 conversion webhook 或存储版本迁移。

## 7. 破坏性命令边界

以下命令只适合本地 kind 或一次性 dev 集群：

```bash
kubectl delete crd todoapps.platform.todo.example.com --ignore-not-found
kubectl delete namespace todo-operator-system --ignore-not-found
kind delete cluster --name todo-operator-e2e
rm -rf operator/handwritten
rm -rf operator/crds operator/samples
```

共享测试、预发或生产环境必须改为变更流程：

- 先确认 CRD 是否已有真实业务对象。
- 删除 CRD 前导出现有 CR，并确认备份与恢复方式。
- 删除 namespace 前确认是否包含 Webhook、证书、metrics 或租户业务资源。
- 回滚 Operator 镜像不等于回滚 CRD 契约。
- 所有临时修复最终应回到 GitOps 仓库。

## 8. 出版版记录模板

```text
验收日期：
操作系统：
Go 版本：
Docker 版本：
kind 版本：
Kubernetes 服务端版本：
kubectl 版本：
Kubebuilder 版本：
controller-runtime 版本：
cert-manager 版本：
Helm 版本：
envtest 是否缓存：
kind e2e 是否通过：
Helm install/upgrade/rollback 是否通过：
已跳过的可选实验：
失败与修复记录：
```

这份记录可作为出版 QA 留存，也可放进团队内部落地文档。
