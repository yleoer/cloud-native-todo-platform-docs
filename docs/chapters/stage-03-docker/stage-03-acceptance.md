# 阶段三附录 A：Docker 容器技术综合验收

阶段三的目标不是只会执行几条 `docker run` 命令，而是把 Todo Platform 从“本地 Go 服务”推进为“可构建、可运行、可排障、可交付的容器化服务”。

完成本附录后，你应该能把第 15-19 篇的成果整理成作品集：Docker CLI 运行环境、生产风格 Dockerfile、Compose 本地编排、容器底层观察记录、运行时关系说明和排障复盘。

## 1. 验收目标

阶段三最终验收关注 6 件事：

| 验收方向 | 你需要证明什么 |
|---|---|
| Docker 基础 | 能启动、停止、查看、进入、删除容器，能说明镜像、容器、网络、数据卷的区别 |
| 镜像构建 | 能编写多阶段 Dockerfile，能解释构建上下文、缓存、非 root、最小镜像和标签策略 |
| 本地编排 | 能用 Compose 一条命令启动 API、PostgreSQL、Redis，并能处理启动顺序、配置和数据持久化 |
| 容器原理 | 能解释 namespace、cgroups、rootfs、UnionFS、镜像分层和容器进程模型 |
| 运行时链路 | 能说明 Docker、containerd、runc、CRI、kubelet、Kubernetes 的关系 |
| 生产意识 | 能识别镜像安全、密钥泄露、root 运行、端口暴露、数据卷清理和运行时误操作风险 |

## 2. 最终作品集目录

建议在 `cloud-native-todo-platform` 应用仓库中形成以下结构：

```text
cloud-native-todo-platform/
├── .dockerignore
├── Dockerfile
├── compose.yaml
├── README.md
├── cmd/
│   └── todo-api/
├── configs/
├── migrations/
├── docs/
│   ├── docker/
│   │   ├── stage-03-acceptance.md
│   │   ├── image-build-record.md
│   │   ├── compose-run-record.md
│   │   └── runtime-troubleshooting-record.md
│   └── api/
├── scripts/
└── internal/
```

如果你的应用仓库目录略有差异，没有关系。验收重点是：Dockerfile、Compose、配置、迁移、验证命令和排障记录都能被别人复现。

## 3. 统一版本与工具基线

阶段三建议使用以下基线：

| 工具或镜像 | 建议版本 | 说明 |
|---|---|---|
| Docker | Docker Desktop 或 Docker Engine 当前稳定版 | 需要支持 Compose v2 和 BuildKit |
| Docker Compose | v2.20 或更新版本 | 使用 `docker compose`，不是旧版 `docker-compose` |
| Go 镜像 | `golang:1.26` / `golang:1.26-bookworm` | 与阶段二 Go 后端项目保持当前稳定工具链 |
| Alpine 镜像 | `alpine:3.23` | 用于轻量命令实验和 rootfs 观察 |
| PostgreSQL | `postgres:18` | 阶段二数据库能力延续 |
| Redis | `redis:8.2` | 阶段二缓存与限流能力延续 |
| kind | 当前稳定版 | 第 19 篇用于观察 Kubernetes 节点运行时 |
| kubectl | 与 kind 集群兼容 | 用于部署和查看探针工作负载 |

版本不是越新越好，而是要可解释、可复现、处于支持周期内。真实团队需要把这些基线写入 README、CI、镜像构建参数和发布说明。

## 4. 两档验收路径

### 4.1 主线验收

适合所有学习者，必须完成：

=== "Linux / macOS / WSL2"

    ```bash
    docker version
    docker compose version

    docker build -t todo-api:v0.1.0 .
    docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
    docker run --rm todo-api:v0.1.0 config-check

    docker compose config
    docker compose up -d
    docker compose ps
    curl -i http://127.0.0.1:8080/healthz
    docker compose logs --tail 80 api
    ```

=== "Windows PowerShell"

    ```powershell
    docker version
    docker compose version

    docker build -t todo-api:v0.1.0 .
    docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
    docker run --rm todo-api:v0.1.0 config-check

    docker compose config
    docker compose up -d
    docker compose ps
    curl.exe -i http://127.0.0.1:8080/healthz
    docker compose logs --tail 80 api
    ```

