# 阶段六验证总结

- 阶段结论：修改后通过
- 验证日期：2026-05-31
- 验证工作区：`/root/workspace/stage-validation/cloud-native-todo-platform-stage02`
- 课程目录：`docs/chapters/stage-06-platform-operator`
- 集群上下文：`kind-todo-gitops`

## 已验证章节

按章节顺序验证：

- 第 34 篇：Kubernetes API 扩展机制
- 第 35 篇：CRD 设计与实践
- 第 36 篇：Controller 机制：Informer 与 Workqueue
- 第 37 篇：手写简化版 Controller
- 第 38 篇：Kubebuilder 入门
- 第 39 篇：Operator 高级机制
- 第 40 篇：Operator 测试、发布与升级
- 第 41 篇：Operator 生产实践
- 第 42 篇：综合集成与职业能力验收
- 附录 A：Operator 开发能力验收
- 附录 B：版本锁定与环境矩阵

## 已验证产物

- `operator/api-model/todoapp-api-model.yaml`
- `operator/api-model/api-boundary.md`
- `operator/crds/base/todoapps.platform.todo.example.com.yaml`
- `operator/crds/base/tododatabases.platform.todo.example.com.yaml`
- `operator/crds/base/todocaches.platform.todo.example.com.yaml`
- `operator/samples/todoapp.yaml`
- `operator/samples/tododatabase.yaml`
- `operator/samples/todocache.yaml`
- `operator/samples/invalid-todoapp.yaml`
- `operator/controller-simulator/main.go`
- `operator/controller-simulator/watch-design.md`
- `operator/handwritten/main.go`
- `operator/kubebuilder/` Kubebuilder Operator
- `operator/helm/todo-operator/` Helm Chart
- `deployments/final/todoapp-local-smoke.yaml`
- `deployments/final/todoapp-full.yaml`
- `deployments/gitops/applications/todo-platform-final.yaml`
- `scripts/final-verify.sh`
- `docs/portfolio/` 作品集占位文档和 evidence 目录

## 逐章记录

### 第 34 篇：Kubernetes API 扩展机制

- 预期产物：`TodoApp` 平台 API 草案，能说明 GVK/GVR、spec/status、Conditions 和声明式 API 边界。
- 实际产物：生成并保留 `operator/api-model/todoapp-api-model.yaml`、`operator/api-model/api-boundary.md`。
- 失败点：无阻塞。
- 临时修正：无。

### 第 35 篇：CRD 设计与实践

- 预期产物：`TodoApp`、`TodoDatabase`、`TodoCache` 三个 CRD，支持 `kubectl explain`、server-side dry-run、非法样例拒绝。
- 实际产物：三个 CRD 均 `Established`；`kubectl api-resources --api-group=platform.todo.example.com` 显示 `todoapps`、`tododatabases`、`todocaches`；`kubectl explain todoapp.spec`、`tododatabase.spec`、`todocache.spec` 成功；三个合法 sample server dry-run 成功；`invalid-todoapp.yaml` 因 `spec.replicas: 0` 被 API server 拒绝。
- 失败点：无阻塞。
- 临时修正：无。

### 第 36 篇：Controller 机制：Informer 与 Workqueue

- 预期产物：控制循环设计文档和模拟程序，能展示事件入队、去重、重试、幂等调谐和 Ready 流程。
- 实际产物：`operator/controller-simulator/main.go` 可运行；输出覆盖 dedupe、retry、ready 流程；`watch-design.md` 存在。
- 失败点：无阻塞。
- 临时修正：无。

### 第 37 篇：手写简化版 Controller

- 预期产物：`operator/handwritten` client-go Controller，可构建并回写 `TodoApp.status`。
- 实际产物：`go build ./...` 通过；手写 Controller 能把 `TodoApp.status` 更新为 `Progressing` / `Accepted`。
- 失败点：初版进程退出路径不完整，context 取消后 workqueue 没有关闭。
- 临时修正：在验证工作区为 `operator/handwritten/main.go` 增加 context 取消时的 queue shutdown。

### 第 38 篇：Kubebuilder 入门

- 预期产物：`operator/kubebuilder` 项目，`TodoApp` API、CRD、RBAC、Reconciler，创建 CR 后自动生成 Deployment 和 Service。
- 实际产物：Kubebuilder v4.11.1、controller-gen v0.20.0、setup-envtest release-0.23 可用；`make generate`、`make manifests`、`go test ./...`、`make test` 通过；Kustomize 部署后 `todo-operator-smoke/todo-operator-managed` 进入 `Ready`，生成同名 Deployment 和 Service。
- 失败点：首次 `make test` 缺少 envtest assets。
- 临时修正：执行 `make setup-envtest`，并使用 `KUBEBUILDER_ASSETS=/root/workspace/stage-validation/cloud-native-todo-platform-stage02/operator/kubebuilder/bin/k8s/1.35.0-linux-amd64`。

