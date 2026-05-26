# 学习路线

本路线围绕 **Cloud Native Todo Platform** 展开，共 **40 大篇，200 个章节**，分为 7 个学习阶段。每个阶段都有明确学习目标、产出物和能力验收标准。

## 阶段一：基础环境与工具链（第 1-6 篇）

**学习目标**：建立完整学习地图，掌握 Linux、Git、Shell 等云原生开发必备基础。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 1 篇 - 课程导学与开发环境准备 | Go、Docker、kubectl、kind、Helm 环境搭建 | 初始化 `cloud-native-todo-platform` 仓库 |
| 第 2 篇 - Linux 文件系统与命令基础 | 文件、目录、权限、文本处理命令 | Todo 平台服务器目录结构 |
| 第 3 篇 - Linux 进程、服务与软件管理 | 进程管理、systemd、资源排查 | Go HTTP 程序 systemd 服务 |
| 第 4 篇 - Linux 网络基础与排障 | TCP/IP、端口、DNS、HTTP 排查 | 本地 Todo HTTP 服务访问链路 |
| 第 5 篇 - Git 基础与团队协作 | 分支、合并、冲突解决、PR 工作流 | Git 分支模型和提交规范 |
| 第 6 篇 - Shell 脚本与自动化基础 | 变量、循环、函数、脚本编写 | `dev.sh`、`check.sh`、`clean.sh` |

**能力验收**：能熟练使用 Linux 命令、Git 协作、编写 Shell 脚本。

---

## 阶段二：Go 语言与后端开发（第 7-13 篇）

**学习目标**：从 Go 基础语法到生产级 Web API 服务开发。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 7 篇 - Go 语言基础 | 变量、类型、函数、结构体、接口 | 命令行版 Todo 管理器 `todo-cli` |
| 第 8 篇 - Go 进阶与并发编程 | goroutine、channel、context、并发安全 | 并发 Todo 统计任务执行器 |
| 第 9 篇 - Go 工程化与测试 | 项目结构、配置、日志、单元测试 | Todo 平台后端工程骨架 |
| 第 10 篇 - Go Web API 开发 | HTTP、Gin/Chi、RESTful API、中间件 | Todo Platform API v1 |
| 第 11 篇 - 数据库与持久化开发 | PostgreSQL、SQL、GORM、事务、迁移 | Todo 平台 PostgreSQL 持久化 |
| 第 12 篇 - Redis、缓存与异步任务 | Redis 数据类型、缓存模式、限流、队列 | Todo 平台缓存、限流和异步统计 |
| 第 13 篇 - Go 后端生产化能力 | JWT 鉴权、审计日志、配置分层、优雅关闭 | 生产风格 Todo API 服务 |

**能力验收**：能独立开发、测试、部署生产级 Go RESTful API 服务。

---

## 阶段三：Docker 容器技术（第 14-18 篇）

**学习目标**：掌握 Docker 使用、Dockerfile 编写、容器原理和运行时机制。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 14 篇 - Docker 基础 | 镜像、容器、网络、数据卷 | Docker 运行 Todo API、PostgreSQL、Redis |
| 第 15 篇 - Dockerfile 与镜像构建 | 多阶段构建、镜像优化、安全扫描 | Todo 平台 Go 服务镜像 |
| 第 16 篇 - Docker Compose 本地编排 | 多服务编排、环境变量、依赖关系 | 一条命令启动 Todo 平台完整环境 |
| 第 17 篇 - 容器运行原理 | Namespace、Cgroups、UnionFS | 手动模拟容器隔离与资源限制 |
| 第 18 篇 - OCI、containerd、runc 与 CRI | OCI 规范、containerd、CRI 接口 | 使用 nerdctl 和 crictl 观察容器 |

**能力验收**：能编写生产可用 Dockerfile，理解容器隔离和资源限制原理。

---

## 阶段四：Kubernetes 核心能力（第 19-26 篇）

**学习目标**：系统掌握 Kubernetes 架构、工作负载、网络、存储、安全和配置管理。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 19 篇 - Kubernetes 架构与集群搭建 | 控制面、Node 组件、kind/minikube | 本地 Kubernetes 集群 |
| 第 20 篇 - Kubernetes 核心工作负载 | Pod、Deployment、Job、DaemonSet | Todo API Deployment |
| 第 21 篇 - Kubernetes 服务发现与应用配置 | Service、Ingress、ConfigMap、Secret | Todo 平台服务暴露和配置管理 |
| 第 22 篇 - Kubernetes 网络 | CNI、CoreDNS、kube-proxy、NetworkPolicy | Todo 平台网络访问路径和隔离策略 |
| 第 23 篇 - Kubernetes 存储 | PV、PVC、StorageClass、StatefulSet | Todo 平台数据库持久化存储 |
| 第 24 篇 - Kubernetes 安全 | RBAC、SecurityContext、Pod Security | Todo 平台最小权限部署方案 |
| 第 25 篇 - Helm 包管理 | Chart 编写、模板语法、多环境参数化 | Todo 平台 Helm Chart |
| 第 26 篇 - Kustomize 多环境配置管理 | base、overlay、patch、环境差异管理 | dev、test、prod 三套环境配置 |

