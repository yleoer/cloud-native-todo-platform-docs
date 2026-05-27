# 完整课程目录

综合项目主线：**Cloud Native Todo Platform 云原生 Todo 平台**

> **配套设计文档**：[00 章节写作规范](00-chapter-writing-standard.md) | [01 课程蓝图](01-course-blueprint.md) | [03 项目主线设计](03-project-mainline-cloud-native-todo-platform.md)

最终形成：

- Go Todo API 服务
- PostgreSQL 数据库
- Redis 缓存与限流
- Docker 镜像与 Docker Compose 本地环境
- Kubernetes 部署清单
- Helm 4 Chart 与 Kustomize 多环境配置
- CI/CD 与 GitOps 发布链路
- Prometheus、Grafana、Loki / ELK、Tracing 可观测体系
- 自定义 CRD、手写 Controller、Kubebuilder Operator

课程共 **42 大篇，约 230 章**。

> **标注说明**：章标题后标注"了解"的为认知性内容，不要求动手；标注"选修"的为扩展内容，可按需跳过。

---

## 项目版本演进路线

学习者在每篇完成一个可独立验收的项目版本，逐步构建完整平台：

```
Todo CLI（篇 7）
  │  内存存储，理解 Go 基本语法
  ↓
Todo API v1（篇 9，net/http 标准库）
  │  理解 HTTP 协议与 Handler 模型
  ↓
Todo API v2（篇 10，Gin 框架）
  │  理解 Web 框架与 RESTful 设计
  ↓
Todo API v3（篇 12，PostgreSQL）
  │  数据持久化与事务
  ↓
Todo API v4（篇 13，Redis）
  │  缓存、限流、异步任务
  ↓
Todo API v5（篇 14，生产化）
  │  JWT + 结构化日志 + 配置分层 + 优雅关闭
  ↓
Todo Platform 容器化（篇 15-19）
  │  Dockerfile + Compose + 容器原理 + OCI
  ↓
Todo Platform on Kubernetes（篇 20-28）
  │  部署 + 服务暴露 + 配置 + 存储 + 网络原理 + 安全 + Helm + Kustomize
  ↓
Todo Platform 生产体系（篇 29-33）
  │  CI/CD + GitOps + 监控 + 日志/链路追踪 + 排障
  ↓
Todo Operator（篇 34-42）
  │  CRD → 手写 Controller → Kubebuilder → Webhook/Finalizer → 生产实践
```

每个版本可独立运行、独立验收，代码在同一 git 仓库中按目录组织。

---

## 第一阶段：基础能力

**阶段目标**：建立完整学习地图，掌握 Linux、Git、Shell 和网络排障能力，准备后续开发环境。

**建议周期**：4 周

---

### 第 1 篇：课程导学与开发环境准备 [A]

**大篇学习目标**

建立完整学习地图，理解课程项目演进路线，准备 Go、Docker、Kubernetes、Operator 开发所需环境，掌握 YAML 语法基础。

**章节列表**

- 1.1 课程目标、岗位路线与综合项目介绍
- 1.2 YAML 语法基础（缩进、多文档、锚点与别名）
- 1.3 Ubuntu 24.04 统一学习环境
- 1.4 终端、PATH、Docker Engine 与 kubeconfig
- 1.5 安装 Go、Git、Docker、kubectl、kind、Helm
- 1.6 版本环境锁定与 `check-env.sh` 检查脚本

**本篇特色项目**

搭建统一实验环境，初始化 `cloud-native-todo-platform` 仓库，运行环境检查脚本确认所有工具版本一致。

**本篇能力验收标准**

能独立完成开发环境安装，能阅读和编写基础 YAML，能运行 Go、Git、Docker、kubectl、kind、Helm 基础命令并通过版本检查。

---

### 第 2 篇：Linux 文件系统与命令基础 [A]

**大篇学习目标**

掌握后端开发和云原生运维中最常用的 Linux 文件、目录、权限和文本处理能力。

**章节列表**

- 2.1 Linux 目录结构与路径规则
- 2.2 文件与目录操作命令
- 2.3 用户、用户组与文件权限
- 2.4 文本查看、搜索与处理命令
- 2.5 压缩、解压、软链接与环境变量

**本篇特色项目**

搭建 Todo 平台服务器目录结构，创建日志、配置、数据目录并设置权限。

**本篇能力验收标准**

能熟练使用 `ls`、`cd`、`cp`、`mv`、`rm`、`cat`、`less`、`grep`、`find`、`chmod`、`chown`。

---

### 第 3 篇：Linux 进程、服务与软件管理 [A]

**大篇学习目标**

理解程序在 Linux 上如何运行、如何被管理、如何排查资源问题。

**章节列表**

- 3.1 进程、PID、前台与后台任务
- 3.2 `ps`、`top`、`htop`、`kill` 排查进程
- 3.3 systemd 与服务管理
- 3.4 软件包管理：apt、yum、dnf
- 3.5 CPU、内存、磁盘基础排查

**本篇特色项目**

将一个简单 Go HTTP 程序注册为 Linux systemd 服务。

**本篇能力验收标准**

能启动、停止、查看服务状态，能定位进程占用 CPU、内存、端口的问题。

---

### 第 4 篇：Linux 网络基础与排障 [A]

**大篇学习目标**

系统理解后端服务访问链路，为后续 Go Web 开发、Docker、Kubernetes 网络打基础。

**章节列表**