### 第 39 篇：Operator 高级机制

- 预期产物：Webhook 默认值/校验、Finalizer、Events、Conditions、OwnerReference。
- 实际产物：Webhook Service 和 endpoints 可用；合法 TodoApp 被接受并调谐；非法镜像 `:latest` 被 ValidatingWebhook 拒绝；Finalizer 添加和删除清理可观察；`TodoApp.status.phase=Ready`、`readyReplicas` 回写成功。
- 失败点：部署刚完成时出现过 webhook `connection refused` 瞬时错误；Controller 与前阶段 `todo-dev/todo-platform` 同名 Deployment 发生 selector 不匹配冲突。
- 临时修正：等待 Webhook endpoints Ready 后复测；删除只由阶段六误建的冲突 CR，使用独立命名空间 `todo-operator-smoke` 和 `todo-team-a` 做 smoke，保留前阶段环境。

### 第 40 篇：Operator 测试、发布与升级

- 预期产物：`test/envtest/todoapp_envtest_test.go`、`test/e2e/run-kind-e2e.sh`、Kustomize 发布清单、Helm Chart，`helm install/upgrade/rollback` 通过。
- 实际产物：`go test ./test/envtest -v` 通过；`./test/e2e/run-kind-e2e.sh` 通过；`helm lint` 和 `helm template --include-crds` 通过；Helm release `todo-operator` 完成 install -> upgrade -> rollback，当前 revision 3 deployed。
- 失败点：
  - 验证工作区原始状态缺少 `test/envtest/todoapp_envtest_test.go` 和 `test/e2e/run-kind-e2e.sh`。
  - Helm 首次安装失败：`todo-team-a` / `todo-team-b` 命名空间不存在，导致 Role/RoleBinding 无法创建。
  - 首次失败留下 `failed` release，占用 `todo-operator` 名称。
- 临时修正：
  - 在验证工作区补齐 envtest 测试和 e2e 脚本。
  - 先创建并标注 `todo-team-a`、`todo-team-b`，再重新执行 Helm 安装。
  - `helm uninstall todo-operator -n todo-operator-system` 清理失败 release 后重跑 install/upgrade/rollback。

### 第 41 篇：Operator 生产实践

- 预期产物：最小 RBAC、Watch namespace、label selector、Webhook namespace selector、metrics Service、PDB、生产 smoke test。
- 实际产物：Helm 路径安装了 Role/RoleBinding、metrics Service、Webhook、Certificate、Issuer、PDB；`kubectl auth can-i create deployments.apps --as=system:serviceaccount:todo-operator-system:todo-operator -n todo-team-a` 返回 `yes`；`delete todoapps` 返回 `no`；metrics `/metrics` 可访问并包含 `controller_runtime_reconcile_errors_total{controller="todoapp"} 0`。
- 失败点：
  - Kustomize `config/manager/manager.yaml` 原始部署未注入 `WATCH_NAMESPACE`、`WATCH_LABEL_SELECTOR`、`POD_NAMESPACE`，导致未带接管标签的 `TodoApp` 仍被调谐。
  - Helm 运行日志显示 leader election Event 写入 `todo-operator-system` 被 RBAC 拒绝：ServiceAccount 没有在 Operator 安装命名空间创建 core Events 的权限。
- 临时修正：
  - 在验证工作区给 Kustomize Deployment 注入 `WATCH_NAMESPACE=todo-operator-smoke`、`WATCH_LABEL_SELECTOR=platform.todo.example.com/managed=true`、`POD_NAMESPACE` downward API；复测后带标签对象被调谐，不带标签对象未生成 Deployment/Service。
  - 保留 Event RBAC 问题为 P1 课程修正项；业务调谐未受影响。

### 第 42 篇：综合集成与职业能力验收

- 预期产物：`deployments/final/`、GitOps Application、最终 CI、`scripts/final-verify.sh`、`docs/portfolio/` 和 evidence 目录；最小 YAML 能触发 Operator 闭环。
- 实际产物：验证工作区补齐上述文件后，`kubectl apply --dry-run=client --validate=false` 和 server-side dry-run 均通过；`scripts/final-verify.sh` 成功，`todo-team-a/todo-platform-final` 进入 `Ready 2`，生成 Deployment 和 Service，并写入 evidence 文件。
- 失败点：验证工作区原始状态没有第 42 篇要求的最终交付文件。
- 临时修正：在验证工作区补齐最小可执行版本和作品集占位文件。

