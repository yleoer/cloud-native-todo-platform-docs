# 课程总设计

课程名称：**《从 Go 后端开发、Docker 容器化、Kubernetes 到 Operator 开发与生产实践》**

> **配套设计文档**：[00 章节写作规范](00-chapter-writing-standard.md) | [02 完整课程目录](02-full-curriculum.md) | [03 项目主线设计](03-project-mainline-cloud-native-todo-platform.md)

项目主线：**《Cloud Native Todo Platform》**

## 1. 教程整体定位

这是一套面向真实岗位能力的云原生全栈后端与平台工程课程。

课程主线是：

```text
环境准备与 YAML / Git
  -> Linux / Shell / 网络基础
  -> Go 后端开发（标准库 → 框架 → 数据库 → 缓存 → 生产化）
  -> Docker 容器化（基础 → Dockerfile → Compose → 底层原理）
  -> Kubernetes 应用交付（架构 → 工作负载 → 服务/配置 → 存储 → 网络 → 安全 → Helm → Kustomize）
  -> 生产工程化（CI/CD → GitOps → 监控 → 日志/追踪 → 排障）
  -> Kubernetes API 扩展（CRD → 手写 Controller → Kubebuilder → Webhook → Finalizer → 生产实践）
```

课程不是孤立知识点堆砌，而是围绕一个持续演进的综合项目 **Cloud Native Todo Platform** 展开。

学习者会从本地写一个 Go Todo 程序开始，逐步为它接入 PostgreSQL、Redis、Docker、Compose、Kubernetes、Helm、CI/CD、GitOps、监控、日志、链路追踪，最后开发一个自定义 Operator 来管理该平台的生命周期。

## 2. 学完后的岗位能力目标

完成后应具备以下能力：

- 独立开发中等复杂度的 Go 后端 API 服务
- 设计 RESTful API，处理配置、日志、错误、鉴权、数据库、缓存
- 使用 Go 标准库 net/http 理解 HTTP 底层模型，再使用 Gin 框架高效开发
- 编写生产可用 Dockerfile 和 Docker Compose 环境
- 理解容器镜像、Namespace、Cgroups、OCI、containerd、runc 的基本原理
- 将 Go 服务完整部署到 Kubernetes
- 掌握 Deployment、Service、Ingress、Gateway API、ConfigMap、Secret、PVC、HPA 等核心对象
- 了解 Ingress NGINX（已退役但仍广泛使用）的配置和迁移路径
- 使用 Helm 4、Kustomize 管理多环境部署
- 搭建 CI/CD 与 GitOps 发布流程
- 接入 Prometheus、Grafana、Loki、OpenTelemetry Tracing（ELK 为了解内容）
- 定位常见 Kubernetes 生产故障
- 理解 CRD、Controller、Informer、Workqueue、Webhook、Finalizer、OwnerReference
- 先手写简化版 Controller 理解控制循环本质，再使用 Kubebuilder 和 controller-runtime 开发 Operator
- 为 Operator 编写测试、发布镜像、部署到集群并进行生产级运维

## 3. 适合人群

- Linux 基础薄弱但希望进入后端或云原生方向的人
- Java、Python、前端、测试、运维转 Go / DevOps / Kubernetes 的工程师
- 想系统学习 Docker、Kubernetes、Helm、CI/CD、GitOps 的开发者
- 想从 Kubernetes 使用者进阶到平台工程师、Operator 开发者的人
- 想准备中高级 Go 后端、DevOps、SRE、云原生平台岗位的人

## 4. 前置知识要求

最低要求：

- 会使用电脑终端
- 理解基本编程概念，如变量、函数、条件、循环
- 能阅读简单英文技术文档更佳

不强制要求：

- 不要求已有 Go 经验
- 不要求已有 Docker / Kubernetes 经验
- 不要求已有运维经验

建议准备：

- 一台 16GB 内存以上的电脑
- Windows + WSL2、macOS 或 Linux 均可
- 能访问 GitHub、Docker Hub 或可替代镜像源
- 推荐安装 VS Code、Go、Docker Desktop、kubectl、kind / minikube

