# 阶段三附录 B：Docker 命令速查与排障手册

本附录用于阶段三复习和实战排障。它不是替代第 15-19 篇正文，而是把高频命令、判断路径、安全边界和运行时观察方法整理成一张工作台。

建议你完成阶段三后至少通读一遍，并在 Todo Platform 应用仓库中保留一份自己的排障记录。

## 1. 排障总原则

容器问题不要从“换一个命令试试”开始，而要先判断问题在哪一层：

| 层次 | 优先问题 | 常用命令 |
|---|---|---|
| 客户端 | Docker CLI 是否连接到正确 daemon | `docker context ls`、`docker version` |
| 镜像 | 镜像是否存在、标签是否正确、架构是否匹配 | `docker image ls`、`docker image inspect` |
| 构建 | Dockerfile、上下文、缓存、依赖下载是否正常 | `docker build --no-cache`、`docker history` |
| 容器 | 容器是否运行、退出码是什么、日志有什么 | `docker ps -a`、`docker logs`、`docker inspect` |
| 网络 | 端口是否映射、容器间 DNS 是否正常 | `docker port`、`docker network inspect` |
| 数据 | volume 是否挂载、数据是否写入预期路径 | `docker volume ls`、`docker inspect` |
| Compose | 服务依赖、环境变量、健康检查是否正确 | `docker compose config`、`docker compose ps` |
| 运行时 | Kubernetes 节点是否由 containerd 管理 | `crictl ps`、`ctr containers ls` |

## 2. 环境检查速查

=== "Linux / macOS / WSL2"

    ```bash
    docker version
    docker info
    docker context ls
    docker compose version
    docker buildx version
    docker system df
    ```

=== "Windows PowerShell"

    ```powershell
    docker version
    docker info
    docker context ls
    docker compose version
    docker buildx version
    docker system df
    ```

重点看：

- `Server` 是否存在。只有 `Client` 没有 `Server`，说明 Docker daemon 没有连接上。
- `Operating System` 和 `Architecture` 是否符合预期。
- `Context` 是否指向当前要使用的 Docker Desktop、WSL2 或远程 daemon。
- `Docker Root Dir` 可以帮助判断镜像和容器数据实际存放位置。

## 3. 镜像命令速查

```bash
docker pull alpine:3.23
docker pull golang:1.26-bookworm
docker image ls
docker image inspect todo-api:v0.1.0
docker history todo-api:v0.1.0
docker image rm todo-api:v0.1.0
```

常见判断：

| 你看到的现象 | 判断方向 |
|---|---|
| `pull access denied` | 镜像名错误、仓库私有、未登录 |
| `no matching manifest` | 当前平台架构没有对应镜像 |
| 镜像体积异常大 | 可能把源码、缓存、日志或测试数据打进镜像 |
| `docker history` 有敏感命令 | 可能在构建层泄露了密钥或 token |

## 4. 构建排障速查

基础构建：

```bash
docker build -t todo-api:v0.1.0 .
```

查看更详细构建输出：

```bash
docker build --progress=plain -t todo-api:v0.1.0 .
```

绕过缓存排查：

```bash
docker build --no-cache -t todo-api:v0.1.0 .
```

传入版本参数：

```bash
docker build \
  --build-arg VERSION=v0.1.0 \
  --build-arg COMMIT="$(git rev-parse --short HEAD)" \
  -t todo-api:v0.1.0 .
```

Windows PowerShell 写法：

```powershell
docker build `
  --build-arg VERSION=v0.1.0 `
  --build-arg COMMIT="$(git rev-parse --short HEAD)" `
  -t todo-api:v0.1.0 .