**能力验收**：能将服务部署到 Kubernetes，配置网络、存储、安全，使用 Helm 和 Kustomize 管理多环境。

---

## 阶段五：云原生交付与可观测（第 27-31 篇）

**学习目标**：建立 CI/CD、GitOps、监控、日志、链路追踪和生产排障能力。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 27 篇 - CI/CD 自动化交付 | GitHub Actions/GitLab CI、自动测试、构建、部署 | Todo 平台完整 CI/CD 流水线 |
| 第 28 篇 - GitOps 与 Argo CD | GitOps 思想、Argo CD、自动同步、漂移检测 | Argo CD 管理 Todo 平台发布 |
| 第 29 篇 - Prometheus 与 Grafana 监控 | 指标采集、PromQL、Grafana 面板、告警 | Todo 平台监控面板 |
| 第 30 篇 - 日志、ELK/Loki 与链路追踪 | 结构化日志、Loki/ELK、OpenTelemetry | Todo 平台日志采集和链路追踪 |
| 第 31 篇 - Kubernetes 生产排障 | Pod 故障、资源瓶颈、网络/存储排查 | Todo 平台故障注入与恢复演练 |

**能力验收**：能搭建完整 CI/CD 和 GitOps 流程，接入监控、日志、链路追踪，排查生产故障。

---

## 阶段六：Operator 开发与平台工程（第 32-38 篇）

**学习目标**：深入 Kubernetes API 扩展机制，掌握 CRD、Controller、Kubebuilder 和 Operator 开发。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 32 篇 - Kubernetes API 扩展机制 | 声明式 API、控制循环、GVK、CRD | `TodoApp` 自定义资源模型 |
| 第 33 篇 - CRD 设计与实践 | OpenAPI Schema、spec/status、版本升级 | `TodoApp`、`TodoDatabase`、`TodoCache` CRD |
| 第 34 篇 - Controller、Informer 与 Workqueue | List-Watch、Informer、Workqueue、Reconcile | 简化版 Controller 监听 `TodoApp` |
| 第 35 篇 - Kubebuilder 与 controller-runtime | Kubebuilder 项目、API 定义、Reconciler | Todo 平台 Operator 初版 |
| 第 36 篇 - Operator 高级机制 | OwnerReference、Finalizer、Webhook、Status | Operator 自动创建 Deployment、Service、ConfigMap |
| 第 37 篇 - Operator 测试、发布与升级 | envtest、集成测试、镜像构建、Helm 发布 | Todo Operator 测试和发布流水线 |
| 第 38 篇 - Operator 生产实践 | 权限最小化、多租户、性能优化、监控告警 | 生产可用 Todo Operator |

**能力验收**：能设计 CRD，开发 Controller/Operator，实现资源托管、状态回写、Webhook 校验。

---

## 阶段七：综合项目与职业能力（第 39-40 篇）

**学习目标**：完成 Cloud Native Todo Platform 全链路集成，准备简历和面试。

| 篇章 | 学习重点 | 产出物 |
|---|---|---|
| 第 39 篇 - 综合项目集成实战 | 项目总架构、CI/CD、GitOps、监控日志集成 | Cloud Native Todo Platform 全链路 |
| 第 40 篇 - 职业能力验收与面试准备 | 岗位能力梳理、简历包装、面试题复盘 | 作品集、项目文档、面试讲解稿 |

**能力验收**：能从零部署完整平台，能清晰讲解架构、技术选型、排障经验和个人贡献。

---

## 能力成长路径

```text
阶段一：基础环境与工具链
  ↓
阶段二：Go 语言与后端开发
  ↓
阶段三：Docker 容器技术
  ↓
阶段四：Kubernetes 核心能力
  ↓
阶段五：云原生交付与可观测
  ↓
阶段六：Operator 开发与平台工程
  ↓
阶段七：综合项目与职业能力
```

## 学完后可以胜任的工作

- **Go 后端开发工程师**：独立开发 RESTful API 服务，掌握数据库、缓存、并发编程。
- **DevOps 工程师**：搭建 CI/CD、GitOps 流程，管理 Kubernetes 集群。
- **云原生平台工程师**：设计云原生架构，接入监控、日志、链路追踪。
- **Kubernetes Operator 开发工程师**：开发 CRD、Controller、Operator，自动化管理应用生命周期。
- **SRE 工程师**：排查生产故障，优化系统可靠性和可观测性。