## 5. 版本与环境锁定

为保证课程可复现，所有工具和框架必须固定版本。课程以以下版本为基准编写：

| 组件 | 版本 | 说明 |
|---|---|---|
| **Go** | 1.26.x | 2026-02 发布，Green Tea GC 默认启用 |
| **Docker Engine** | 29.x | 最新稳定线，containerd 为默认镜像存储 |
| **containerd** | 2.3.x (LTS) | 首个 LTS 版本，支持到 2028-04 |
| **Kubernetes** | 1.36 | 2026-04 发布，代号 "Haru" |
| **kind** | 0.31+ | 本地 K8s 集群，注意 cgroup v2 要求 |
| **kubectl** | 1.36.x | 与 K8s 版本一致 |
| **Helm** | 4.2.x | Helm 3 将于 2026-07 停止修 bug，必须使用 Helm 4 |
| **Kubebuilder** | 4.11.x | 最新稳定版 |
| **controller-runtime** | 0.24.x | 跟随 K8s 1.36 |
| **PostgreSQL** | 18.x | 支持到 2030-11 |
| **Redis** | 8.2.x | 安全维护中（8.0 已 EOL） |
| **Gin** | 1.12.x | 要求 Go 1.25+ |
| **Ingress Controller** | Traefik（默认）+ Gateway API（进阶） | 社区 Ingress NGINX 已退役，但仍需了解 |

**版本管理策略**：

1. 课程第 1 篇设"环境锁"章节，列出所有版本号、下载链接和校验方式
2. 代码仓库提供 `scripts/check-env.sh` 自动检查环境版本
3. 涉及已废弃 API 的章节明确标注适用的 K8s 版本范围
4. 每年做一次全链路版本兼容性审查

## 6. 完整学习路线

```text
阶段一：基础能力（4 周）
环境准备与 YAML -> Linux 文件与权限 -> Linux 进程与服务 -> Linux 网络与 HTTP -> Git -> Shell 脚本

阶段二：Go 后端开发（8 周）
Go 语言基础 -> Go 工程化与测试 -> net/http 标准库 -> Gin 框架 -> Go 并发编程 -> PostgreSQL -> Redis -> 后端生产化

阶段三：容器化能力（4 周）
Docker 基础 -> Dockerfile 与镜像构建 -> Docker Compose 编排 -> 容器原理(Namespace/Cgroups) -> OCI/containerd/runc/CRI

阶段四：Kubernetes 应用交付（8 周）
阶段四 a（会用）：架构与集群搭建 -> 核心工作负载 -> Service/Ingress/Gateway API -> ConfigMap/Secret
阶段四 b（深入）：存储(PV/PVC/StatefulSet) -> 网络原理(CNI/DNS/kube-proxy) -> 安全(RBAC/SecurityContext/TLS) -> Helm 4 -> Kustomize

阶段五：生产工程能力（6 周）
阶段五 a（交付自动化）：CI/CD -> GitOps 与 Argo CD
阶段五 b（可观测性）：Prometheus/Grafana 监控 -> 日志与 Loki/ELK -> OpenTelemetry 链路追踪 -> 生产排障

阶段六：平台工程与 Operator 能力（8 周）
K8s API Machinery -> CRD 设计 -> 手写 Controller(Informer/Workqueue/Reconcile) -> Kubebuilder 入门 -> Operator 高级机制(Webhook/Finalizer/OwnerReference) -> Operator 测试/发布/升级 -> Operator 生产实践 -> 综合集成与职业验收
```

## 7. 推荐学习周期

建议周期：**38 周以上（全日制脱产），在职学习建议 57 周以上**。

