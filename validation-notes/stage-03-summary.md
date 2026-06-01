# 阶段三验证总结

- 验证阶段：阶段三 `docs/chapters/stage-03-docker`
- 验证分支：`codex/revalidation-stage-01`
- 验证日期：2026-05-31
- 验证工作区：`/root/workspace/stage-validation/cloud-native-todo-platform-stage02`
- 课程项目来源：`/root/workspace/cloud-native-todo-platform`
- 网络策略：外网命令按要求附加 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`；本机回环访问补充 `NO_PROXY=127.0.0.1,localhost` 和 `no_proxy=127.0.0.1,localhost`。
- 镜像策略：按用户最新要求，Stage 3 验证镜像统一使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/*`；此前尝试 `docker.1ms.run` 的失败只作为镜像源排查记录。

## 阶段结论

修改后通过。

阶段三主线可以在持续验证工作区中通过：`todo-api:v0.1.0` 镜像构建成功，镜像以 `nonroot:nonroot` 运行；Compose 环境成功启动 PostgreSQL、Redis、migrate、API 和 Traefik；`/healthz`、`/readyz`、登录和创建 Todo 均通过；kind 节点内可以通过 `crictl` 和 `ctr -n k8s.io` 看到导入后的 Todo API 镜像。

课程项目来源仓库本身仍未包含阶段三产物；验证过程中未修改课程文档，也未修改真实项目仓库。所有 Stage 3 Dockerfile、Compose 和记录文件均只写入持续验证工作区，阶段结束后保留已有阶段一/二/三环境，不执行清理。

文档仓库自身的 `mkdocs build --strict` 未能执行，原因是当前环境未安装 `mkdocs`。

## 已验证章节

1. `15-docker-basics.md`
2. `16-dockerfile.md`
3. `17-docker-compose.md`
4. `18-container-internals.md`
5. `19-oci-containerd-cri.md`
6. `stage-03-acceptance.md`
7. `stage-03-cheatsheet-troubleshooting.md`

## 按章节验证记录

### 第 15 篇：Docker 基础

- 预期产物：Docker / Compose 可用；可拉取 PostgreSQL、Redis、Go、Alpine 镜像；可通过 Docker 网络、数据卷和端口映射运行 Todo API、PostgreSQL、Redis。
- 实际产物：Docker 29.1.3、Compose 2.40.3、Buildx 0.30.1 可用；本地存在 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine`、`redis:8.2-alpine`、`golang:1.26-bookworm`、`alpine:3.23`；阶段二保留的 `todo-postgres` 和 `todo-redis` 健康运行。
- 失败点：阶段二环境已占用 `todo-postgres`、`todo-redis` 名称和宿主机 `5432`、`6379` 端口，不能原样执行第 15 篇清理同名容器的命令，否则会破坏阶段二环境。
- 临时修正：第 15 篇手工链路在 Stage 3 后续 Dockerfile / Compose 验证中覆盖；保留阶段二容器，不执行 `docker rm -f todo-postgres todo-redis`，不删除数据卷。

### 第 16 篇：Dockerfile 与镜像构建

- 预期产物：根目录 `.dockerignore`、`api/Dockerfile`、`todo-api:v0.1.0` 镜像；镜像包含 `/app/todo-api`、`configs/`、`api/migrations/`，使用非 root 用户，支持 `hash-password`、`config-check`、`migrate`、`serve`。
- 实际产物：在验证工作区生成 `.dockerignore` 和 `api/Dockerfile`；`docker build -f api/Dockerfile -t todo-api:v0.1.0 .` 成功；builder 阶段 `go test ./...` 通过；`docker image inspect` 显示 `User=nonroot:nonroot`、`Entrypoint=["/app/todo-api"]`、`Cmd=["serve"]`；带环境变量的 `config-check` 通过。
- 失败点：构建容器默认访问 `https://proxy.golang.org`，在当前网络下 `go mod download` 失败；课程 Dockerfile 的 `# syntax=docker/dockerfile:1.7` 会额外拉取 Dockerfile frontend 镜像；`stage-03-acceptance.md` 中裸跑 `docker run --rm todo-api:v0.1.0 config-check` 与实际配置校验不一致，会因缺少 `TODO_JWT_SECRET` / `TODO_AUTH_USERS` 失败。
- 临时修正：验证 Dockerfile 中设置 `GOPROXY=https://goproxy.cn,direct`、`GOSUMDB=off`；为降低外部 frontend 依赖，验证工作区去掉 `# syntax` 和 `RUN --mount`，改用普通 `RUN go mod download` / `go test ./...`；执行 `config-check` 时显式传入 `TODO_ENV=dev`、`TODO_JWT_SECRET` 和 `TODO_AUTH_USERS`。

