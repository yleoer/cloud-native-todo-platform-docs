# 课程文档修订建议

来源：`validation-notes/stage-01-summary.md` 至 `validation-notes/stage-06-summary.md` 以及对应 `*-command-appendix.md`。

原则：本文件只提出修订建议，不直接修改课程文档。网络、代理、镜像源导致的问题单独列出，不混入课程逻辑错误。

## 总体结论

- P0：暂无。六个阶段未发现会导致课程主线完全不可继续且无临时修正路径的问题。
- P1：需要优先修订。主要集中在脚本假通过、阶段产物缺失、配置验收命令不完整、Ingress 验收不一致、Operator 发布文件缺失和 RBAC 边界。
- P2：建议修订。主要集中在镜像 digest、命令兼容性、附录增强、Secret 展示方式、`mkdocs build --strict` 仓库级前置条件。

## P0 修订建议

无。

## P1 修订建议

### P1-01 kubectl client dry-run 无集群预期不成立

- 文档位置：`docs/chapters/stage-01-foundation/01-course-guide-env.md:653`，`docs/chapters/stage-01-foundation/stage-01-acceptance.md:240`
- 当前问题：文档说明 `kubectl apply --dry-run=client --validate=false` 在无集群时可做客户端检查，但实际 `kubectl v1.36.1` 仍会访问 API discovery。
- 实际验证证据：阶段一验证中，无 kubeconfig 上下文时该命令访问 `http://localhost:8080/api?timeout=32s` 并失败；创建 kind 集群后重跑通过。
- 建议修改文本：

```markdown
注意：`kubectl apply --dry-run=client --validate=false` 在部分 kubectl 版本中仍可能访问 API discovery。若当前机器没有可用 kubeconfig，上述命令可能连接 `localhost:8080` 并失败。课程验收建议先创建临时 kind 集群或确认已有可用 Kubernetes 上下文：

```bash
kind create cluster --name todo-dev --image kindest/node:v1.35.0
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
```
```

- 是否需要重新实机验证：需要。

### P1-02 阶段一进程检查脚本存在假通过

- 文档位置：`docs/chapters/stage-01-foundation/03-linux-process.md:724`
- 当前问题：`scripts/check-process-service.sh` 在服务 inactive 且 `MainPID=0` 时仍输出 OK 并返回 0，不能作为可靠验收脚本。
- 实际验证证据：阶段一负例验证显示服务 inactive 时脚本仍返回 0；人工执行 `systemctl is-active`、`systemctl show -p MainPID`、`ps`、`ss`、`curl`、`journalctl` 才能确认服务真实状态。
- 建议修改文本：

```bash
systemctl is-active --quiet todo-process-demo
PID="$(systemctl show -p MainPID --value todo-process-demo)"
test -n "$PID" && test "$PID" != "0"
ps -p "$PID" -o pid,ppid,user,stat,%cpu,%mem,etime,cmd
sudo ss -lntp 'sport = :18080'
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
journalctl -u todo-process-demo -n 20 --no-pager
```

并在脚本开头启用失败即退出：

```bash
set -Eeuo pipefail
```

- 是否需要重新实机验证：需要。

### P1-03 阶段一网络检查脚本存在假通过

- 文档位置：`docs/chapters/stage-01-foundation/04-linux-network.md:618`
- 当前问题：`scripts/check-network-demo.sh` 在 HTTP 失败时仍返回 0，验收可信度不足。
- 实际验证证据：阶段一负例验证中，服务未启动时脚本仍返回 0；前台持有服务后，手工执行 HTTP、端口、DNS、路由和抓包验证才闭环。
- 建议修改文本：

```bash
set -Eeuo pipefail

curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/todos
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/debug/request
sudo ss -lntp 'sport = :18080'
getent hosts localhost
ip route
```

- 是否需要重新实机验证：需要。

### P1-04 阶段二主线代码产物未落地

- 文档位置：`docs/chapters/stage-02-go-backend/07-go-basics.md` 至 `docs/chapters/stage-02-go-backend/14-go-production.md`，`docs/chapters/stage-02-go-backend/stage-02-acceptance.md:87`
- 当前问题：真实项目仓库只包含阶段一产物，缺少阶段二第 7-14 篇应落地的 Go 后端代码、配置、迁移和 Compose 文件，原样无法从阶段一环境继续执行阶段二验收。
- 实际验证证据：阶段二验证只能在独立持续验证工作区中按课程代码块生成产物；生成并临时修正后，`go test ./...`、race test、构建、OpenAPI、Compose、迁移和 API smoke test 才通过。
- 建议修改文本：

```markdown
开始阶段二前，请确认当前项目目录已经包含阶段二配套代码，或切换到课程提供的阶段二起始分支。至少应存在：

- `cmd/todo-cli/`
- `api/cmd/todo-api/`
- `api/internal/`
- `api/migrations/`
- `configs/`
- `docker-compose.yml`

如果你是从阶段一连续验证，请先同步阶段二代码产物，再执行本阶段验收命令。
```

- 是否需要重新实机验证：需要。

### P1-05 第 8 篇代码块缺少可抽取路径