- 4.1 TCP/IP、端口、DNS 基础
- 4.2 HTTP 协议结构化讲解（请求/响应/方法/状态码/Header/Body）
- 4.3 `ip`、`ss`、`netstat`、`ping` 使用
- 4.4 `curl`、`wget`、`dig`、`nslookup` 排查访问问题
- 4.5 防火墙、监听地址与端口冲突
- 4.6 tcpdump 抓包入门

**本篇特色项目**

编写并排查一个本地 Todo HTTP 服务访问链路，用 curl 构造请求、用 tcpdump 观察数据包。

**本篇能力验收标准**

能判断服务是否启动、端口是否监听、DNS 是否正常、HTTP 请求是否成功，能用 tcpdump 抓取 HTTP 请求。

---

### 第 5 篇：Git 基础与团队协作 [A]

**大篇学习目标**

掌握企业开发中代码版本管理、分支协作和冲突解决能力。

**章节列表**

- 5.1 Git 仓库、提交与历史记录
- 5.2 分支、合并、rebase 与冲突解决
- 5.3 GitHub / GitLab 远程仓库与 Pull Request 工作流
- 5.4 tag、stash 与版本发布

**本篇特色项目**

为课程项目建立 Git 分支模型和提交规范，完成一次完整的 PR 工作流演练。

**本篇能力验收标准**

能完成分支开发、代码提交、冲突解决、远程推送和 PR 合并。

---

### 第 6 篇：Shell 脚本与自动化基础 [A]

**大篇学习目标**

能编写常见自动化脚本，提高开发、构建、部署、排障效率。

**章节列表**

- 6.1 Shell 变量、参数、退出码与条件判断
- 6.2 循环、函数、文件处理与管道
- 6.3 编写项目启动、健康检查和清理脚本
- 6.4 Shell 脚本常见问题与环境变量管理

**本篇特色项目**

为 Todo 平台编写 `dev.sh`、`check.sh`、`clean.sh` 脚本，实现一键启动/检查/清理。

**本篇能力验收标准**

能写出可复用 Shell 脚本，能通过退出码判断脚本执行结果，能管理 `.env` 环境变量。

---

## 第二阶段：Go 后端开发

**阶段目标**：从 Go 语法入门到交付一个生产风格的 Todo API 服务，涵盖 HTTP、数据库、缓存、鉴权、日志、测试。

**建议周期**：8 周

---

### 第 7 篇：Go 语言基础 [C]

**大篇学习目标**

掌握 Go 基础语法，为后续后端服务开发打基础。

**章节列表**

- 7.1 Go 程序结构、变量、常量与类型
- 7.2 条件、循环、数组、切片与 map
- 7.3 函数、指针、结构体与方法
- 7.4 interface、error 与 defer
- 7.5 Go module 与包管理（含 replace、vendor、indirect 依赖）

**本篇特色项目**

开发命令行版 Todo 管理器 `todo-cli`，支持增删改查，内存存储。

**本篇能力验收标准**

能使用 Go 编写结构清晰的 CLI 程序，能使用 go mod 管理依赖。

---

### 第 8 篇：Go 工程化与测试 [C]

**大篇学习目标**

建立生产级 Go 项目结构、配置、日志、测试和质量管理能力。

**章节列表**

- 8.1 Go 项目目录结构设计
- 8.2 配置管理、环境变量与配置文件
- 8.3 结构化日志与错误处理规范
- 8.4 单元测试、表驱动测试与 Mock
- 8.5 集成测试、覆盖率与 Benchmark

**本篇特色项目**

搭建 Todo 平台后端工程骨架，编写首个单元测试。

**本篇能力验收标准**

能组织清晰的 Go 后端项目结构，能编写单元测试和基础集成测试。

---

### 第 9 篇：Go net/http 标准库与 HTTP 服务 [C]

**大篇学习目标**

使用 Go 标准库 net/http 理解 HTTP 服务底层模型，为后续学习 Gin 框架打下扎实基础。

**章节列表**

- 9.1 Handler 接口、ServeMux 与请求多路复用
- 9.2 Request 解析（URL 参数、Header、Body）与 ResponseWriter
- 9.3 JSON 序列化、请求绑定与基础参数校验
- 9.4 中间件模式：请求日志、恢复 panic、链路追踪

**本篇特色项目**

用 net/http 标准库实现 Todo API v1（内存存储），包含 CRUD 接口和基础中间件。

**本篇能力验收标准**

能使用 net/http 标准库独立开发 HTTP API 服务，能解释 Handler 和 ServeMux 的工作原理。

---

### 第 10 篇：Go Web API 开发——Gin 框架 [C]

**大篇学习目标**

掌握使用 Gin 框架高效开发 RESTful API 服务，理解框架与标准库的关系。

**章节列表**

- 10.1 Gin 与 net/http 的关系：框架省掉了什么
- 10.2 路由组、中间件与请求绑定
- 10.3 RESTful API 设计与统一响应格式
- 10.4 参数校验、错误码与异常处理
- 10.5 健康检查、优雅关闭与 OpenAPI 文档生成

**本篇特色项目**

用 Gin 重构 Todo API v2，对比标准库版本理解框架价值。

**本篇能力验收标准**

能独立开发一个可运行、可测试、可维护的 Gin Web API 服务，能生成 API 文档。

---

### 第 11 篇：Go 并发编程 [C]

**大篇学习目标**

以 HTTP 服务的并发请求处理为场景，掌握 goroutine、channel、context 和同步原语。

**章节列表**