预期结果：

- Docker 和 Compose 命令可用。
- `todo-api:v0.1.0` 能构建成功。
- 镜像运行用户不是 root。
- `config-check` 能执行。
- `docker compose config` 能通过配置检查。
- `docker compose ps` 中 API、PostgreSQL、Redis 处于运行或健康状态。
- `/healthz` 返回 `200 OK`。

### 4.2 进阶验收

适合 Linux、WSL2 Ubuntu 或虚拟机环境：

```bash
docker history todo-api:v0.1.0
docker inspect todo-api:v0.1.0
docker network inspect todo-platform_default 2>/dev/null || true
docker volume ls

docker run --rm alpine:3.23 sh -c 'cat /etc/os-release; ps -o pid,ppid,comm'

kind create cluster --name todo-runtime
kind load docker-image todo-api:v0.1.0 --name todo-runtime
kubectl get nodes -o wide
```

如果你已经完成第 19 篇运行时探针实验，还应该能进入 kind 节点查看 CRI 层状态：

```bash
NODE="$(docker ps --filter name=todo-runtime-control-plane --format '{{.Names}}' | head -n 1)"
docker exec -it "$NODE" crictl ps
docker exec -it "$NODE" crictl images
docker exec -it "$NODE" crictl pods
```

进阶验收不要求在 macOS 原生 shell 或 Windows PowerShell 中手动模拟 namespace / cgroup。底层实验应放在 Linux 环境中完成。

## 5. Dockerfile 验收清单

检查你的 Dockerfile 是否满足：

- [ ] 使用多阶段构建，把编译阶段和运行阶段分开。
- [ ] 使用固定基础镜像标签，例如 `golang:1.26-bookworm`。
- [ ] 使用 `.dockerignore` 排除 `.git`、`.env`、日志、临时文件和本地构建产物。
- [ ] 先复制 `go.mod`、`go.sum`，再复制业务源码，提高缓存命中率。
- [ ] 构建阶段执行 `go test ./...` 或说明为什么放到 CI 中执行。
- [ ] 运行阶段不包含 Go 编译器、源码缓存和无关工具。
- [ ] 以非 root 用户运行。
- [ ] 使用 OCI Label 记录版本、commit、构建时间和仓库地址。
- [ ] 不把数据库密码、Redis 密码、JWT Secret 写入镜像。
- [ ] 能通过 `docker run --rm todo-api:v0.1.0 config-check` 验证基础配置。

## 6. Compose 验收清单

检查你的 `compose.yaml` 是否满足：

- [ ] 包含 `api`、`postgres`、`redis` 服务。
- [ ] PostgreSQL 和 Redis 使用数据卷持久化。
- [ ] API 通过服务名访问 `postgres:5432` 和 `redis:6379`。
- [ ] 敏感配置从环境变量或本地 `.env` 注入，且 `.env` 不提交到 Git。
- [ ] 使用健康检查或明确的启动顺序控制。
- [ ] API 只把需要给本机访问的端口映射到宿主机。
- [ ] `docker compose down` 不会误删生产数据。
- [ ] README 中说明启动、验证、查看日志和清理方式。

## 7. 排障复盘模板

在应用仓库创建 `docs/docker/stage-03-acceptance.md`，记录你的验收结果：

````markdown
# Stage 03 Docker Acceptance

## 基础信息

- 操作系统：
- Docker 版本：
- Docker Compose 版本：
- Go 镜像：
- Alpine 镜像：
- 项目路径：
- 验收日期：

## 构建记录

```text
docker build -t todo-api:v0.1.0 .:
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}':
docker run --rm todo-api:v0.1.0 config-check:
```

## Compose 运行记录

```text
docker compose config:
docker compose up -d:
docker compose ps:
curl /healthz:
```

## 容器原理观察

```text
docker history todo-api:v0.1.0:
docker inspect todo-api:v0.1.0:
docker network inspect:
docker volume ls:
```

## 运行时观察

```text
kind get clusters:
kubectl get nodes:
crictl ps:
crictl images:
```