| 阶段 | 周数 | 篇数 | 内容 |
|---|---|---|---|
| 第 1 阶段 | 1-4 周 | 6 篇 | 环境准备+YAML、Linux 文件/进程/网络、Git、Shell |
| 第 2 阶段 | 5-12 周 | 8 篇 | Go 基础、工程化、net/http、Gin、并发、PostgreSQL、Redis、生产化 |
| 第 3 阶段 | 13-16 周 | 5 篇 | Docker 基础、Dockerfile、Compose、容器原理、OCI/containerd/runc |
| 第 4 阶段 | 17-24 周 | 9 篇 | K8s 架构、工作负载、Service/Ingress、存储、网络原理、安全、Helm 4、Kustomize |
| 第 5 阶段 | 25-30 周 | 5 篇 | CI/CD、GitOps、监控、日志/Tracing、生产排障 |
| 第 6 阶段 | 31-38 周 | 9 篇 | API Machinery、CRD、手写 Controller、Kubebuilder、Webhook/Finalizer、测试发布、生产实践、综合集成 |

### 阶段→大篇映射表

| 阶段 | 包含大篇 | 篇数 |
|---|---|---|
| 阶段一 | 第 1-6 篇 | 6 |
| 阶段二 | 第 7-14 篇 | 8 |
| 阶段三 | 第 15-19 篇 | 5 |
| 阶段四 | 第 20-28 篇 | 9 |
| 阶段五 | 第 29-33 篇 | 5 |
| 阶段六 | 第 34-42 篇 | 9 |

## 8. 全套综合项目规划

综合项目名称：**Cloud Native Todo Platform**

项目演进路线：

1. 阶段一：CLI 与基础环境
   - 使用 Go 编写本地 Todo CLI
   - 使用 Shell 编写启动、检查、清理脚本

2. 阶段二：Go Web API
   - 先用 net/http 标准库实现 Todo HTTP 服务，理解底层模型
   - 再用 Gin 框架重构，提供 Todo CRUD API
   - 使用 goroutine/channel 实现并发统计任务
   - 接入 PostgreSQL 持久化
   - 接入 Redis 缓存、限流、分布式锁
   - 增加 JWT 鉴权、结构化日志、健康检查、单元测试

3. 阶段三：容器化
   - 编写生产级 Dockerfile（多阶段构建、非 root 用户）
   - 使用 Docker Compose 启动 API、PostgreSQL、Redis、Traefik
   - 优化镜像体积、安全用户、启动参数
   - 手动模拟容器（Namespace、Cgroups）理解底层原理
   - 使用 crictl/nerdctl 观察容器运行时

4. 阶段四：Kubernetes 部署
   - 编写 Deployment、Service、Ingress、Gateway API、ConfigMap、Secret、PVC
   - 增加 Probe、HPA、Resource Limit
   - 了解社区 Ingress NGINX 的配置方式（虽已退役，企业存量仍大）
   - 了解 kube-proxy IPVS 模式（1.36 已移除，旧集群仍在使用）
   - 配置 RBAC、SecurityContext、NetworkPolicy、TLS
   - 使用 Helm 4 和 Kustomize 管理多环境

5. 阶段五：工程化交付
   - GitHub Actions 自动测试、构建、推送镜像
   - Argo CD 实现 GitOps 部署
   - Prometheus 采集指标，Grafana 展示面板
   - Loki / ELK 收集日志，OpenTelemetry 接入链路追踪
   - 故障注入与恢复演练

6. 阶段六：Operator 化
   - 设计 `TodoApp`、`TodoDatabase`、`TodoCache` CRD
   - 手写简化版 Controller，理解 Informer/Workqueue/Reconcile 本质
   - 使用 Kubebuilder 重写 Controller
   - 使用 OwnerReference 管理子资源
   - 使用 Finalizer 处理清理逻辑
   - 使用 Webhook 做默认值和校验
   - 编写 envtest、集成测试和发布流程
   - 最终实现一条 YAML 创建整套 Todo 平台

## 9. 最终能力评估标准