- 文档位置：`docs/chapters/stage-02-go-backend/08-go-engineering-testing.md:312` 至 `837`
- 当前问题：第 8 篇“完整代码”代码块未使用 `title="path"` 标注，自动化验证无法直接抽取文件路径，章节产物可复现性弱。
- 实际验证证据：阶段二自动抽取时没有落地 `cmd/todo-api`、`internal/app`、`internal/config`、`internal/logger`、`test/integration`，只能用第 9-14 篇最终主线代码覆盖阶段验收。
- 建议修改文本：

```markdown
所有需要写入项目的代码块都应使用路径标题，例如：

```go title="api/internal/config/config.go"
// ...
```

```go title="api/internal/app/app.go"
// ...
```
```

- 是否需要重新实机验证：需要。

### P1-06 todo-load 失败时退出码仍为 0

- 文档位置：`docs/chapters/stage-02-go-backend/11-go-concurrency.md:592`
- 当前问题：`todo-load` 在请求全部失败时仍返回退出码 0，脚本只看退出码会误判压测通过。
- 实际验证证据：阶段二验证中，API 未启动时 `todo-load` 输出 `ok=0 failed=3`，但进程退出码仍为 0；API 启动后才输出 `ok=10 failed=0`。
- 建议修改文本：

```markdown
验收 `todo-load` 时不能只看进程退出码，还必须确认输出中的 `failed=0`。推荐实现为：当 `failed > 0` 时程序返回非 0；如果暂不修改程序，则验收脚本必须解析输出。
```

建议程序逻辑：

```go
if failed > 0 {
    os.Exit(1)
}
```

- 是否需要重新实机验证：需要。

### P1-07 阶段三 config-check 验收命令缺少必需环境变量

- 文档位置：`docs/chapters/stage-03-docker/stage-03-acceptance.md:96`、`:115`、`:180`
- 当前问题：裸跑 `docker run --rm todo-api:v0.1.0 config-check` 会因缺少 `TODO_JWT_SECRET` 和 `TODO_AUTH_USERS` 失败。
- 实际验证证据：阶段三验证中，补充 `TODO_ENV=dev`、`TODO_JWT_SECRET`、`TODO_AUTH_USERS` 后 `config-check` 通过。
- 建议修改文本：

```bash
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
docker run --rm \
  -e TODO_ENV=dev \
  -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
  -e "TODO_AUTH_USERS=admin=$HASH" \
  todo-api:v0.1.0 config-check
```

- 是否需要重新实机验证：需要。

### P1-08 阶段三清理命令会破坏连续验证环境

- 文档位置：`docs/chapters/stage-03-docker/15-docker-basics.md:586`，`docs/chapters/stage-03-docker/16-dockerfile.md:784`
- 当前问题：第 15/16 篇包含 `docker rm -f todo-api todo-postgres todo-redis`，按“每阶段环境保留、连续验证”执行会删除阶段二保留的 PostgreSQL/Redis。
- 实际验证证据：阶段三验证时阶段二容器 `todo-postgres`、`todo-redis` 已 healthy 且占用容器名和端口；验证中没有执行删除命令，而是使用后续 Dockerfile / Compose 链路覆盖 Docker 基础验证。
- 建议修改文本：

```markdown
如果你正在连续验证多个阶段，不要删除上一阶段保留的 `todo-postgres`、`todo-redis` 容器和数据卷。建议本章手工实验使用独立前缀：

```bash
docker rm -f stage03-api stage03-postgres stage03-redis 2>/dev/null || true
docker network inspect stage03-net >/dev/null 2>&1 || docker network create stage03-net
docker volume create stage03-postgres-data
docker volume create stage03-redis-data
```
```

- 是否需要重新实机验证：需要。

### P1-09 阶段四 Ingress 主线验收不一致

- 文档位置：`docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:804-809`，`docs/chapters/stage-04-kubernetes/stage-04-acceptance.md:88`
- 当前问题：主线验收要求 Ingress 和 Gateway 都可通过 Traefik 入口访问，但实测只有 Gateway 成功，Ingress `todo.localhost` 返回 404。
- 实际验证证据：阶段四验证中 `Gateway` / `HTTPRoute` 状态为 `Accepted=True`、`Programmed=True`，`todo-gateway.localhost:18443/readyz` 返回 200；`https://todo.localhost:18443/readyz` 返回 404，Ingress、selector、endpoints 存在但路由未命中。
- 建议修改文本：

```markdown
本节分别验证 Ingress 与 Gateway API。若 Gateway API 返回 200 但 Ingress 返回 404，应按独立问题排查 IngressClass、Traefik provider、Host 匹配和 TLS entryPoint，不应把 Gateway 通过等同于 Ingress 通过。

```bash
curl -k -i --resolve todo.localhost:18443:127.0.0.1 https://todo.localhost:18443/readyz
curl -k -i --resolve todo-gateway.localhost:18443:127.0.0.1 https://todo-gateway.localhost:18443/readyz
kubectl -n todo-workloads describe ingress todo-api
kubectl -n traefik logs deployment/traefik --tail=120
```
```

- 是否需要重新实机验证：需要。