## 排障复盘

1. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方式：

2. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方式：

3. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方式：
````

这份记录比单纯展示代码更有价值，因为真实工作中同事更关心你如何验证、如何定位问题、如何避免风险。

## 8. 常见验收失败

| 现象 | 常见原因 | 处理方式 |
|---|---|---|
| `docker build` 很慢 | 构建上下文过大，`.dockerignore` 不完整 | 查看 `load build context` 输出，排除 `.git`、日志、临时目录 |
| `go mod download` 失败 | 网络、代理或私有模块认证问题 | 配置 `GOPROXY`，确认私有仓库凭据不要写入镜像 |
| 容器启动后立即退出 | `ENTRYPOINT` / `CMD` 错误，配置缺失 | `docker logs`、`docker inspect` 查看退出码和命令 |
| API 连不上 PostgreSQL | DSN 使用 `127.0.0.1`，没有使用 Compose 服务名 | 容器间访问使用 `postgres:5432` |
| API 连不上 Redis | 密码、服务名、端口或网络不一致 | 对照 `compose.yaml` 和应用环境变量 |
| `curl /healthz` 失败 | API 未启动、端口未映射、监听地址错误 | 检查 `docker compose ps`、`logs`、`ss`、端口映射 |
| 数据重启后丢失 | 数据库没有挂载数据卷 | 使用 named volume，避免把数据库数据只放容器层 |
| `docker ps` 看不到 Pod 容器 | Kubernetes 节点使用 containerd，不由宿主机 Docker 管理 | 进入 kind 节点使用 `crictl ps` |

## 9. 生产环境红线

阶段三虽然以本地实验为主，但必须从现在建立生产红线：

- 不提交 `.env`、私钥、Token、数据库密码、Redis 密码、JWT Secret。
- 不在生产镜像中保留源码、构建缓存、测试数据和调试密钥。
- 不让业务容器默认使用 root 用户运行。
- 不把 `latest` 当作生产部署的唯一镜像标签。
- 不把宿主机敏感目录挂载进容器。
- 不在生产中随意执行 `docker system prune -a --volumes`。
- 不在生产节点手动删除 containerd、CRI 或 Kubernetes 管理的容器。
- 不把 Docker Compose 当作生产 Kubernetes 的替代品。
- 不绕过镜像扫描、准入控制、资源限制和发布审批。

## 10. 面试复盘题

完成阶段三后，建议用这些问题做自测：

1. 镜像和容器的区别是什么？
2. 为什么生产环境不建议只使用 `latest`？
3. `.dockerignore` 解决什么问题？
4. Dockerfile 多阶段构建为什么适合 Go 服务？
5. 为什么容器内服务通常要监听 `0.0.0.0`？
6. Docker bridge 网络中容器为什么可以用服务名互相访问？
7. 数据库容器为什么需要 volume？
8. `ENTRYPOINT` 和 `CMD` 有什么区别？
9. 非 root 容器能降低哪些风险？不能解决哪些风险？
10. Compose 中 `depends_on` 和健康检查分别解决什么问题？
11. namespace 和 cgroups 分别解决什么问题？
12. 镜像分层和容器可写层的关系是什么？
13. Docker、containerd、runc、CRI、kubelet 的调用关系是什么？
14. 为什么 Kubernetes 1.24 之后不再内置 dockershim？
15. 你会如何向面试官介绍 Todo Platform 的容器化成果？

## 11. 下一阶段衔接

阶段三完成后，Todo Platform 已经具备容器化交付基础。进入阶段四 Kubernetes 前，请确认：

- Todo API 镜像可以独立构建和运行。
- Compose 能启动完整本地依赖环境。
- 你能解释容器网络、数据卷、端口映射和健康检查。
- 你能区分 Docker 开发体验和 Kubernetes 节点运行时。
- 你知道 Pod 容器最终会由 kubelet 通过 CRI 交给 containerd / runc 启动。

下一阶段会把这些成果迁移到 Kubernetes：Deployment、Service、ConfigMap、Secret、Ingress、PVC、HPA、Helm 和 Kustomize 都会建立在阶段三的镜像与容器运行基础之上。