- 11.1 goroutine 与并发执行：HTTP Server 的每请求一个 goroutine
- 11.2 channel 通信模型（无缓冲/有缓冲/select 多路复用）
- 11.3 context 超时、取消与 HTTP 请求链路传递
- 11.4 sync 包：Mutex、RWMutex、WaitGroup、Once
- 11.5 并发安全、竞态检测（`go test -race`）与限流思想
- 11.6 HTTP Server 中的并发模式实战（优雅关闭、连接池、worker pool）

**本篇特色项目**

开发并发 Todo 统计任务执行器，支持超时取消、并发数控制；对 Todo API 做并发压测并分析竞态问题。

**本篇能力验收标准**

能正确使用 goroutine、channel、context，能避免常见并发泄漏和数据竞争，能对 HTTP 服务做并发压测。

---

### 第 12 篇：数据库与持久化开发 [C]

**大篇学习目标**

掌握关系型数据库建模、SQL、事务和 Go 数据库访问能力。

**章节列表**

- 12.1 PostgreSQL 基础与表设计
- 12.2 SQL CRUD、索引与查询优化入门
- 12.3 Go 访问数据库：database/sql、GORM、sqlc 对比
- 12.4 事务、隔离级别与数据一致性
- 12.5 数据库迁移与版本管理

**本篇特色项目**

为 Todo API v3 接入 PostgreSQL 持久化，编写迁移脚本和事务逻辑。

**本篇能力验收标准**

能设计 Todo 表结构，能完成数据库迁移、事务处理和基础查询优化。

---

### 第 13 篇：Redis、缓存与异步任务 [C]

**大篇学习目标**

掌握 Redis 常见数据结构、缓存模式、限流和简单异步任务处理。

**章节列表**

- 13.1 Redis 安装、数据类型与常用命令
- 13.2 Go 操作 Redis
- 13.3 缓存穿透、击穿、雪崩与解决方案
- 13.4 分布式锁、计数器与接口限流
- 13.5 简单任务队列与异步处理模型

**本篇特色项目**

为 Todo API v4 增加缓存、接口限流和异步统计任务。

**本篇能力验收标准**

能合理使用 Redis 解决缓存、限流、锁和队列类问题，并能说明风险和适用边界。

---

### 第 14 篇：Go 后端生产化能力 [C]

**大篇学习目标**

补齐真实公司后端服务需要的认证、安全、配置、日志、性能分析和运行能力。

**章节列表**

- 14.1 JWT 鉴权与用户登录
- 14.2 中间件链路、请求 ID 与审计日志
- 14.3 参数校验、安全响应与敏感信息保护
- 14.4 配置分层：dev、test、prod
- 14.5 CORS、Rate Limiting 与安全 Header
- 14.6 服务启动、优雅关闭与运维命令设计
- 14.7 Go pprof 性能分析入门（CPU profile、heap profile、goroutine profile）

**本篇特色项目**

将 Todo 平台升级为 Todo API v5 生产风格 API 服务。

**本篇能力验收标准**

能实现认证、日志、配置分层、健康检查、优雅关闭和基础性能分析。

---

### 阶段二复习节点：Go 后端开发能力检验

在进入容器化阶段之前，请逐项确认以下里程碑：

- [ ] Todo CLI 可独立运行，支持命令行增删改查（篇 7）
- [ ] 项目工程结构清晰，`go test ./...` 全部通过（篇 8）
- [ ] 能分别用 net/http 标准库和 Gin 框架实现 Todo CRUD，能对比两者差异（篇 9-10）
- [ ] 并发统计任务通过 `go test -race` 无竞态（篇 11）
- [ ] Todo API v5 完整可用：PostgreSQL 持久化 + Redis 缓存/限流 + JWT 鉴权 + 结构化日志 + 优雅关闭 + pprof（篇 12-14）

**阶段产物**：Todo API v5 —— 一个具备生产风格的 Go 后端服务，可直接作为后续容器化的原材料。

---

## 第三阶段：容器化能力

**阶段目标**：掌握 Docker 镜像构建、多服务编排、容器底层原理和 OCI 运行时生态。

**建议周期**：4 周

---

### 第 15 篇：Docker 基础 [A]

**大篇学习目标**

掌握 Docker 镜像、容器、网络、数据卷的基本使用方式。

**章节列表**

- 15.1 Docker 解决什么问题
- 15.2 镜像、容器、仓库与常用命令
- 15.3 容器生命周期与日志查看
- 15.4 Docker 数据卷与端口映射
- 15.5 Docker 网络基础

**本篇特色项目**

使用 Docker 运行 Todo API、PostgreSQL、Redis，验证容器间网络通信。

**本篇能力验收标准**

能构建、启动、停止、查看、进入、删除容器，能排查基础容器运行问题。

---

### 第 16 篇：Dockerfile 与镜像构建 [C]

**大篇学习目标**

掌握生产级 Dockerfile 编写、镜像优化、安全实践和调试工具。

**章节列表**

- 16.1 Dockerfile 指令详解
- 16.2 Go 服务多阶段构建
- 16.3 镜像缓存、构建上下文与 `.dockerignore`
- 16.4 非 root 用户、最小镜像与安全扫描
- 16.5 镜像版本、标签和推送仓库
- 16.6 镜像调试与优化工具（dive 分析镜像层、hadolint 检查 Dockerfile、trivy 漏洞扫描）

**本篇特色项目**

为 Todo 平台构建安全、小体积、可发布的 Go 服务镜像。

**本篇能力验收标准**

能写出生产可用 Dockerfile，能使用工具分析和优化镜像体积与安全性。

---