```

构建失败时先看三处：

- `load build context` 是否异常大。
- 失败发生在 `go mod download`、`go test`、`go build` 还是 `COPY`。
- Dockerfile 中路径是否和项目目录一致。

## 5. 容器生命周期速查

```bash
docker run --name todo-api -d todo-api:v0.1.0
docker ps
docker ps -a
docker logs --tail 100 todo-api
docker logs -f todo-api
docker exec -it todo-api sh
docker stop todo-api
docker start todo-api
docker restart todo-api
docker rm todo-api
```

!!! note "distroless 镜像不能直接 exec shell"
    如果运行镜像使用 distroless 或 scratch，容器里通常没有 `sh`。这不是错误，而是安全设计。排障时应优先使用应用日志、健康接口、`docker inspect`、临时 debug 镜像或 Kubernetes ephemeral container。

查看退出码：

```bash
docker inspect todo-api --format '{{.State.Status}} {{.State.ExitCode}} {{.State.Error}}'
```

常见退出码：

| 退出码 | 常见含义 |
|---:|---|
| 0 | 程序正常结束，可能命令本来就是一次性任务 |
| 1 | 应用通用错误，重点看日志 |
| 125 | Docker daemon 或 `docker run` 参数错误 |
| 126 | 命令存在但不可执行 |
| 127 | 命令不存在或路径错误 |
| 137 | 常见于 OOM 或被 SIGKILL |

## 6. 端口与网络排障

查看端口映射：

```bash
docker port todo-api
docker inspect todo-api --format '{{json .NetworkSettings.Ports}}'
```

查看容器网络：

```bash
docker network ls
docker network inspect todo-net
docker inspect todo-api --format '{{json .NetworkSettings.Networks}}'
```

在同一 Docker 网络中测试 DNS：

```bash
docker run --rm --network todo-net alpine:3.23 nslookup todo-postgres
docker run --rm --network todo-net alpine:3.23 nslookup todo-redis
```

常见现象：

| 现象 | 优先判断 | 修复方向 |
|---|---|---|
| `Connection refused` | 目标端口没有监听或服务拒绝连接 | 看容器日志、端口映射、应用监听地址 |
| `Connection timed out` | 网络链路不通或被防火墙阻断 | 看网络、路由、防火墙、安全组 |
| 宿主机能访问，容器不能访问 | 容器网络或服务名错误 | 使用同一 Docker network 和服务名 |
| 容器能访问，宿主机不能访问 | 没有发布端口或绑定地址错误 | 检查 `-p` / `ports` 和应用监听地址 |

!!! warning "不要随意暴露管理端口"
    本地实验可以把 API 端口映射到 `127.0.0.1`。生产环境中，数据库、Redis、管理端口不应直接暴露到公网。

## 7. 数据卷排障

查看 volume：

```bash
docker volume ls
docker volume inspect todo-postgres-data
docker inspect todo-postgres --format '{{json .Mounts}}'
```

判断数据是否持久化：

```bash
docker exec -it todo-postgres psql -U todo -d todo_platform -c '\dt'
docker stop todo-postgres
docker start todo-postgres
docker exec -it todo-postgres psql -U todo -d todo_platform -c '\dt'
```

!!! warning "谨慎删除 volume"
    `docker compose down -v`、`docker volume rm`、`docker system prune --volumes` 会删除数据卷。生产和共享环境中执行前必须确认影响范围和备份。

## 8. Compose 速查

配置检查：

```bash
docker compose config
```

启动和查看：

```bash
docker compose up -d
docker compose ps
docker compose logs --tail 100
docker compose logs -f api
```

重建单个服务：

```bash
docker compose up -d --build api
```

进入服务容器：

```bash
docker compose exec postgres psql -U todo -d todo_platform
docker compose exec redis redis-cli -a todo_redis_password PING
```

停止和清理：

```bash
docker compose stop
docker compose down
```

只有确认要删除数据时才执行：

```bash
docker compose down -v
```

Compose 排障优先顺序：

1. `docker compose config` 确认 YAML 和变量渲染结果。
2. `docker compose ps` 确认服务状态和健康检查。
3. `docker compose logs <service>` 看应用错误。
4. `docker compose exec <service>` 进入依赖服务验证账号、库名、密码和网络。

## 9. 容器原理观察速查

观察进程模型：

```bash
docker run --rm alpine:3.23 sh -c 'echo "hostname=$(hostname)"; ps -o pid,ppid,comm; cat /proc/1/cgroup'
```

观察资源限制：

```bash
docker run --rm --memory=64m --cpus=0.5 alpine:3.23 sh -c 'cat /proc/self/cgroup; echo ok'
```

观察镜像层：

```bash
docker history todo-api:v0.1.0
docker image inspect todo-api:v0.1.0 --format '{{json .RootFS.Layers}}'
```

进入已有容器的 namespace：

```bash
docker run -d --name nsenter-demo alpine:3.23 sleep 1d
PID="$(docker inspect -f '{{.State.Pid}}' nsenter-demo)"
sudo nsenter -t "$PID" -p -m -u -i -n sh
```

这些命令只适合学习机或虚拟机。生产环境观察 namespace 时要遵守变更和审计流程。

## 10. 运行时与 CRI 速查

查看 kind 节点：

```bash
kind get clusters
docker ps --filter name=kind
```

进入 kind 节点观察 CRI：

```bash
NODE="$(docker ps --filter name=kind-control-plane --format '{{.Names}}' | head -n 1)"
docker exec -it "$NODE" crictl ps
docker exec -it "$NODE" crictl pods
docker exec -it "$NODE" crictl images
```

查看 containerd namespace：

```bash
docker exec -it "$NODE" ctr namespaces ls
docker exec -it "$NODE" ctr -n k8s.io containers ls
docker exec -it "$NODE" ctr -n k8s.io tasks ls
```

常见判断：

| 现象 | 判断方向 |
|---|---|
| 宿主机 `docker ps` 看不到 Pod 容器 | Pod 容器由 kind 节点内部 containerd 管理 |
| `crictl ps` 为空 | 可能没有进入正确节点，或 Pod 还未创建 |
| `crictl images` 没有镜像 | 镜像没有加载到 kind 节点 |
| `ImagePullBackOff` | 镜像名、标签、仓库认证或网络问题 |
| `CrashLoopBackOff` | 容器启动后退出，重点看 `kubectl logs` 和 `crictl logs` |

## 11. 安全速查

镜像安全检查：

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
docker history todo-api:v0.1.0
```