### P1-10 阶段五 Loki gateway 在单节点 kind 上滚动更新卡住

- 文档位置：`observability/loki/loki-values.yaml`，`docs/chapters/stage-05-production-engineering/32-logging-opentelemetry.md`
- 当前问题：`loki-gateway` 在单节点 kind 上会被 `podAntiAffinity` 和 RollingUpdate 组合卡住，需要临时改为 `Recreate`；旧 ReplicaSet 残留还可能继续引用 Docker Hub 镜像。
- 实际验证证据：阶段五验证记录显示临时将 `loki-gateway` 改成 `Recreate` 后通过，并需要回收旧 gateway ReplicaSet，避免残留 Docker Hub 镜像引用。
- 建议修改文本：

```yaml
gateway:
  deploymentStrategy:
    type: Recreate
```

并增加说明：

```markdown
在单节点 kind 环境中，Loki gateway 如果启用强 podAntiAffinity，RollingUpdate 可能无法同时调度新旧 Pod。教学环境建议使用 `Recreate`，并在镜像源切换后检查旧 ReplicaSet 是否仍引用旧镜像。
```

- 是否需要重新实机验证：需要。

### P1-11 阶段五故障演练 YAML 不满足 restricted PodSecurity

- 文档位置：`docs/chapters/stage-05-production-engineering/33-k8s-troubleshooting.md`
- 当前问题：原始故障 Pod/容器清单在 `pod-security.kubernetes.io/enforce=restricted` 命名空间下会被拒绝。
- 实际验证证据：阶段五验证记录显示实际演练需补齐 `securityContext` 后才能在 restricted 命名空间创建故障 Pod。
- 建议修改文本：

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  seccompProfile:
    type: RuntimeDefault
```

并在所有故障演练 Pod/容器中按需补齐。

- 是否需要重新实机验证：需要。

### P1-12 阶段六 envtest / e2e 文件缺失

- 文档位置：`docs/chapters/stage-06-platform-operator/40-operator-test-release.md`
- 当前问题：正文要求 `test/envtest/todoapp_envtest_test.go`、`test/e2e/run-kind-e2e.sh`，但验证工作区原始状态缺失这些文件。
- 实际验证证据：阶段六验证中补齐 envtest 测试和 e2e 脚本后，`go test ./test/envtest -v` 与 `./test/e2e/run-kind-e2e.sh` 通过。
- 建议修改文本：

```markdown
完成本节后，项目中必须存在以下文件，并且可以直接执行：

- `test/envtest/todoapp_envtest_test.go`
- `test/e2e/run-kind-e2e.sh`

```bash
chmod +x test/e2e/run-kind-e2e.sh
KUBEBUILDER_ASSETS="$(pwd)/bin/k8s/1.35.0-linux-amd64" go test ./test/envtest -v
./test/e2e/run-kind-e2e.sh
```
```

- 是否需要重新实机验证：需要。

### P1-13 阶段六 Helm 安装缺少租户 namespace 前置条件

- 文档位置：`docs/chapters/stage-06-platform-operator/40-operator-test-release.md`，`docs/chapters/stage-06-platform-operator/stage-06-operator-acceptance.md`
- 当前问题：Helm 首次安装会创建 Role/RoleBinding 到 `todo-team-a` / `todo-team-b`，但目标 namespace 不存在时安装失败，并留下 failed release 占用名称。
- 实际验证证据：阶段六验证首次 `helm install` 失败；先创建并标注租户 namespace，再 `helm uninstall` 清理失败 release 后，install / upgrade / rollback 通过。
- 建议修改文本：

```bash
kubectl create namespace todo-team-a --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace todo-team-b --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace todo-team-a platform.todo.example.com/admission=enabled --overwrite
kubectl label namespace todo-team-b platform.todo.example.com/admission=enabled --overwrite

helm install todo-operator operator/helm/todo-operator \
  -n todo-operator-system \
  --create-namespace
```

如果首次安装失败：

```bash
helm uninstall todo-operator -n todo-operator-system
```

- 是否需要重新实机验证：需要。

### P1-14 阶段六 Kustomize 发布路径缺少 Watch 边界环境变量

- 文档位置：`docs/chapters/stage-06-platform-operator/41-operator-production.md`
- 当前问题：Kustomize `config/manager/manager.yaml` 原始部署未注入 `WATCH_NAMESPACE`、`WATCH_LABEL_SELECTOR`、`POD_NAMESPACE`，导致未带接管标签的 `TodoApp` 仍被调谐；与 Helm 生产边界不一致。
- 实际验证证据：阶段六验证中给 Kustomize Deployment 注入上述变量后，带标签对象被调谐，不带标签对象未生成 Deployment/Service。
- 建议修改文本：

```yaml
env:
  - name: WATCH_NAMESPACE
    value: todo-operator-smoke
  - name: WATCH_LABEL_SELECTOR
    value: platform.todo.example.com/managed=true
  - name: POD_NAMESPACE
    valueFrom:
      fieldRef:
        fieldPath: metadata.namespace