### 第 17 篇：Docker Compose 本地编排 [C]

**大篇学习目标**

掌握多服务本地开发环境编排能力。

**章节列表**

- 17.1 Compose 文件结构与服务定义
- 17.2 API、PostgreSQL、Redis 多容器编排
- 17.3 环境变量、数据卷、网络与依赖关系
- 17.4 本地开发、测试、调试工作流
- 17.5 Compose 常见故障排查

**本篇特色项目**

一条命令启动 Todo Platform 完整本地环境（API + PostgreSQL + Redis + Traefik）。

**本篇能力验收标准**

能使用 Docker Compose 管理多服务开发环境，并能处理启动顺序、配置和数据持久化问题。

---

### 第 18 篇：容器运行原理 [B]

**大篇学习目标**

理解容器不是虚拟机，掌握 Namespace、Cgroups、UnionFS 等底层机制。

**章节列表**

- 18.1 容器与虚拟机的本质区别
- 18.2 Linux Namespace：进程、网络、挂载隔离
- 18.3 Cgroups：CPU、内存、IO 资源限制
- 18.4 UnionFS 与镜像分层原理
- 18.5 手动模拟一个简化容器

**本篇特色项目**

用 Linux 命令（unshare、nsenter、cgcreate）手动模拟容器隔离与资源限制。

**本篇能力验收标准**

能解释容器隔离、资源限制、镜像分层和容器进程模型。

---

### 第 19 篇：OCI、containerd、runc 与 CRI [B]

**大篇学习目标**

理解 Kubernetes 底层如何调用容器运行时，理清 Docker、containerd、runc 的关系。

**章节列表**

- 19.1 OCI 规范与镜像格式（image-spec、runtime-spec）
- 19.2 runc 与低层容器运行
- 19.3 containerd、shim 与容器生命周期
- 19.4 CRI、crictl 与 Kubernetes 运行时接口
- 19.5 Docker、containerd、nerdctl、cri-o 的关系与演进

**本篇特色项目**

使用 `nerdctl` 和 `crictl` 观察 Todo 平台容器运行状态，对比 Docker 命令与 nerdctl 命令的对应关系。

**本篇能力验收标准**

能说明 Docker、containerd、runc、CRI、Kubernetes 之间的调用关系，能用 crictl 排查容器运行时问题。

---

## 第四阶段：Kubernetes 应用交付

**阶段目标**：从集群搭建开始，逐步掌握工作负载、服务暴露、配置、存储、网络原理、安全、Helm 4 和 Kustomize。

**建议周期**：8 周

---

### 第 20 篇：Kubernetes 架构与集群搭建 [A]

**大篇学习目标**

建立 Kubernetes 整体架构认知，搭建可实验的本地集群。

**章节列表**

- 20.1 Kubernetes 解决什么问题：声明式 vs 命令式
- 20.2 控制面组件：apiserver、scheduler、controller-manager、etcd
- 20.3 Node 组件：kubelet、kube-proxy、容器运行时
- 20.4 使用 kind 搭建本地集群
- 20.5 kubectl、kubeconfig 与资源操作基础

**本篇特色项目**

搭建本地 Kubernetes 集群并部署第一个测试应用。

**本篇能力验收标准**

能描述 Kubernetes 核心组件职责，能使用 kubectl 操作集群资源，能解释声明式 API 与命令式操作的区别。

---

### 第 21 篇：Kubernetes 核心工作负载 [C]

**大篇学习目标**

掌握 Pod、Deployment、ReplicaSet、Job、CronJob、DaemonSet 等核心工作负载对象。

**章节列表**

- 21.1 Pod 生命周期与容器状态
- 21.2 Deployment、ReplicaSet 与滚动更新
- 21.3 Job、CronJob 与批处理任务
- 21.4 DaemonSet 与节点级服务
- 21.5 Probe（liveness/readiness/startup）、Resource Request/Limit 与 HPA 基础

**本篇特色项目**

将 Todo API 部署为 Kubernetes Deployment，配置存活探针和就绪探针，验证滚动更新和回滚。

**本篇能力验收标准**

能部署、更新、回滚服务，能配置探针和资源限制，能解释 Pod 状态转换。

---

### 第 22 篇：Service、Ingress 与流量入口 [C]

**大篇学习目标**

掌握集群内外部服务暴露、HTTP 流量管理和 TLS 终止。

**章节列表**

- 22.1 Service 类型与服务发现
- 22.2 ClusterIP、NodePort、LoadBalancer 对比与选择
- 22.3 Ingress 资源与 Traefik Ingress Controller
- 22.4 Gateway API 入门（HTTPRoute、GatewayClass）
- 22.5 社区 Ingress NGINX 配置方式与迁移路径（了解）
- 22.6 TLS 证书基础与 HTTPS 终止

**本篇特色项目**

为 Todo Platform 配置 Service、Traefik Ingress 和 HTTPS 访问，同时对比 Gateway API 的配置方式。

**本篇能力验收标准**

能让集群内外通过 HTTPS 访问 Todo 服务，能解释 Ingress 和 Gateway API 的差异，了解存量集群的 Ingress NGINX 迁移方向。

---

### 第 23 篇：ConfigMap、Secret 与配置管理 [C]

**大篇学习目标**

掌握 Kubernetes 中的配置注入、密钥管理和多环境配置策略。

**章节列表**