如果安装了扫描工具：

```bash
trivy image todo-api:v0.1.0
docker scout cves todo-api:v0.1.0
```

最小安全基线：

- 固定基础镜像版本，不使用不受控的 `latest`。
- 使用非 root 用户。
- 不把密钥写入 Dockerfile、镜像层、构建参数和日志。
- 镜像构建完成后做漏洞扫描。
- 容器只暴露必要端口。
- 数据库和 Redis 不直接暴露公网。
- 生产中使用资源限制、只读文件系统、最小 capabilities 和安全上下文。

## 12. 清理命令速查

清理指定实验容器：

```bash
docker rm -f todo-api todo-postgres todo-redis 2>/dev/null || true
```

清理指定网络：

```bash
docker network rm todo-net 2>/dev/null || true
```

查看磁盘占用：

```bash
docker system df
```

谨慎清理未使用资源：

```bash
docker system prune
```

!!! warning "不要把 prune 当作默认排障手段"
    `docker system prune -a --volumes` 会删除未使用镜像、构建缓存和数据卷。它可能让你丢失本地数据库数据，也可能影响同事或 CI runner 的缓存。

## 13. 排障记录模板

遇到问题时，用下面格式记录：

```text
现象：
影响范围：
当前环境：
已确认：
尚未确认：
定位命令：
关键输出：
根因判断：
修复方式：
复盘改进：
```

一个好的排障记录应该能让同事快速知道：你已经排除了哪些方向，当前证据指向哪里，下一步应该做什么。

## 14. 面试速记

阶段三面试回答要避免只背定义。建议按照“是什么 -> 为什么 -> 怎么排障 -> 生产注意事项”回答。

示例：

```text
Dockerfile 多阶段构建是什么？

它把编译环境和运行环境拆成多个 stage。Go 服务可以在 golang 镜像中下载依赖、运行测试、编译二进制，然后只把二进制和必要配置复制到 distroless 或 slim 运行镜像。

这样能减少镜像体积、降低漏洞面、避免把源码和构建缓存带到生产镜像。排障时我会看 docker build 输出、docker history、docker image inspect 和镜像扫描结果。生产里还要固定基础镜像版本、使用非 root、记录 OCI labels，并通过 CI 统一构建和扫描。
```

如果你能把阶段三每个核心问题都按这个结构讲清楚，就已经具备进入 Kubernetes 阶段的容器基础。
