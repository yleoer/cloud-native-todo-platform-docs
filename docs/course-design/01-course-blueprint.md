# 课程总设计

课程名称：**《从 Go 后端开发、Docker 容器化、Kubernetes 到 Operator 开发与生产实践》**

项目主线：**《Cloud Native Todo Platform》**

## 1. 教程整体定位

这是一套面向真实岗位能力的云原生全栈后端与平台工程课程。

课程主线是：

```text
Linux / Git / Shell
  -> Go 后端开发
  -> Docker 容器化
  -> Kubernetes 应用交付
  -> 可观测性与生产排障
  -> Kubernetes API 扩展
  -> Operator 开发与生产实践
```

课程不是孤立知识点堆砌，而是围绕一个持续演进的综合项目 **Cloud Native Todo Platform** 展开。

学习者会从本地写一个 Go Todo 程序开始，逐步为它接入 PostgreSQL、Redis、Docker、Compose、Kubernetes、Helm、CI/CD、GitOps、监控、日志、链路追踪，最后开发一个自定义 Operator 来管理该平台的生命周期。

## 2. 学完后的岗位能力目标

完成后应具备以下能力：

- 独立开发中等复杂度的 Go 后端 API 服务
- 设计 RESTful API，处理配置、日志、错误、鉴权、数据库、缓存
- 编写生产可用 Dockerfile 和 Docker Compose 环境
- 理解容器镜像、Namespace、Cgroups、OCI、containerd、runc 的基本原理
- 将 Go 服务完整部署到 Kubernetes
- 掌握 Deployment、Service、Ingress、ConfigMap、Secret、PVC、HPA 等核心对象
- 使用 Helm、Kustomize 管理多环境部署
- 搭建 CI/CD 与 GitOps 发布流程
- 接入 Prometheus、Grafana、Loki / ELK、Tracing
- 定位常见 Kubernetes 生产故障
- 理解 CRD、Controller、Informer、Workqueue、Webhook、Finalizer、OwnerReference
- 使用 Kubebuilder 和 controller-runtime 开发 Operator
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

## 5. 完整学习路线

```text
阶段一：基础能力
Linux -> Git -> Shell -> 网络基础 -> Go 语言基础

阶段二：后端开发能力
Go 工程化 -> Web API -> PostgreSQL -> Redis -> 鉴权 -> 测试

阶段三：容器化能力
Docker -> Dockerfile -> Compose -> 镜像优化 -> 容器原理 -> OCI/containerd/runc

阶段四：Kubernetes 应用交付能力
K8s 架构 -> 核心对象 -> 网络 -> 存储 -> 配置 -> 安全 -> Helm -> Kustomize

阶段五：生产工程能力
CI/CD -> GitOps -> 监控 -> 日志 -> 链路追踪 -> 灰度发布 -> 生产排障

阶段六：平台工程与 Operator 能力
Kubernetes API -> CRD -> Controller -> Informer -> Workqueue -> Kubebuilder -> Webhook -> Finalizer -> Operator 测试与生产实践
```

## 6. 推荐学习周期

建议周期：**28 周以上**。

| 阶段 | 周期 | 内容 |
|---|---:|---|
| 第 1 阶段 | 1-4 周 | Linux、Git、Shell、网络基础 |
| 第 2 阶段 | 5-10 周 | Go 基础、Go Web API、数据库、Redis、测试 |
| 第 3 阶段 | 11-14 周 | Docker、Dockerfile、Compose、容器原理 |
| 第 4 阶段 | 15-20 周 | Kubernetes 架构、对象、网络、存储、安全、Helm、Kustomize |
| 第 5 阶段 | 21-24 周 | CI/CD、GitOps、监控、日志、Tracing、生产排障 |
| 第 6 阶段 | 25-28 周 | CRD、Controller、Kubebuilder、Webhook、Operator 生产实践 |

## 7. 全套综合项目规划

综合项目名称：**Cloud Native Todo Platform**

项目演进路线：