- 23.1 ConfigMap 创建、挂载与热更新
- 23.2 Secret 类型、创建与使用（Opaque、TLS、dockerconfigjson）
- 23.3 多环境配置与应用启动参数
- 23.4 配置文件变更触发 Pod 重启策略
- 23.5 Secret 安全进阶：etcd 加密、外部 Secret 管理（Sealed Secrets）

**本篇特色项目**

将 Todo Platform 的 dev/test/prod 配置迁移到 ConfigMap 和 Secret，验证配置热更新。

**本篇能力验收标准**

能安全管理 Kubernetes 配置和密钥，能实现多环境配置差异化。

---

### 第 24 篇：Kubernetes 存储 [C]

**大篇学习目标**

掌握 Kubernetes 中有状态服务、数据卷和动态存储供应机制。

**章节列表**

- 24.1 Volume、PV、PVC 基础
- 24.2 StorageClass 与动态供给
- 24.3 StatefulSet 与稳定网络标识
- 24.4 PostgreSQL 在 Kubernetes 中的部署方式
- 24.5 数据备份、恢复与迁移注意事项

**本篇特色项目**

将 Todo Platform 数据库迁移到 Kubernetes PVC 持久化方案，验证 Pod 重建后数据完整性。

**本篇能力验收标准**

能使用 PVC 持久化数据，能说明有状态服务在 Kubernetes 中的风险和边界。

---

### 第 25 篇：Kubernetes 网络原理 [B]

**大篇学习目标**

系统理解 Kubernetes 网络模型、CNI、DNS、kube-proxy 和网络策略。

**章节列表**

- 25.1 Kubernetes 网络模型与 Pod IP 可达性
- 25.2 CNI 插件原理与常见实现（Calico、Flannel、Cilium 对比）
- 25.3 CoreDNS 与集群内服务发现
- 25.4 kube-proxy iptables 模式详解
- 25.5 kube-proxy IPVS 模式（了解·K8s 1.36 已移除，旧集群仍在使用）
- 25.6 NetworkPolicy 与服务间网络隔离

**本篇特色项目**

为 Todo Platform 设计网络访问路径和命名空间隔离策略，验证 NetworkPolicy 拒绝非授权流量。

**本篇能力验收标准**

能排查 Pod 到 Pod、Pod 到 Service、Ingress 到后端服务的网络问题，能配置 NetworkPolicy。

---

### 第 26 篇：Kubernetes 安全 [C]

**大篇学习目标**

掌握 Kubernetes 权限、安全上下文、镜像安全和集群安全基线。

**章节列表**

- 26.1 ServiceAccount 与 RBAC 模型
- 26.2 Role、ClusterRole、RoleBinding、ClusterRoleBinding 实战
- 26.3 SecurityContext 与非 root 容器
- 26.4 User Namespaces（`hostUsers: false`，K8s 1.36 GA）
- 26.5 Pod Security Standards（baseline/restricted）与最小权限原则
- 26.6 Secret 安全、镜像拉取密钥与私有仓库

**本篇特色项目**

为 Todo Platform 制定最小权限部署方案：专用 ServiceAccount、非 root 容器、Restricted Pod Security。

**本篇能力验收标准**

能配置 RBAC、非 root 容器、安全上下文和 Pod Security Standards。

---

### 第 27 篇：Helm 4 包管理 [C]

**大篇学习目标**

掌握 Helm 4 Chart 编写和 Kubernetes 应用打包发布能力。

**章节列表**

- 27.1 Helm 解决什么问题：模板化、版本化、可复用
- 27.2 Chart 目录结构与模板语法
- 27.3 values.yaml 与多环境参数化
- 27.4 Helm install、upgrade、rollback 与 release 记录
- 27.5 Chart 依赖（subchart）、版本管理和 OCI 仓库发布

**本篇特色项目**

将 Todo Platform 打包为 Helm 4 Chart，实现一条命令安装和升级。

**本篇能力验收标准**

能使用 Helm 4 安装、升级、回滚 Todo Platform，能管理 Chart 依赖和版本。

---

### 第 28 篇：Kustomize 多环境配置管理 [C]

**大篇学习目标**

掌握声明式补丁方式管理 dev、test、prod 环境差异。

**章节列表**

- 28.1 Kustomize 基础与 overlay 思想
- 28.2 base、overlay 与 patch 策略
- 28.3 ConfigMapGenerator 与 SecretGenerator
- 28.4 镜像版本替换与 Helm / Kustomize 使用边界

**本篇特色项目**

为 Todo Platform 建立 dev、test、prod 三套 Kustomize overlay 环境配置。

**本篇能力验收标准**

能使用 Kustomize 管理多环境部署，能解释 Kustomize 和 Helm 各自的适用场景。

---

### 阶段四复习节点：Kubernetes 应用交付能力检验

在进入生产工程化阶段之前，请逐项确认以下里程碑：

- [ ] kind 集群正常运行，能使用 kubectl 操作资源（篇 20）
- [ ] Todo Platform 以 Deployment + Service + Traefik Ingress + HTTPS 方式部署（篇 21-22）
- [ ] ConfigMap/Secret 管理 dev/test/prod 三套配置（篇 23）
- [ ] PostgreSQL 使用 PVC 持久化，Pod 重建后数据不丢失（篇 24）
- [ ] NetworkPolicy 生效，RBAC 最小权限 + 非 root 容器 + Pod Security Standards 达标（篇 25-26）
- [ ] Helm 4 Chart 可一键安装/升级/回滚（篇 27）
- [ ] Kustomize overlay 覆盖 dev/test/prod 三环境（篇 28）

**阶段产物**：Todo Platform on Kubernetes —— 一个多环境、安全加固、可交付的 K8s 应用。