| 维度 | 评估标准 |
|---|---|
| Go 后端 | 能从 net/http 原理到 Gin 框架独立开发、测试、部署一个生产风格 API 服务 |
| 数据能力 | 能设计表结构、事务、迁移、缓存和限流方案 |
| 容器能力 | 能编写安全、可维护、体积合理的 Dockerfile，理解容器底层隔离机制 |
| Compose 能力 | 能本地编排完整开发环境 |
| K8s 能力 | 能将服务部署到 Kubernetes 并配置网络、存储、安全和扩缩容 |
| Ingress 能力 | 能配置 Ingress 和 Gateway API，了解社区 Ingress NGINX 的历史和迁移路径 |
| Helm/Kustomize | 能使用 Helm 4 和 Kustomize 管理多环境发布配置 |
| CI/CD | 能实现从提交代码到集群发布的自动化流程 |
| GitOps | 能使用 Argo CD 管理声明式部署 |
| 可观测性 | 能建立指标、日志、链路追踪体系，三者联动排障 |
| 排障能力 | 能定位常见 Pod、网络、存储、镜像、权限、性能问题 |
| API 扩展 | 能手写简化版 Controller，理解 Informer、Workqueue、Reconcile 的工作方式 |
| Operator 开发 | 能使用 Kubebuilder 开发、测试、发布生产级 Operator |
| 生产意识 | 能考虑安全、权限、资源、升级、回滚、备份和故障恢复 |

## 10. 学习者完成后可胜任的工作任务清单

以下清单将 §2 的能力目标拆解为具体可独立执行的工作任务，便于面试和绩效评估中逐项举证。

完成后应能胜任：

- 开发 Go RESTful API 服务
- 设计后端项目结构和工程规范
- 编写数据库迁移、事务逻辑、缓存逻辑
- 编写 Dockerfile 并优化镜像
- 使用 Docker Compose 搭建本地开发环境
- 将后端服务部署到 Kubernetes
- 编写 Deployment、Service、Ingress、Gateway API、ConfigMap、Secret、PVC、HPA
- 了解社区 Ingress NGINX 和 kube-proxy IPVS 模式，能维护存量的旧集群
- 处理 Kubernetes 服务暴露、DNS、网络隔离和 Ingress 配置
- 使用 Helm 4 Chart 发布业务系统
- 使用 Kustomize 管理多环境差异
- 搭建 GitHub Actions / GitLab CI 发布流水线
- 使用 Argo CD 实现 GitOps
- 接入 Prometheus、Grafana、Loki、OpenTelemetry（ELK 为了解内容）
- 排查 CrashLoopBackOff、ImagePullBackOff、OOMKilled、Pending、DNS 失败、Ingress 失败等问题
- 编写 CRD 并设计自定义资源模型
- 理解 Controller 控制循环并能手写简化版 Controller
- 使用 Kubebuilder 开发 Controller / Operator
- 实现 Webhook、Finalizer、OwnerReference、状态回写
- 为 Operator 编写测试并进行版本发布
- 参与企业内部云原生平台、DevOps 平台、运维自动化平台建设

## 11. 课程设计原则

以下原则指导了本蓝图的章节顺序安排：

1. **先会用再深入**：每个技术领域都是先实操（能跑起来），再深入原理（知道为什么）。例如先部署 Service/Ingress，再深入网络原理；先手写 Controller 理解循环，再用 Kubebuilder。
2. **标准库先行**：Go Web 开发先用 net/http 理解 HTTP 底层模型，再引入 Gin 框架，避免框架遮蔽核心概念。
3. **并发延迟引入**：Go 并发编程放在 Web API 之后，以 HTTP 服务的并发请求处理为真实场景，而非孤立讲解语法。
4. **存量与前沿兼顾**：社区 Ingress NGINX 和 kube-proxy IPVS 虽已从 K8s 1.36 移除，但大量企业仍在使用旧版，课程以"了解"层次覆盖，主力教学内容使用 Traefik + Gateway API。
5. **持续可验收**：每个阶段的产物都是可独立运行的服务或系统，学习者每完成一个阶段都有可展示的成果。
6. **版本可复现**：所有工具和框架版本锁定，配套版本检查脚本，确保教程不因版本漂移而失效。