1. 阶段一：CLI 与基础环境
   - 使用 Go 编写本地 Todo CLI
   - 使用 Shell 编写启动、检查、清理脚本

2. 阶段二：Go Web API
   - 提供 Todo 创建、查询、更新、删除 API
   - 接入 PostgreSQL
   - 接入 Redis 缓存、限流、分布式锁
   - 增加 JWT 鉴权、结构化日志、健康检查、单元测试

3. 阶段三：容器化
   - 编写生产级 Dockerfile
   - 使用 Docker Compose 启动 API、PostgreSQL、Redis、Nginx
   - 优化镜像体积、安全用户、启动参数

4. 阶段四：Kubernetes 部署
   - 编写 Deployment、Service、Ingress、ConfigMap、Secret、PVC
   - 增加 Probe、HPA、Resource Limit
   - 使用 Helm 和 Kustomize 管理多环境

5. 阶段五：工程化交付
   - GitHub Actions 自动测试、构建、推送镜像
   - Argo CD 实现 GitOps 部署
   - Prometheus 采集指标，Grafana 展示面板
   - Loki / ELK 收集日志，OpenTelemetry 接入链路追踪

6. 阶段六：Operator 化
   - 设计 `TodoApp`、`TodoDatabase`、`TodoCache` CRD
   - 使用 Kubebuilder 开发 Controller
   - 使用 OwnerReference 管理子资源
   - 使用 Finalizer 处理清理逻辑
   - 使用 Webhook 做默认值和校验
   - 编写 envtest、集成测试和发布流程
   - 最终实现一条 YAML 创建整套 Todo 平台

## 8. 最终能力评估标准

| 维度 | 评估标准 |
|---|---|
| Go 后端 | 能独立开发、测试、部署一个生产风格 API 服务 |
| 数据能力 | 能设计表结构、事务、迁移、缓存和限流方案 |
| 容器能力 | 能编写安全、可维护、体积合理的 Dockerfile |
| Compose 能力 | 能本地编排完整开发环境 |
| K8s 能力 | 能将服务部署到 Kubernetes 并配置网络、存储、安全和扩缩容 |
| Helm/Kustomize | 能管理多环境发布配置 |
| CI/CD | 能实现从提交代码到集群发布的自动化流程 |
| GitOps | 能使用 Argo CD 管理声明式部署 |
| 可观测性 | 能建立指标、日志、链路追踪体系 |
| 排障能力 | 能定位常见 Pod、网络、存储、镜像、权限、性能问题 |
| API 扩展 | 能理解 CRD、Controller、Informer、Workqueue 的工作方式 |
| Operator 开发 | 能使用 Kubebuilder 开发、测试、发布生产级 Operator |
| 生产意识 | 能考虑安全、权限、资源、升级、回滚、备份和故障恢复 |

## 9. 学习者完成后可胜任的工作任务清单

完成后应能胜任：

- 开发 Go RESTful API 服务
- 设计后端项目结构和工程规范
- 编写数据库迁移、事务逻辑、缓存逻辑
- 编写 Dockerfile 并优化镜像
- 使用 Docker Compose 搭建本地开发环境
- 将后端服务部署到 Kubernetes
- 编写 Deployment、Service、Ingress、ConfigMap、Secret、PVC、HPA
- 处理 Kubernetes 服务暴露、DNS、网络隔离和 Ingress 配置
- 使用 Helm Chart 发布业务系统
- 使用 Kustomize 管理多环境差异
- 搭建 GitHub Actions / GitLab CI 发布流水线
- 使用 Argo CD 实现 GitOps
- 接入 Prometheus、Grafana、Loki / ELK、OpenTelemetry
- 排查 CrashLoopBackOff、ImagePullBackOff、OOMKilled、Pending、DNS 失败、Ingress 失败等问题
- 编写 CRD 并设计自定义资源模型
- 使用 Kubebuilder 开发 Controller / Operator
- 实现 Webhook、Finalizer、OwnerReference、状态回写
- 为 Operator 编写测试并进行版本发布
- 参与企业内部云原生平台、DevOps 平台、运维自动化平台建设