---

## 第五阶段：生产工程能力

**阶段目标**：掌握 CI/CD 自动化、GitOps 交付、可观测性建设和生产排障。

**建议周期**：6 周

---

### 第 29 篇：CI/CD 自动化交付 [C]

**大篇学习目标**

掌握从代码提交到镜像构建、测试、发布的自动化流程。

**章节列表**

- 29.1 CI/CD 基本概念与流水线设计
- 29.2 GitHub Actions 基础（workflow、job、step、trigger）
- 29.3 自动执行 Go 测试（test）、代码检查（lint）、安全扫描（govulncheck）
- 29.4 自动构建并推送 Docker 镜像（多阶段构建 + 镜像标签策略）
- 29.5 自动部署到 Kubernetes 环境（更新 Deployment 镜像版本）

**本篇特色项目**

为 Todo Platform 建立完整 CI/CD 流水线：push 代码 → 自动测试 → 构建镜像 → 推送仓库 → 更新 K8s。

**本篇能力验收标准**

能实现提交代码后自动测试、构建镜像、推送仓库并触发部署。

---

### 第 30 篇：GitOps 与 Argo CD [C]

**大篇学习目标**

掌握声明式交付和 GitOps 运维模型。

**章节列表**

- 30.1 GitOps 的核心思想：Git 是唯一事实来源
- 30.2 Argo CD 安装与 Application 资源定义
- 30.3 Git 仓库作为部署事实来源的目录结构设计
- 30.4 自动同步、手动同步、回滚与配置漂移检测
- 30.5 多环境、多集群发布策略（ApplicationSet）

**本篇特色项目**

使用 Argo CD 管理 Todo Platform 的 dev 和 prod 两套 Kubernetes 环境发布。

**本篇能力验收标准**

能通过 Git 变更驱动 Kubernetes 应用发布，能处理同步失败和配置漂移，能使用 ApplicationSet 管理多环境。

---

### 第 31 篇：Prometheus 与 Grafana 监控 [C]

**大篇学习目标**

掌握指标采集、PromQL 查询、告警规则和可视化面板搭建。

**章节列表**

- 31.1 可观测性三大支柱与 RED/USE 指标体系设计
- 31.2 Prometheus 架构、ServiceMonitor 与抓取配置
- 31.3 Go 服务暴露业务指标（counter、gauge、histogram）
- 31.4 PromQL 实战（上）：瞬时向量、范围向量、聚合运算
- 31.5 PromQL 实战（下）：rate、histogram_quantile、recording rules 与 Grafana 面板

**本篇特色项目**

为 Todo Platform 建立 API 延迟（P50/P95/P99）、错误率、QPS、资源使用监控面板，配置 P95 延迟超过 500ms 的告警规则。

**本篇能力验收标准**

能接入 Prometheus 指标，能编写 PromQL 查询，能用 Grafana 搭建服务监控面板和配置告警。

---

### 第 32 篇：日志与 OpenTelemetry 链路追踪 [C]

**大篇学习目标**

掌握日志采集、查询分析和分布式链路追踪能力。

**章节列表**

- 32.1 日志规范与结构化日志
- 32.2 Loki、Promtail 与 Grafana 日志查询
- 32.3 ELK / EFK 架构与适用场景（了解）
- 32.4 OpenTelemetry 基础：Trace、Span、Context Propagation
- 32.5 Jaeger / Grafana Tempo 快速上手（了解）
- 32.6 日志、指标、链路追踪联合排障（通过 request_id 关联）

**本篇特色项目**

为 Todo Platform 接入 Loki 日志采集和 OpenTelemetry 请求链路追踪，快速部署 Jaeger 或 Grafana Tempo 查看 Trace 瀑布图，通过 request_id 在日志和 Trace 之间跳转排查一次慢请求。

**本篇能力验收标准**

能通过日志和 Trace 定位一次 API 请求的完整执行路径和耗时分布。

---

### 第 33 篇：Kubernetes 生产排障 [C]

**大篇学习目标**

掌握真实生产环境中 Kubernetes 常见故障的定位和修复方法。

**章节列表**

- 33.1 Pod Pending、CrashLoopBackOff、ImagePullBackOff 排查
- 33.2 OOMKilled、CPU Throttling 与资源瓶颈排查
- 33.3 Service 不通、DNS 解析失败、Ingress 502 排查
- 33.4 PVC 挂载失败、StorageClass 不匹配与存储故障排查
- 33.5 Kubernetes 调试工具链（k9s 交互式管理、stern 多 Pod 日志、kubectl debug 临时容器）

**本篇特色项目**

Todo Platform 故障注入与恢复演练：模拟 OOMKilled、DNS 中断、PVC 挂载失败，按照标准流程排查并修复。

**本篇能力验收标准**

能根据事件、日志、指标、资源状态定位 Kubernetes 常见生产故障，能熟练使用 k9s 和 stern。

---

## 第六阶段：平台工程与 Operator 能力

**阶段目标**：从理解 Kubernetes API 扩展机制开始，经手写 Controller 理解控制循环本质，再使用 Kubebuilder 开发生产级 Operator。

**建议周期**：8 周

---

### 第 34 篇：Kubernetes API 扩展机制 [B]

**大篇学习目标**

理解 Kubernetes 为什么能扩展，以及 CRD 和 Controller 的基础关系。

**章节列表**