```

- 是否需要重新实机验证：需要。

### P1-15 阶段六 Helm RBAC 缺少 Operator 命名空间 Events 权限

- 文档位置：`docs/chapters/stage-06-platform-operator/41-operator-production.md`，`operator/helm/todo-operator/templates/rbac.yaml`
- 当前问题：leader election Event 会写入 Operator 安装命名空间，当前 Helm Role 未授权 core `events`，日志出现 forbidden。
- 实际验证证据：阶段六验证中业务调谐可继续，但 Helm 运行日志显示 ServiceAccount 没有在 `todo-operator-system` 创建 core Events 的权限。
- 建议修改文本：

```yaml
- apiGroups: [""]
  resources: ["events"]
  verbs: ["create", "patch", "update"]
```

并补充验证：

```bash
SA=system:serviceaccount:todo-operator-system:todo-operator
kubectl auth can-i create events --as="${SA}" -n todo-operator-system
```

- 是否需要重新实机验证：需要。

### P1-16 阶段六最终交付文件未真实落地

- 文档位置：`docs/chapters/stage-06-platform-operator/42-final-integration-career.md`
- 当前问题：正文要求的 `deployments/final/`、GitOps Application、CI、`scripts/final-verify.sh`、`docs/portfolio/` 在验证工作区原始状态缺失。
- 实际验证证据：阶段六验证中补齐最小可执行版本后，client dry-run、server-side dry-run、`scripts/final-verify.sh` 均通过，`todo-team-a/todo-platform-final` 进入 Ready。
- 建议修改文本：

```markdown
完成本章后，项目中必须真实存在并提交以下文件：

- `deployments/final/todoapp-local-smoke.yaml`
- `deployments/final/todoapp-full.yaml`
- `deployments/gitops/applications/todo-platform-final.yaml`
- `.github/workflows/final-integration.yml`
- `scripts/final-verify.sh`
- `docs/portfolio/`
```

并增加文件存在性验收：

```bash
test -f deployments/final/todoapp-local-smoke.yaml
test -f deployments/final/todoapp-full.yaml
test -f deployments/gitops/applications/todo-platform-final.yaml
test -f .github/workflows/final-integration.yml
test -x scripts/final-verify.sh
```

- 是否需要重新实机验证：需要。

## P2 修订建议

### P2-01 本机回环访问需要避开代理

- 文档位置：`docs/chapters/stage-01-foundation/06-shell-scripting.md:648`、`:800`，以及所有使用 `curl 127.0.0.1` / `localhost` 的章节
- 当前问题：全局代理变量会干扰本机健康检查。
- 实际验证证据：阶段一、二、三验证中，本机 `curl` 在代理环境下出现 `Empty reply from server` 或连接失败；补充 `NO_PROXY=127.0.0.1,localhost` 或 `curl --noproxy` 后通过。
- 建议修改文本：

```bash
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost

curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
```

- 是否需要重新实机验证：需要。

### P2-02 TODO_AUTH_USERS 中 bcrypt 哈希需要明确引号要求

- 文档位置：`docs/chapters/stage-02-go-backend/14-go-production.md:2315`，`docs/chapters/stage-02-go-backend/stage-02-acceptance.md:142`，`docs/chapters/stage-03-docker/17-docker-compose.md:637`、`:701`
- 当前问题：bcrypt 哈希包含 `$`，未正确加引号时会被 shell 或 `.env` 展开，导致配置检查或登录失败。
- 实际验证证据：阶段二、三验证均使用 `HASH=$(...)` 后通过双引号或单引号保存 `TODO_AUTH_USERS` 才通过。
- 建议修改文本：

```bash
HASH=$(go run ./api/cmd/todo-api hash-password "change-me-123")
export TODO_AUTH_USERS="admin=$HASH"
```

Compose `.env` 推荐：

```bash
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
printf "\nTODO_AUTH_USERS='admin=%s'\n" "$HASH" >> .env
grep '^TODO_AUTH_USERS=' .env
docker compose --env-file .env config | grep TODO_AUTH_USERS
```

- 是否需要重新实机验证：需要。

### P2-03 Dockerfile frontend 隐式依赖需要说明

- 文档位置：`docs/chapters/stage-03-docker/16-dockerfile.md:550`
- 当前问题：`# syntax=docker/dockerfile:1.7` 会从 Docker Hub 拉取 Dockerfile frontend，镜像源策略无法覆盖该隐式依赖。
- 实际验证证据：阶段三验证中该 frontend 首次下载约 12 MB，耗时较长；为降低外部依赖，验证工作区去掉 `# syntax` 和 `RUN --mount` 后改用普通 `RUN go mod download` / `go test ./...` 通过。
- 建议修改文本：

```markdown
如果企业网络无法拉取 `docker/dockerfile:1.7` frontend，可以删除 `# syntax=...` 并将 BuildKit cache mount 改成普通 `RUN`：