### 第 17 篇：Docker Compose 本地编排

- 预期产物：`deployments/docker-compose/compose.yaml`、`.env.example`、`README.md`、本地 `.env`；Compose 服务包含 `postgres`、`redis`、`migrate`、`api`、`traefik`；`/readyz`、登录、创建 Todo 成功。
- 实际产物：在验证工作区生成 Compose 三件套和本地 `.env`；`docker compose --env-file .env config --services` 输出 `postgres`、`migrate`、`redis`、`api`、`traefik`；`docker compose --env-file .env up -d` 成功；`postgres`、`redis` healthy，`migrate` Exited(0)，`api` healthy，Traefik 暴露 `127.0.0.1:18080`；`/healthz`、`/readyz` 返回 200；登录返回 JWT，带 Token 创建 Todo 返回 201。
- 失败点：真实项目仓库缺少 Compose 产物；`.env` 中 bcrypt 哈希包含 `$`，shell 写入时非常容易因引号错误失败；用户要求改用 `registry.cn-guangzhou.aliyuncs.com/yleoer/*` 后，验证工作区已同步。
- 临时修正：用本地生成的 bcrypt 哈希写入 `deployments/docker-compose/.env`，并用单引号保护；Compose 镜像统一使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine`、`redis:8.2-alpine`、`traefik:v3.6`。

### 第 18 篇：容器运行原理

- 预期产物：能观察容器 PID、namespace、cgroup、镜像层、Compose 网络；Linux 环境能支持 `unshare`、`nsenter`、OverlayFS 和 cgroup v2 实验。
- 实际产物：`docker history todo-api:v0.1.0` 显示应用二进制、配置和迁移层；`docker inspect` 显示非 root 用户和 OCI Labels，包含 `version=v0.1.0`、`revision=c7f8dee`、`created=2026-05-31T10:00:27Z`；`docker run --rm registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 sh -c 'cat /etc/os-release; ps -o pid,ppid,comm'` 通过；`/proc/<pid>/ns` 可观察 api 容器的 cgroup/ipc/mnt/net/pid/user/uts namespace；`/proc/<pid>/cgroup` 显示 systemd docker scope；宿主机为 cgroup v2，支持 `unshare`、`nsenter`、`findmnt`、`ip` 和 OverlayFS。
- 失败点：未执行会写入 `/sys/fs/cgroup`、`mount`、`umount`、`chroot` 的破坏性或高权限实验，避免影响当前持续验证环境。
- 临时修正：只执行只读观察命令，把完整 namespace/cgroup/rootfs 手工实验列入需要实机复测命令。

### 第 19 篇：OCI、containerd、runc 与 CRI

- 预期产物：kind 集群可用；可导入 `todo-api:v0.1.0` 到 kind 节点；能在节点内用 `crictl` 和 `ctr -n k8s.io` 观察镜像、容器和 task。
- 实际产物：复用阶段一保留的 `todo-dev` kind 集群，节点 `todo-dev-control-plane` Ready，运行时为 `containerd://2.2.0`；`kind load docker-image todo-api:v0.1.0 --name todo-dev` 成功；节点内 `crictl images` 和 `ctr -n k8s.io images ls` 均能看到 `docker.io/library/todo-api:v0.1.0`，digest 为 `sha256:c91427aa88433656afb07e64c14ec552fcfde64e4d990b174e7f04a3fcd4baec`；`crictl ps` 和 `ctr -n k8s.io tasks ls` 可观察系统 Pod 容器。
- 失败点：未新建 `todo-runtime` 集群，避免额外拉取节点镜像和破坏阶段一共享环境；未部署独立 `runtime-probe` Pod，当前只完成阶段验收中的镜像导入和运行时只读观察。
- 临时修正：复用 `todo-dev` 代替 `todo-runtime`，记录实际命令差异。

### 阶段三验收文档

- 预期产物：主线验收和进阶验收命令可执行。
- 实际产物：`docker version`、`docker compose version`、`docker buildx version`、`docker build -f api/Dockerfile -t todo-api:v0.1.0 .`、镜像用户检查、带环境变量的 `config-check`、Compose 配置检查、Compose 启动、`/healthz`、`/readyz`、API 日志、`docker history`、`docker inspect`、`kind load docker-image`、节点内 `crictl` / `ctr` 均通过。
- 失败点：验收文档中的裸 `docker run --rm todo-api:v0.1.0 config-check` 不符合实际配置校验；验收文档新建 `todo-runtime` 与“保留阶段一环境”的本次验证策略不一致。
- 临时修正：给 `config-check` 补必要环境变量；复用 `todo-dev` kind 集群。