- 34.1 Kubernetes API Machinery 基础：资源、版本、序列化
- 34.2 声明式 API 与控制循环：期望状态 vs 实际状态
- 34.3 Group、Version、Kind（GVK）与 Group、Version、Resource（GVR）
- 34.4 CRD 的作用和基本结构
- 34.5 自定义资源状态设计思想（spec 是输入，status 是输出）

**本篇特色项目**

设计 Todo 平台的 `TodoApp` 自定义资源模型（spec 描述期望的平台配置，status 反映实际运行状态）。

**本篇能力验收标准**

能解释 CRD、Controller、声明式 API 和状态回写的关系，能区分 GVK 和 GVR。

---

### 第 35 篇：CRD 设计与实践 [C]

**大篇学习目标**

掌握生产可用 CRD 的字段设计、版本管理和校验方式。

**章节列表**

- 35.1 CRD YAML 结构详解（group、scope、versions、schema）
- 35.2 OpenAPI Schema 与字段校验（required、pattern、enum、minimum/maximum）
- 35.3 spec、status 与 conditions 设计模式
- 35.4 CRD 版本升级（v1alpha1 → v1beta1 → v1）与兼容性
- 35.5 使用 kubectl 操作自定义资源（create、get、describe、edit、delete）

**本篇特色项目**

实现 `TodoApp`、`TodoDatabase`、`TodoCache` 三个 CRD，定义完整的 spec schema 和 status subresource。

**本篇能力验收标准**

能设计结构清晰、可演进、可校验的 CRD，能处理版本升级和字段废弃。

---

### 第 36 篇：Controller 机制——Informer 与 Workqueue [B]

**大篇学习目标**

深入理解 Kubernetes Controller 的核心运行机制。

**章节列表**

- 36.1 Controller 控制循环原理：从监听到调谐
- 36.2 List-Watch 与 Informer 缓存机制（SharedInformer、Lister）
- 36.3 Workqueue 类型与重试策略（限速队列、延迟队列）
- 36.4 Reconcile 思想与幂等设计：反复调谐直到期望状态
- 36.5 controller-runtime 基础抽象入门：Manager、Client、Scheme
- 36.6 Controller 常见问题：重复 Reconcile、热点资源、Finalizer 阻塞删除

**本篇特色项目**

分析 Todo Operator 的控制循环需求：需要 Watch 哪些资源、Reconcile 要做什么、需要哪些 Index。并用 Go 编写一个最小 Informer-Workqueue 模拟程序（不依赖 client-go），理解"事件入队→出队处理→幂等调谐"的简化流程。

**本篇能力验收标准**

能解释 Informer 缓存同步机制，能说明 Workqueue 如何防止重复和丢失，能设计幂等的 Reconcile 逻辑，能运行自己写的最小模拟程序并观察事件处理顺序。

---

### 第 37 篇：手写简化版 Controller [C]

**大篇学习目标**

不依赖 Kubebuilder，用 client-go 手写一个最小 Controller，深入理解控制循环的每一层。

**章节列表**

- 37.1 搭建最小 Controller 项目骨架（main.go + controller.go）
- 37.2 注册 SharedInformer 监听 TodoApp CRD 变更事件
- 37.3 实现 Reconcile 逻辑：根据 spec 计算期望状态并回写 status
- 37.4 部署手写 Controller 到 kind 集群并端到端验证

**本篇特色项目**

手写 TodoApp Controller（约 200 行 Go），实现：创建 TodoApp CR → Controller 检测到变更 → 回写 status.conditions 为 "Reconciled"。让学习者真正理解控制循环的运作方式。

**本篇能力验收标准**

能独立手写一个可运行的 Controller，能解释 Informer 注册、事件处理、Workqueue 出队、Reconcile 执行的完整链路。

---

### 第 38 篇：Kubebuilder 入门 [C]

**大篇学习目标**

掌握使用 Kubebuilder 和 controller-runtime 开发 Kubernetes Operator 的标准流程。

**章节列表**

- 38.1 Kubebuilder 项目初始化与脚手架代码解读
- 38.2 API 类型定义（Go struct + kubebuilder marker）与 DeepCopy 生成
- 38.3 Reconciler 编写与资源创建（对比手写版，理解框架省了什么）
- 38.4 controller-runtime：Manager、Client、Scheme、Controller 的协作关系
- 38.5 本地运行 Controller 并使用 kind 集群验证

**本篇特色项目**

使用 Kubebuilder 重写 Todo Operator：自动为 TodoApp CR 创建对应的 Deployment 和 Service。

**本篇能力验收标准**

能创建 Kubebuilder 项目，定义 API 类型，编写 Reconciler 并部署到集群。能解释 Kubebuilder 为手写 Controller 做了哪些封装。

---

### 第 39 篇：Operator 高级机制 [C]

**大篇学习目标**

掌握生产级 Operator 必备机制：OwnerReference、Finalizer、Webhook、Status Conditions 和多版本管理。

**章节列表**

- 39.1 OwnerReference 与资源归属管理（级联删除）
- 39.2 Finalizer 与删除前清理逻辑
- 39.3 Admission Webhook：默认值注入与字段校验
- 39.4 Mutating Admission Policies（CEL-based，K8s 1.36 GA·了解）
- 39.5 Status、Conditions 与状态回写最佳实践
- 39.6 事件记录（Event）、重试策略与错误处理
- 39.7 多版本 CRD 管理与转换 Webhook（conversion）

**本篇特色项目**

让 Todo Operator 完整实现：通过 OwnerReference 管理子资源、通过 Finalizer 实现删除前资源清理、通过 Webhook 校验 TodoApp spec、通过 Conditions 暴露平台健康状态。