```dockerfile
RUN go mod download
RUN go test ./...
```
```

- 是否需要重新实机验证：需要。

### P2-04 阶段三 OCI 章节应提供复用已有 kind 集群路径

- 文档位置：`docs/chapters/stage-03-docker/19-oci-containerd-cri.md`，`docs/chapters/stage-03-docker/stage-03-acceptance.md:149`
- 当前问题：文档倾向新建 `todo-runtime`，会额外拉取 kind 节点镜像；连续验证模式下更适合复用阶段一 `todo-dev`。
- 实际验证证据：阶段三复用 `todo-dev` 后，`kind load docker-image`、节点内 `crictl images` 和 `ctr -n k8s.io images ls` 均能看到 `todo-api:v0.1.0`。
- 建议修改文本：

```bash
kind get clusters
kubectl --context kind-todo-dev get nodes -o wide
kind load docker-image todo-api:v0.1.0 --name todo-dev
NODE=$(docker ps --filter name=todo-dev-control-plane --format '{{.Names}}' | head -n 1)
docker exec "$NODE" crictl images | grep todo-api
docker exec "$NODE" ctr -n k8s.io images ls | grep todo-api
```

- 是否需要重新实机验证：需要。

### P2-05 阶段四节点镜像 digest 固定值需要更新或弱化

- 文档位置：`docs/chapters/stage-04-kubernetes/20-k8s-architecture.md:43`、`:298-306`、`:417-420`
- 当前问题：节点镜像固定 digest 与本次实际可用镜像不一致。
- 实际验证证据：阶段四使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/node:v1.35.0` 继续验证；文档固定 digest `sha256:452d707...` 与实测不一致。
- 建议修改文本：

```markdown
镜像 digest 会随镜像同步方式变化。若使用课程镜像仓库，请以本机 `docker image inspect` 输出为准：

```bash
docker image inspect registry.cn-guangzhou.aliyuncs.com/yleoer/node:v1.35.0 --format '{{json .RepoDigests}}'
```
```

- 是否需要重新实机验证：需要。

### P2-06 阶段四 Traefik 镜像路径存在双重 registry 前缀

- 文档位置：`docs/chapters/stage-04-kubernetes/22-k8s-service-ingress.md:484`
- 当前问题：Traefik 镜像路径示例中出现双重 registry 前缀。
- 实际验证证据：阶段四验证将该问题记录为明显文档错误；Traefik 主体部署 Ready，但该路径需要行号级修正。
- 建议修改文本：

```yaml
image: registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6
```

- 是否需要重新实机验证：需要。

### P2-07 Secret 验证命令不要打印明文

- 文档位置：`docs/chapters/stage-04-kubernetes/23-k8s-config-secret.md:645-646`、`:940-948`
- 当前问题：Secret 验证命令应避免直接打印明文值。
- 实际验证证据：阶段四验证只检查 Secret key 注入和存在性，未直接暴露密钥明文。
- 建议修改文本：

```bash
kubectl -n todo-workloads get secret todo-api-auth
kubectl -n todo-workloads exec "$POD" -- sh -c 'test -n "$TODO_JWT_SECRET" && echo "jwt secret exists"'
kubectl -n todo-workloads exec "$POD" -- sh -c 'test -n "$TODO_AUTH_USERS" && echo "auth users exists"'
```

- 是否需要重新实机验证：不需要，建议文档审阅即可。

### P2-08 Helm test hook YAML 建议复核缩进与命令结构

- 文档位置：`docs/chapters/stage-04-kubernetes/27-helm4.md:1167-1186`
- 当前问题：`templates/tests/test-connection.yaml` 需要用正确的 YAML / quote 结构表达命令；当前实现已通过，但建议避免复制失真。
- 实际验证证据：阶段四 `helm lint`、`helm template`、`helm test` 均通过。
- 建议修改文本：

```yaml
args:
  - /bin/sh
  - -c
  - |
    wget -qO- --timeout=5 http://todo-platform:8080/healthz
```

- 是否需要重新实机验证：不需要，若改动实际 Chart 则需要。

### P2-09 阶段五 Tempo 端口映射写错

- 文档位置：`docs/chapters/stage-05-production-engineering/32-logging-opentelemetry.md`，`docs/chapters/stage-05-production-engineering/stage-05-acceptance.md`
- 当前问题：`kubectl -n observability port-forward service/tempo 3200:3100` 与实际 Service 端口不符。
- 实际验证证据：阶段五验证中真实可用端口为 `3200:3200`。
- 建议修改文本：

```bash
kubectl -n observability port-forward service/tempo 3200:3200
curl -sS http://127.0.0.1:3200/api/traces/<trace-id>
```

- 是否需要重新实机验证：需要。

### P2-10 阶段五日志关联查询需按 trace_id 对齐

- 文档位置：`docs/chapters/stage-05-production-engineering/32-logging-opentelemetry.md`
- 当前问题：课程文本里 `X-Request-ID` 关联日志的实测路径和章节描述不完全一致；日志里可稳定拿到 `trace_id`，但查询窗口需要按实际输出对齐。
- 实际验证证据：阶段五验证记录显示 `trace_id` 可稳定获取，`X-Request-ID` 查询需要按实际日志输出和时间窗口再对齐。
- 建议修改文本：

```markdown
如果按 `X-Request-ID` 查询不到日志，请先放宽 LogQL 时间窗口，并从 Loki 日志中确认实际字段名。链路关联建议优先记录并查询 `trace_id`。
```