### 附录 A：Operator 开发能力验收

- 预期产物：阶段六总体验收命令可执行。
- 实际产物：CRD、Kubebuilder、envtest、e2e、Helm、生产基线、最终 YAML 均完成实测。
- 失败点：`mkdocs build --strict` 在当前仓库全站模式下失败，原因是仓库级 nav / git-revision warning；使用未锁定的 `mkdocs-material>=9.5.0` 会额外拉到 9.7.6 并触发供应商 warning，strict 模式下同样失败。
- 临时修正：创建 `.venv` 安装依赖；临时 pin `mkdocs-material<9.7` 去掉供应商 warning，但仍因全站 nav warning 失败。该问题不是阶段六页面语法错误，但会阻断验收命令。

### 附录 B：版本锁定与环境矩阵

- 预期产物：工具版本和 Kubernetes 兼容边界明确。
- 实际产物：Go 1.26.3、Docker 29.1.3、buildx 0.30.1、kind v0.31.0、kubectl v1.36.1、Helm v4.2.0、Kubebuilder v4.11.1 可用；当前集群 API server 为 kind 既有集群，envtest assets 为 Kubernetes 1.35.0。
- 失败点：第 39 篇可选 `MutatingAdmissionPolicy` 需要 Kubernetes v1.36.x API server，本轮未新建 v1.36 集群验证。
- 临时修正：标记为需要实机复测，不阻塞主线 Operator 闭环。

## 失败项分类

### P0

- 无。核心 Operator 主线未阻塞：CRD、Controller、Webhook、Helm、Kustomize、envtest、e2e、最终 YAML 均可运行。

### P1

- `docs/chapters/stage-06-platform-operator/40-operator-test-release.md`：正文要求 `test/envtest/todoapp_envtest_test.go`、`test/e2e/run-kind-e2e.sh`，但验证工作区原始产物缺失，需要确保章节步骤能生成这些文件并保留。
- `docs/chapters/stage-06-platform-operator/41-operator-production.md` / Kustomize 发布路径：需要同步注入 `WATCH_NAMESPACE`、`WATCH_LABEL_SELECTOR`、`POD_NAMESPACE`，否则 Kustomize 部署与 Helm 生产边界不一致。
- `docs/chapters/stage-06-platform-operator/40-operator-test-release.md` / Helm 安装步骤：必须明确先创建 `watch.namespaces` 中的租户命名空间，否则 Role/RoleBinding 安装失败。
- `docs/chapters/stage-06-platform-operator/42-final-integration-career.md`：正文要求的 `deployments/final/`、GitOps Application、CI、`scripts/final-verify.sh`、`docs/portfolio/` 在验证工作区原始状态缺失，需要确保课程步骤真正落地产物。
- `operator/helm/todo-operator/templates/rbac.yaml` 或第 41 篇 RBAC 说明：leader election Event 会写入 Operator 安装命名空间，当前 Helm Role 未授权 core `events`，日志出现 forbidden。

### P2

- `mkdocs build --strict` 受全站 nav warning 和 `git-revision-date-localized` warning 影响失败；`requirements.txt` 未锁定 `mkdocs-material` 上限时会安装 9.7.6 并新增供应商 warning。
- `docs/chapters/stage-06-platform-operator/stage-06-operator-acceptance.md` 的总体验收命令需要补充 `KUBEBUILDER_ASSETS="$(pwd)/bin/k8s/1.35.0-linux-amd64"` 或先执行 `make test`/`make setup-envtest`，否则直接 `go test ./test/envtest -v` 在新环境中容易找不到 envtest assets。
- `docs/chapters/stage-06-platform-operator/stage-06-version-environment.md` 的 `helm version --short` 在 Helm 4.2.0 返回 unknown flag，实际可用命令为 `helm version`。
- `registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test` 远端拉取失败，验证中用同名 tag 本地构建并 `kind load`，需要发布前确认镜像已推送到 yleoer。

## 网络/镜像源问题

- 外网相关命令均优先设置：
  - `HTTP_PROXY=http://192.168.2.1:7890`
  - `HTTPS_PROXY=http://192.168.2.1:7890`
  - `ALL_PROXY=socks5://192.168.2.1:7890`
  - `GOPROXY=https://goproxy.cn,direct`
- Docker 基础镜像使用 yleoer：
  - `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm`
  - `registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot`
  - `registry.cn-guangzhou.aliyuncs.com/yleoer/hello:plain-text`