## 已验证产物

- 工具链：Docker、Docker Compose、Docker Buildx、kind、kubectl。
- Docker 基础：镜像拉取、镜像列表、Compose 前置检查、阶段二容器保留状态。
- 镜像构建：`.dockerignore`、`api/Dockerfile`、`todo-api:v0.1.0`、非 root 用户、ENTRYPOINT/CMD、OCI Labels、`hash-password`、`config-check`。
- 本地编排：`deployments/docker-compose/compose.yaml`、`.env.example`、`README.md`、本地 `.env`、PostgreSQL、Redis、migrate、API、Traefik。
- API smoke test：`/healthz`、`/readyz`、登录 JWT、创建 Todo、列表查询、API 日志。
- 容器原理观察：镜像层、容器 PID、namespace、cgroup、Compose 网络。
- 运行时观察：kind 节点、`kind load docker-image`、`crictl images`、`ctr -n k8s.io images ls`、`crictl ps`、`ctr -n k8s.io tasks ls`。

## 失败项分类

### P0

无。

### P1

- `docs/chapters/stage-03-docker/16-dockerfile.md:550`：Dockerfile 没有配置构建容器内的 Go module 代理，当前网络下 `go mod download` 访问 `proxy.golang.org` 失败。建议增加 `ARG GOPROXY=https://goproxy.cn,direct` 和 `ENV GOPROXY=${GOPROXY}`，或在构建命令中传入 `--build-arg GOPROXY=...`。
- `docs/chapters/stage-03-docker/stage-03-acceptance.md:96`、`:115`、`:180`：裸跑 `docker run --rm todo-api:v0.1.0 config-check` 会因实际应用要求 `TODO_JWT_SECRET` 和 `TODO_AUTH_USERS` 而失败；应改为带环境变量的命令，或让镜像内 `config-check` 仅检查静态配置。
- `docs/chapters/stage-03-docker/15-docker-basics.md:586` 和 `docs/chapters/stage-03-docker/16-dockerfile.md:784`：第 15/16 篇包含 `docker rm -f todo-api todo-postgres todo-redis`，若按“阶段环境不清理、连续验证”执行，会删除阶段二保留服务。建议提供“连续阶段验证模式”的容器名前缀或保护说明。

### P2

- `docs/chapters/stage-03-docker/16-dockerfile.md:550`：`# syntax=docker/dockerfile:1.7` 会从 Docker Hub 拉取 Dockerfile frontend；当前可通过代理拉取，但镜像源策略无法覆盖该隐式依赖。建议说明预拉取或提供无 BuildKit cache mount 的兼容版本。
- `docs/chapters/stage-03-docker/17-docker-compose.md:637`、`:701`：`.env` 写入 bcrypt 哈希时对引号非常敏感，建议附加 `grep '^TODO_AUTH_USERS=' .env` 和 `docker compose config | grep TODO_AUTH_USERS` 的验证步骤。
- `docs/chapters/stage-03-docker/19-oci-containerd-cri.md` 和 `stage-03-acceptance.md:149`：本次复用 `todo-dev` 验证通过；如果坚持新建 `todo-runtime`，需要明确这会额外拉取 kind 节点镜像，并与持续验证环境策略不同。
- 文档仓库本地验证：`mkdocs build --strict` 因未安装 `mkdocs` 无法执行。

## 网络/镜像源问题