**本篇能力验收标准**

能实现资源托管、删除清理、字段校验/默认值、状态回写和多版本兼容。

---

### 第 40 篇：Operator 测试、发布与升级 [C]

**大篇学习目标**

掌握 Operator 的测试、镜像构建、部署发布和版本升级能力。

**章节列表**

- 40.1 envtest 与 Controller 单元测试
- 40.2 集成测试：在 kind 环境中端到端验证 Operator 行为
- 40.3 Operator 镜像构建与 RBAC 配置（用 kubebuilder marker 生成）
- 40.4 Helm 4 Chart / Kustomize 发布 Operator
- 40.5 CRD 升级策略、兼容性测试与回滚

**本篇特色项目**

为 Todo Operator 建立测试和发布流水线：envtest 单元测试 → kind 集成测试 → 构建 Operator 镜像 → Helm 4 Chart 发布。

**本篇能力验收标准**

能为 Operator 编写 envtest 和集成测试，能构建镜像、部署、升级和回滚 Operator。

---

### 第 41 篇：Operator 生产实践 [C]

**大篇学习目标**

掌握 Operator 在真实企业环境中的稳定性、安全性和可维护性设计。

**章节列表**

- 41.1 Operator 权限最小化与安全边界（RBAC 精细化）
- 41.2 多租户、命名空间隔离与资源配额
- 41.3 大规模资源监听与性能优化（Index、Predicate、Cache 调优）
- 41.4 Operator 自身监控、日志和告警
- 41.5 生产事故案例与设计反思

**本篇特色项目**

将 Todo Operator 升级为生产可用版本：实施最小 RBAC 权限、添加 Prometheus 指标暴露、限制 Watch 范围、处理大规模 TodoApp 实例场景。

**本篇能力验收标准**

能从安全、性能、权限、监控、升级角度评估 Operator 是否可生产使用。

---

### 阶段六复习节点：Operator 开发能力检验

在进入最终集成之前，请逐项确认以下里程碑：

- [ ] 能解释 GVK/GVR、声明式 API 与控制循环的关系（篇 34）
- [ ] TodoApp、TodoDatabase、TodoCache 三个 CRD 可被 kubectl 操作，schema 校验生效（篇 35）
- [ ] 能画出 Informer → Workqueue → Reconcile 的数据流图（篇 36）
- [ ] 手写 Controller 可部署到集群，创建 CR 后自动回写 status（篇 37）
- [ ] Kubebuilder Operator 可自动创建 Deployment 和 Service，能对比手写版理解框架封装（篇 38）
- [ ] OwnerReference + Finalizer + Webhook + Conditions 全部实现（篇 39）
- [ ] envtest + kind 集成测试通过，Operator Helm Chart 可发布（篇 40）
- [ ] 最小 RBAC + Prometheus 指标暴露 + Watch 范围限制（篇 41）

**阶段产物**：Todo Operator —— 一个具备生产雏形的 Kubernetes Operator。

---

### 第 42 篇：综合集成与职业能力验收 [C]

**大篇学习目标**

整合全部阶段成果，完成全链路部署验证，转化为面试表达和岗位实战能力。

**章节列表**

- 42.1 项目总架构设计与代码仓库整理
- 42.2 全链路部署验证：从 Git Push → CI/CD → Argo CD → Operator 一键部署
- 42.3 监控、日志、链路追踪集成验证（模拟故障 → 定位 → 修复 → 复盘）
- 42.4 Operator 一键交付完整 Todo Platform（一条 YAML 拉起全栈）
- 42.5 项目答辩、简历包装与面试题复盘
- 42.6 云原生能力进阶图谱与后续学习路线（Service Mesh、WASM、eBPF）

**本篇特色项目**

整理最终作品集：架构图、部署说明、Grafana 面板截图、Operator CRD 示例、故障排查文档、面试讲解稿。

**本篇能力验收标准**

能清晰讲解项目架构、技术选型、排障经验和 Operator 设计思路。能通过一条 `kubectl apply -f todoapp.yaml` 部署整套 Todo Platform。

---

## 目录规模统计

| 项目 | 数量 |
|---|---|
| 阶段数 | 6 个 |
| 大篇数量 | 42 篇 |
| 章节数量 | 约 230 章 |
| 阶段项目数量 | 42 个 |
| 综合项目主线 | Cloud Native Todo Platform |

## 建议学习周期

| 阶段 | 周数（全日制） | 周数（在职） |
|---|---|---|
| 第一阶段：基础能力 | 4 周 | 6 周 |
| 第二阶段：Go 后端开发 | 8 周 | 12 周 |
| 第三阶段：容器化能力 | 4 周 | 6 周 |
| 第四阶段：Kubernetes 应用交付 | 8 周 | 12 周 |
| 第五阶段：生产工程能力 | 6 周 | 9 周 |
| 第六阶段：平台工程与 Operator | 8 周 | 12 周 |
| **合计** | **38 周** | **57 周** |

## 内容分类标注

课程中按以下四类区分内容深度：

| 标注 | 含义 | 示例 |
|---|---|---|
| （无标注） | 必学内容，要求理解并能动手操作 | Deployment 滚动更新 |
| 了解 | 认知性内容，理解概念即可，不要求动手 | kube-proxy IPVS 模式、ELK 架构 |
| 选修 | 扩展内容，按需学习 | Mutating Admission Policies |
| 附录 | 参考性内容，供查阅 | 版本兼容性矩阵、常见错误速查表 |