```bash
curl -sS -G 'http://127.0.0.1:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={namespace="todo-dev", app="todo-platform"} | json'
```

- 是否需要重新实机验证：需要。

### P2-11 mkdocs strict 构建需要仓库级前置修复

- 文档位置：`docs/chapters/stage-05-production-engineering/stage-05-acceptance.md`，`docs/chapters/stage-06-platform-operator/stage-06-operator-acceptance.md`，`requirements.txt`
- 当前问题：`mkdocs build --strict` 受全站 nav warning 和 `git-revision-date-localized` warning 影响失败；`mkdocs-material>=9.5.0` 会安装 9.7.6 并新增供应商 warning。
- 实际验证证据：阶段一至四因未安装 `mkdocs` 无法执行；阶段六创建 `.venv` 并临时 pin `mkdocs-material<9.7` 后仍因全站 nav / git-revision warning 失败。
- 建议修改文本：

```markdown
执行出版前构建前，请先安装文档依赖并确认仓库级 nav / git revision warning 已修复：

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
mkdocs build --strict
```

如使用 `mkdocs-material>=9.7` 触发供应商 warning，应同步修复配置或锁定兼容版本。
```

- 是否需要重新实机验证：需要。

### P2-12 Helm 4.2.0 不支持 helm version --short

- 文档位置：`docs/chapters/stage-06-platform-operator/stage-06-version-environment.md`
- 当前问题：`helm version --short` 在 Helm 4.2.0 返回 unknown flag。
- 实际验证证据：阶段六版本矩阵验证记录显示实际可用命令为 `helm version`。
- 建议修改文本：

```bash
helm version
```

如需兼容旧版 Helm，可标注：

```bash
helm version --short 2>/dev/null || helm version
```

- 是否需要重新实机验证：需要。

### P2-13 envtest 直接命令需要 KUBEBUILDER_ASSETS

- 文档位置：`docs/chapters/stage-06-platform-operator/stage-06-operator-acceptance.md`
- 当前问题：直接执行 `go test ./test/envtest -v` 在新环境中容易找不到 envtest assets。
- 实际验证证据：阶段六首次 `make test` 缺少 envtest assets；执行 `make setup-envtest` 并设置 `KUBEBUILDER_ASSETS` 后通过。
- 建议修改文本：

```bash
make setup-envtest
KUBEBUILDER_ASSETS="$(pwd)/bin/k8s/1.35.0-linux-amd64" go test ./test/envtest -v
```

- 是否需要重新实机验证：需要。

### P2-14 final-verify metrics port-forward 端口需要可覆盖

- 文档位置：`docs/chapters/stage-06-platform-operator/42-final-integration-career.md`
- 当前问题：`scripts/final-verify.sh` 的 metrics port-forward 如果本地端口冲突会失败。
- 实际验证证据：阶段六总结将 metrics port-forward 端口冲突列为需要修订位置。
- 建议修改文本：

```bash
METRICS_LOCAL_PORT="${METRICS_LOCAL_PORT:-18083}"
kubectl -n todo-operator-system port-forward svc/todo-operator-metrics "${METRICS_LOCAL_PORT}:8080"
```

- 是否需要重新实机验证：需要。

### P2-15 可选 MutatingAdmissionPolicy 需要 Kubernetes v1.36 实机复测

- 文档位置：`docs/chapters/stage-06-platform-operator/39-operator-advanced.md`，`docs/chapters/stage-06-platform-operator/stage-06-version-environment.md`
- 当前问题：可选 `MutatingAdmissionPolicy` 需要 Kubernetes v1.36.x API server，本轮未新建 v1.36 集群验证。
- 实际验证证据：阶段六主线 Webhook / Finalizer / Conditions 已通过，但 `MutatingAdmissionPolicy` 被标记为需要实机复测。
- 建议修改文本：

```markdown
`MutatingAdmissionPolicy` 为可选实验，需 Kubernetes v1.36.x API server。若当前 kind / 集群版本低于要求，请跳过该实验，主线以 MutatingWebhookConfiguration 为准。
```

- 是否需要重新实机验证：需要。

## 网络 / 代理 / 镜像源问题

### N-01 外网代理与本机 NO_PROXY 应作为全局前置条件

- 文档位置：所有阶段环境准备和验收文档。
- 当前问题：外网命令需要代理；本机 `127.0.0.1` / `localhost` 访问不应走代理。
- 实际验证证据：阶段一至六外网访问均优先设置 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`；本机回环访问必须补 `NO_PROXY` 或 `curl --noproxy` 才稳定。
- 建议修改文本：

```bash
export HTTP_PROXY=http://192.168.2.1:7890
export HTTPS_PROXY=http://192.168.2.1:7890
export ALL_PROXY=socks5://192.168.2.1:7890
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
export GOPROXY=https://goproxy.cn,direct
```

- 是否需要重新实机验证：需要。

### N-02 阶段二镜像源策略与课程原文不一致