- Buildx 初始缺失，已通过代理安装系统包 `docker-buildx`，版本为 `0.30.1-0ubuntu1~24.04.1`。
- 按用户最新要求，最终验证统一使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/*` 镜像。
- 曾尝试 `docker.1ms.run/library/alpine:3.23` 和 `docker.1ms.run/alpine:3.23`，均返回 `not found`；因此不再使用该 mirror 作为 Stage 3 最终镜像源。
- Dockerfile frontend `docker/dockerfile:1.7` 从 Docker Hub 拉取，首次下载约 12 MB，耗时较长；后续已缓存。
- 构建容器内默认 Go 代理为 `proxy.golang.org`，当前网络下连接失败；临时修正为 `GOPROXY=https://goproxy.cn,direct`。
- 本机 HTTP 验证必须设置 `NO_PROXY` 或 `curl --noproxy 127.0.0.1,localhost`。

## 需要修改的课程文档位置

- `docs/chapters/stage-03-docker/16-dockerfile.md:550`：Dockerfile 增加 `GOPROXY` / `GOSUMDB` 或构建参数说明，并说明企业网络下 Go module 下载策略。
- `docs/chapters/stage-03-docker/16-dockerfile.md:550`：补充 `# syntax=docker/dockerfile:1.7` 会拉取 Dockerfile frontend，或提供不使用 `RUN --mount` 的兼容 Dockerfile。
- `docs/chapters/stage-03-docker/stage-03-acceptance.md:96`、`:115`、`:180`：把 `docker run --rm todo-api:v0.1.0 config-check` 改为带 `TODO_ENV`、`TODO_JWT_SECRET`、`TODO_AUTH_USERS` 的命令。
- `docs/chapters/stage-03-docker/15-docker-basics.md:586`、`docs/chapters/stage-03-docker/16-dockerfile.md:784`：为连续阶段验证补充不要删除阶段二保留容器的说明，或提供 `stage03-*` 资源名前缀方案。
- `docs/chapters/stage-03-docker/17-docker-compose.md:637`、`:701`：补充 `.env` 中 bcrypt `$` 字符的验证命令，避免 shell 引号导致登录失败。
- `docs/chapters/stage-03-docker/19-oci-containerd-cri.md`：补充“可复用已有 kind 集群”的路径，避免和持续验证策略冲突。

## 需要实机复测的命令

```bash
docker rm -f stage03-api stage03-postgres stage03-redis 2>/dev/null || true
docker network inspect stage03-net >/dev/null 2>&1 || docker network create stage03-net
docker volume create stage03-postgres-data
docker volume create stage03-redis-data
```

```bash
docker run -d --name stage03-postgres --network stage03-net \
  -e POSTGRES_USER=todo \
  -e POSTGRES_PASSWORD=todo_password \
  -e POSTGRES_DB=todo_platform \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v stage03-postgres-data:/var/lib/postgresql/data \
  -p 127.0.0.1:15432:5432 \
  registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
```

```bash
docker run -d --name stage03-redis --network stage03-net \
  -v stage03-redis-data:/data \
  -p 127.0.0.1:16379:6379 \
  registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine \
  redis-server --requirepass todo_redis_password --appendonly yes
```

```bash
sudo unshare --uts --pid --mount --fork --mount-proc sh -c 'hostname stage03-ns && hostname && ps -o pid,ppid,comm'
```

```bash
LAB="$HOME/container-lab"
mkdir -p "$LAB/rootfs"
docker create --name stage03-alpine-rootfs registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
docker export stage03-alpine-rootfs | tar -C "$LAB/rootfs" -xf -
docker rm stage03-alpine-rootfs
sudo chroot "$LAB/rootfs" /bin/sh -c 'cat /etc/os-release; ps -o pid,ppid,comm'
```

```bash
sudo mkdir -p /sys/fs/cgroup/stage03-lab
echo 67108864 | sudo tee /sys/fs/cgroup/stage03-lab/memory.max
cat /sys/fs/cgroup/stage03-lab/memory.max
sudo rmdir /sys/fs/cgroup/stage03-lab
```

## 可加入教材附录的命令清单

详见 `validation-notes/stage-03-command-appendix.md`。

## 验证后环境状态

- `kind get clusters`：保留 `todo-dev`，节点 `todo-dev-control-plane` 为 Ready。
- 阶段二 Compose 环境：保留 `todo-postgres`、`todo-redis`，均 healthy，未清理数据卷。
- 阶段三 Compose 环境：保留 `todo-platform-postgres-1`、`todo-platform-redis-1`、`todo-platform-api-1`、`todo-platform-traefik-1`；`migrate` 为 Exited(0)；数据卷 `todo-platform_postgres-data`、`todo-platform_redis-data` 保留。
- Docker 镜像：本地存在 `todo-api:v0.1.0` 和 `registry.cn-guangzhou.aliyuncs.com/yleoer/*` 阶段三镜像。
- kind 节点 containerd：已加载 `docker.io/library/todo-api:v0.1.0`。

## 环境保留策略

- 阶段一、阶段二、阶段三环境均按用户要求保留。
- 阶段结束时只记录环境状态，不执行 `docker compose down`、`docker compose down -v`、`docker rm -f`、`docker volume rm` 或 `kind delete cluster`。
- 只有当残留环境阻塞下一阶段、冲突端口、或收到明确清理要求时，才执行销毁或回收。

## 文档仓库验证

- `git diff --check`：通过。
- `mkdocs build --strict`：失败，`mkdocs: command not found`。