- `registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test` 远端拉取失败：`pull access denied / insufficient_scope`。临时修正是本地构建同名镜像并 `kind load docker-image`。
- cert-manager 已使用镜像替换后的 yleoer 路径安装，`cert-manager`、`cainjector`、`webhook` 均 Running。
- Helm Chart 首次安装不是网络问题，而是目标租户 namespace 不存在。

## 需要修改的课程文档位置

- `docs/chapters/stage-06-platform-operator/40-operator-test-release.md`
  - 确保 `test/envtest/todoapp_envtest_test.go` 和 `test/e2e/run-kind-e2e.sh` 在章节步骤后真实存在。
  - Helm 安装前增加 `todo-team-a`、`todo-team-b` namespace 创建命令。
  - envtest 直接命令增加 `KUBEBUILDER_ASSETS` 说明。
- `docs/chapters/stage-06-platform-operator/41-operator-production.md`
  - Kustomize 路径补 `WATCH_NAMESPACE`、`WATCH_LABEL_SELECTOR`、`POD_NAMESPACE`。
  - Helm RBAC 补 Operator namespace core `events` 权限，或说明 leader election event forbidden 可接受但应修复。
- `docs/chapters/stage-06-platform-operator/42-final-integration-career.md`
  - 确认最终交付文件实际写入项目，而不是只在正文展示。
  - `scripts/final-verify.sh` 的 metrics port-forward 要避免本地端口冲突，并允许覆盖端口。
- `docs/chapters/stage-06-platform-operator/stage-06-operator-acceptance.md`
  - `mkdocs build --strict` 的全站 warning 需要先修复或注明仓库级前置条件。
  - `helm install` 命令前补租户 namespace 前置条件。
- `docs/chapters/stage-06-platform-operator/stage-06-version-environment.md`
  - `helm version --short` 改成当前 Helm 4.2.0 可执行的 `helm version`，或标注版本差异。
- `requirements.txt`
  - 建议锁定 `mkdocs-material<9.7` 或处理 9.7.6 的供应商 warning；同时处理 nav warning 和 git-revision warning，否则 strict 构建持续失败。

## 需要实机复测的命令

- `mkdocs build --strict`：修复全站 nav/git-revision warning 后复测。
- `helm version --short`：当前 Helm 4.2.0 不支持，需确认教材版本命令。
- `helm install todo-operator operator/helm/todo-operator -n todo-operator-system --create-namespace`：需要在全新环境中确认租户 namespace 前置步骤。
- `kubectl apply -f deployments/final/todoapp-local-smoke.yaml`
- `scripts/final-verify.sh`
- `MANIFEST=deployments/final/todoapp-full.yaml scripts/final-verify.sh`
- `kubectl auth can-i create deployments.apps --as=system:serviceaccount:todo-operator-system:todo-operator -n todo-team-a`
- `kubectl auth can-i delete todoapps --as=system:serviceaccount:todo-operator-system:todo-operator -n todo-team-a`
- `kubectl -n todo-operator-system port-forward svc/todo-operator-metrics 18083:8080`
- Kubernetes v1.36.x 集群上的 `MutatingAdmissionPolicy` 可选实验。

## 可加入教材附录的命令清单

- `kubectl apply --server-side -f operator/crds/base`
- `kubectl wait --for=condition=Established crd/todoapps.platform.todo.example.com crd/tododatabases.platform.todo.example.com crd/todocaches.platform.todo.example.com --timeout=60s`
- `kubectl api-resources --api-group=platform.todo.example.com`
- `kubectl explain todoapp.spec`
- `kubectl apply --dry-run=server -f operator/samples/todoapp.yaml`
- `kubectl apply --dry-run=server -f operator/samples/invalid-todoapp.yaml`
- `cd operator/controller-simulator && go run .`
- `cd operator/handwritten && go build ./...`
- `cd operator/kubebuilder && make generate && make manifests && go test ./... && make test`
- `cd operator/kubebuilder && KUBEBUILDER_ASSETS="$(pwd)/bin/k8s/1.35.0-linux-amd64" go test ./test/envtest -v`
- `cd operator/kubebuilder && ./test/e2e/run-kind-e2e.sh`
- `helm lint operator/helm/todo-operator`
- `helm template todo-operator operator/helm/todo-operator --namespace todo-operator-system --include-crds`
- `helm install todo-operator operator/helm/todo-operator -n todo-operator-system --create-namespace`
- `helm upgrade todo-operator operator/helm/todo-operator -n todo-operator-system`
- `helm rollback todo-operator 1 -n todo-operator-system`
- `kubectl -n todo-operator-system rollout status deploy/todo-operator-controller-manager --timeout=180s`
- `kubectl apply -f deployments/final/todoapp-local-smoke.yaml`
- `scripts/final-verify.sh`