- 文档位置：`docs/chapters/stage-02-go-backend/12-database.md:355`，`docs/chapters/stage-02-go-backend/13-redis-cache.md:370`
- 当前问题：课程正文 Compose 镜像使用阿里云地址；阶段二最初要求 Docker 拉取优先 `docker.1ms.run`。
- 实际验证证据：阶段二验证工作区临时改为 `docker.1ms.run/postgres:18-alpine`、`docker.1ms.run/redis:8.2-alpine` 后通过，但镜像层下载较慢。
- 建议修改文本：

```yaml
image: docker.1ms.run/postgres:18-alpine
```

```yaml
image: docker.1ms.run/redis:8.2-alpine
```

或增加镜像替换说明：

```bash
docker pull docker.1ms.run/postgres:18-alpine
docker pull docker.1ms.run/redis:8.2-alpine
```

- 是否需要重新实机验证：需要。

### N-03 阶段三最终镜像源已切换为 yleoer

- 文档位置：`docs/chapters/stage-03-docker/15-docker-basics.md` 至 `19-oci-containerd-cri.md`
- 当前问题：阶段三后续按用户最新要求统一使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/*`；此前 `docker.1ms.run/library/alpine:3.23` 和 `docker.1ms.run/alpine:3.23` 返回 not found。
- 实际验证证据：阶段三最终使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine`、`redis:8.2-alpine`、`golang:1.26-bookworm`、`alpine:3.23`、`traefik:v3.6` 通过。
- 建议修改文本：

```bash
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
```

- 是否需要重新实机验证：需要。

### N-04 Dockerfile 内 Go module 下载需要 GOPROXY

- 文档位置：`docs/chapters/stage-03-docker/16-dockerfile.md:550`
- 当前问题：构建容器默认访问 `https://proxy.golang.org`，当前网络下 `go mod download` 失败。
- 实际验证证据：阶段三 Dockerfile 增加 `GOPROXY=https://goproxy.cn,direct`、`GOSUMDB=off` 后构建和 builder 阶段测试通过。
- 建议修改文本：

```dockerfile
ARG GOPROXY=https://goproxy.cn,direct
ENV GOPROXY=${GOPROXY} \
    GOSUMDB=off
```

或构建时传参：

```bash
docker build --build-arg GOPROXY=https://goproxy.cn,direct -f api/Dockerfile -t todo-api:v0.1.0 .
```

- 是否需要重新实机验证：需要。

### N-05 Calico 镜像源和 inotify 前置条件需要明确

- 文档位置：`docs/chapters/stage-04-kubernetes/25-k8s-networking.md:302-322`、`:365-379`、`:619-649`
- 当前问题：NetworkPolicy 章节依赖 Calico 关键镜像和宿主机 inotify 上限；镜像源缺失或 `fs.inotify.max_user_instances` 太低会阻塞实验。
- 实际验证证据：阶段四第一个 `todo-network-lab` 因 `fs.inotify.max_user_instances=128` 出现 `Too many open files`；提高到 1024 后继续。用户补齐 yleoer 平铺镜像后，将 `quay.io/calico/{cni,node,kube-controllers}:v3.32.0` 替换为 `registry.cn-guangzhou.aliyuncs.com/yleoer/{cni,node,kube-controllers}:v3.32.0` 才完成 NetworkPolicy 验证。
- 建议修改文本：

```bash
sysctl fs.inotify.max_user_instances fs.inotify.max_user_watches
sudo sysctl -w fs.inotify.max_user_instances=1024

docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0
```

替换 direct manifest 镜像：

```bash
sed \
  -e 's#quay.io/calico/cni:v3.32.0#registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0#g' \
  -e 's#quay.io/calico/node:v3.32.0#registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0#g' \
  -e 's#quay.io/calico/kube-controllers:v3.32.0#registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0#g' \
  /tmp/calico-v3.32.0.yaml > /tmp/calico-v3.32.0-yleoer.yaml
```

- 是否需要重新实机验证：需要。

### N-06 阶段六 todo-operator 镜像远端拉取失败

- 文档位置：`docs/chapters/stage-06-platform-operator/40-operator-test-release.md`，`docs/chapters/stage-06-platform-operator/stage-06-operator-acceptance.md`
- 当前问题：`registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test` 远端拉取失败，发布前需确认镜像已推送。
- 实际验证证据：阶段六验证中远端拉取返回 `pull access denied / insufficient_scope`；临时本地构建同名 tag 并 `kind load docker-image` 后通过。
- 建议修改文本：

```bash
docker build \
  --build-arg HTTP_PROXY="${HTTP_PROXY}" \
  --build-arg HTTPS_PROXY="${HTTPS_PROXY}" \
  --build-arg ALL_PROXY="${ALL_PROXY}" \
  --build-arg GOPROXY="${GOPROXY}" \
  -t registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test \
  operator/kubebuilder

docker push registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test
```

本地 kind 验证：

```bash
kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test --name todo-gitops
```

- 是否需要重新实机验证：需要。

## 可新增到教材附录的命令

### 通用代理与本机访问

```bash
export HTTP_PROXY=http://192.168.2.1:7890
export HTTPS_PROXY=http://192.168.2.1:7890
export ALL_PROXY=socks5://192.168.2.1:7890
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
export GOPROXY=https://goproxy.cn,direct
```

```bash
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
```

### 阶段一

```bash
kind create cluster --name todo-dev --image kindest/node:v1.35.0
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
kubectl apply -f docs/examples/multi-doc.yaml
kubectl get namespace todo-dev
kubectl -n todo-dev get configmap todo-env
```

```bash
systemctl is-active todo-process-demo
PID="$(systemctl show -p MainPID --value todo-process-demo)"
ps -p "$PID" -o pid,ppid,user,stat,%cpu,%mem,etime,cmd
sudo ss -lntp 'sport = :18080'
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
```

### 阶段二

```bash
go mod tidy
go fmt ./...
go test ./...
go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http
go build ./api/cmd/todo-api ./api/cmd/todo-load
go run ./api/cmd/todo-api openapi
```

```bash
HASH=$(TODO_CONFIG_DIR=configs TODO_ENV=dev go run ./api/cmd/todo-api hash-password "change-me-123")
export TODO_AUTH_USERS="admin=$HASH"
go run ./api/cmd/todo-api config-check
```

### 阶段三

```bash
docker build \
  --build-arg GOPROXY=https://goproxy.cn,direct \
  -f api/Dockerfile \
  -t todo-api:v0.1.0 .
```

```bash
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
docker run --rm \
  -e TODO_ENV=dev \
  -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
  -e "TODO_AUTH_USERS=admin=$HASH" \
  todo-api:v0.1.0 config-check
```

```bash
kind load docker-image todo-api:v0.1.0 --name todo-dev
NODE=$(docker ps --filter name=todo-dev-control-plane --format '{{.Names}}' | head -n 1)
docker exec "$NODE" crictl images | grep todo-api
docker exec "$NODE" ctr -n k8s.io images ls | grep todo-api
```

### 阶段四

```bash
kubectl -n traefik port-forward svc/traefik 18443:443
curl -k -i --resolve todo.localhost:18443:127.0.0.1 https://todo.localhost:18443/readyz
curl -k -i --resolve todo-gateway.localhost:18443:127.0.0.1 https://todo-gateway.localhost:18443/readyz
kubectl -n todo-workloads describe ingress todo-api
kubectl -n traefik logs deployment/traefik --tail=120
```

```bash
sysctl fs.inotify.max_user_instances fs.inotify.max_user_watches
sudo sysctl -w fs.inotify.max_user_instances=1024
```

```bash
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/cni:v3.32.0
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/node:v3.32.0
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/kube-controllers:v3.32.0
```

### 阶段五

```bash
argocd app get todo-platform-dev
argocd app sync todo-platform-dev --timeout 300
argocd app wait todo-platform-dev --sync --health --timeout 300
```

```bash
kubectl -n observability port-forward service/loki-gateway 3100:80
kubectl -n observability port-forward service/tempo 3200:3200
kubectl -n monitoring port-forward service/monitoring-grafana 3000:80
```

```bash
kubectl apply -f troubleshooting/k8s/01-pending-pod.yaml
kubectl apply -f troubleshooting/k8s/02-broken-service.yaml
kubectl apply -f troubleshooting/k8s/03-pvc-missing-storageclass.yaml
kubectl apply -f troubleshooting/k8s/04-dns-broken.yaml
kubectl apply -f troubleshooting/k8s/05-oom-demo.yaml
./troubleshooting/k8s/99-cleanup.sh
```

### 阶段六

```bash
cd operator/kubebuilder
make generate
make manifests
go test ./...
make setup-envtest
KUBEBUILDER_ASSETS="$(pwd)/bin/k8s/1.35.0-linux-amd64" go test ./test/envtest -v
```

```bash
kubectl create namespace todo-team-a --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace todo-team-b --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace todo-team-a platform.todo.example.com/admission=enabled --overwrite
kubectl label namespace todo-team-b platform.todo.example.com/admission=enabled --overwrite
```

```bash
helm lint operator/helm/todo-operator
helm template todo-operator operator/helm/todo-operator --namespace todo-operator-system --include-crds
helm install todo-operator operator/helm/todo-operator -n todo-operator-system --create-namespace
helm upgrade todo-operator operator/helm/todo-operator -n todo-operator-system
helm rollback todo-operator 1 -n todo-operator-system
helm history todo-operator -n todo-operator-system
```

```bash
SA=system:serviceaccount:todo-operator-system:todo-operator
kubectl auth can-i create deployments.apps --as="${SA}" -n todo-team-a
kubectl auth can-i delete todoapps --as="${SA}" -n todo-team-a
kubectl auth can-i create events --as="${SA}" -n todo-operator-system
```

```bash
test -f deployments/final/todoapp-local-smoke.yaml
test -f deployments/final/todoapp-full.yaml
test -f deployments/gitops/applications/todo-platform-final.yaml
test -f .github/workflows/final-integration.yml
test -x scripts/final-verify.sh
scripts/final-verify.sh
MANIFEST=deployments/final/todoapp-full.yaml scripts/final-verify.sh
```

### 文档构建

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
mkdocs build --strict
```
