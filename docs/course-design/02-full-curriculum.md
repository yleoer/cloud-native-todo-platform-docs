# 完整课程目录

综合项目主线：**Cloud Native Todo Platform 云原生 Todo 平台**

最终形成：

- Go Todo API 服务
- PostgreSQL 数据库
- Redis 缓存与限流
- Docker 镜像与 Docker Compose 本地环境
- Kubernetes 部署清单
- Helm Chart 与 Kustomize 多环境配置
- CI/CD 与 GitOps 发布链路
- Prometheus、Grafana、Loki / ELK、Tracing 可观测体系
- 自定义 CRD、Controller、Operator

课程共 **40 大篇，200 个章节**。

## 第 1 篇：课程导学与开发环境准备

**大篇学习目标**

建立完整学习地图，准备后续 Go、Docker、Kubernetes、Operator 开发所需环境。

**章节列表**

- 1.1 课程目标、岗位路线与综合项目介绍
- 1.2 Windows / macOS / Linux 学习环境选择
- 1.3 WSL2、Ubuntu、终端与 VS Code 配置
- 1.4 安装 Go、Git、Docker、kubectl、kind、Helm
- 1.5 创建课程代码仓库与目录规范

**本篇特色项目**

搭建统一实验环境，并初始化 `cloud-native-todo-platform` 仓库。

**本篇能力验收标准**

能独立完成开发环境安装，能运行 Go、Git、Docker、kubectl、kind、Helm 基础命令。

## 第 2 篇：Linux 文件系统与命令基础

**大篇学习目标**

掌握后端开发和云原生运维中最常用的 Linux 文件、目录、权限和文本处理能力。

**章节列表**

- 2.1 Linux 目录结构与路径规则
- 2.2 文件与目录操作命令
- 2.3 用户、用户组与文件权限
- 2.4 文本查看、搜索与处理命令
- 2.5 压缩、解压、软链接与环境变量

**本篇特色项目**

搭建 Todo 平台服务器目录结构，创建日志、配置、数据目录。

**本篇能力验收标准**

能熟练使用 `ls`、`cd`、`cp`、`mv`、`rm`、`cat`、`less`、`grep`、`find`、`chmod`、`chown`。

## 第 3 篇：Linux 进程、服务与软件管理

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

## 第 4 篇：Linux 网络基础与排障

**大篇学习目标**

理解后端服务访问链路，为 Docker、Kubernetes 网络打基础。

**章节列表**

- 4.1 TCP/IP、端口、DNS、HTTP 基础
- 4.2 `ip`、`ss`、`netstat`、`ping` 使用
- 4.3 `curl`、`wget`、`dig`、`nslookup` 排查访问问题
- 4.4 防火墙、监听地址与端口冲突
- 4.5 tcpdump 抓包入门

**本篇特色项目**

编写并排查一个本地 Todo HTTP 服务访问链路。

**本篇能力验收标准**

能判断服务是否启动、端口是否监听、DNS 是否正常、HTTP 请求是否成功。

## 第 5 篇：Git 基础与团队协作

**大篇学习目标**

掌握企业开发中代码版本管理、分支协作和冲突解决能力。

**章节列表**

- 5.1 Git 仓库、提交与历史记录
- 5.2 分支、合并与冲突解决
- 5.3 rebase、stash、tag 与版本发布
- 5.4 GitHub / GitLab 远程仓库协作
- 5.5 Pull Request / Merge Request 工作流

**本篇特色项目**

为课程项目建立 Git 分支模型和提交规范。

**本篇能力验收标准**

能完成分支开发、代码提交、冲突解决、远程推送和 PR 合并。

## 第 6 篇：Shell 脚本与自动化基础

**大篇学习目标**

能编写常见自动化脚本，提高开发、构建、部署、排障效率。

**章节列表**

- 6.1 Shell 变量、参数与退出码
- 6.2 条件判断、循环与函数
- 6.3 文件处理、日志处理与管道
- 6.4 编写项目启动和健康检查脚本
- 6.5 Shell 脚本常见安全问题

**本篇特色项目**

为 Todo 平台编写 `dev.sh`、`check.sh`、`clean.sh` 脚本。

**本篇能力验收标准**

能写出可复用 Shell 脚本，能通过退出码判断脚本执行结果。

## 第 7 篇：Go 语言基础

**大篇学习目标**

掌握 Go 基础语法，为后续后端服务开发打基础。

**章节列表**

- 7.1 Go 程序结构、变量、常量与类型
- 7.2 条件、循环、数组、切片与 map
- 7.3 函数、指针、结构体与方法
- 7.4 interface、error 与 defer
- 7.5 Go module 与包管理基础

**本篇特色项目**

开发命令行版 Todo 管理器 `todo-cli`。

**本篇能力验收标准**

能使用 Go 编写结构清晰的 CLI 程序，完成 Todo 的增删改查逻辑。

## 第 8 篇：Go 进阶与并发编程

**大篇学习目标**

掌握 Go 并发模型和资源控制能力，理解后端高并发开发基础。

**章节列表**

- 8.1 goroutine 与并发执行
- 8.2 channel 通信模型
- 8.3 context 超时、取消与请求链路控制
- 8.4 sync、Mutex、WaitGroup 与 Once
- 8.5 并发安全、竞态检测与限流思想

**本篇特色项目**

开发并发 Todo 统计任务执行器，支持超时取消和并发数控制。

**本篇能力验收标准**

能正确使用 goroutine、channel、context，能避免常见并发泄漏和数据竞争。

## 第 9 篇：Go 工程化与测试

**大篇学习目标**

建立生产级 Go 项目结构、配置、日志、测试和质量管理能力。

**章节列表**

- 9.1 Go 项目目录结构设计
- 9.2 配置管理、环境变量与配置文件
- 9.3 结构化日志与错误处理规范
- 9.4 单元测试、表驱动测试与 Mock
- 9.5 集成测试、覆盖率与 Benchmark

**本篇特色项目**

搭建 Todo 平台后端工程骨架。

**本篇能力验收标准**

能组织清晰的 Go 后端项目，能编写单元测试和基础集成测试。

## 第 10 篇：Go Web API 开发

**大篇学习目标**

掌握使用 Go 开发 RESTful API 服务的核心能力。

**章节列表**

- 10.1 HTTP 协议与 Web 服务基础
- 10.2 Gin / Chi 路由、中间件与请求绑定
- 10.3 RESTful API 设计与统一响应格式
- 10.4 参数校验、错误码与异常处理
- 10.5 健康检查、优雅关闭与 API 文档

**本篇特色项目**

开发 Todo Platform API v1，支持 Todo CRUD。

**本篇能力验收标准**

能独立开发一个可运行、可测试、可维护的 Go Web API 服务。

## 第 11 篇：数据库与持久化开发

**大篇学习目标**

掌握关系型数据库建模、SQL、事务和 Go 数据库访问能力。

**章节列表**

- 11.1 PostgreSQL 基础与表设计
- 11.2 SQL CRUD、索引与查询优化入门
- 11.3 Go 访问数据库：database/sql、GORM、sqlc
- 11.4 事务、隔离级别与数据一致性
- 11.5 数据库迁移与版本管理

**本篇特色项目**

为 Todo 平台接入 PostgreSQL 持久化。

**本篇能力验收标准**

能设计 Todo 表结构，能完成数据库迁移、事务处理和基础查询优化。

## 第 12 篇：Redis、缓存与异步任务

**大篇学习目标**

掌握 Redis 常见数据结构、缓存模式、限流和简单异步任务处理。

**章节列表**

- 12.1 Redis 安装、数据类型与常用命令
- 12.2 Go 操作 Redis
- 12.3 缓存穿透、击穿、雪崩与解决方案
- 12.4 分布式锁、计数器与接口限流
- 12.5 简单任务队列与异步处理模型

**本篇特色项目**

为 Todo 平台增加缓存、接口限流和异步统计任务。

**本篇能力验收标准**

能合理使用 Redis 解决缓存、限流、锁和队列类问题，并能说明风险。

## 第 13 篇：Go 后端生产化能力

**大篇学习目标**

补齐真实公司后端服务需要的认证、安全、配置、日志和运行能力。

**章节列表**

- 13.1 JWT 鉴权与用户登录
- 13.2 中间件链路、请求 ID 与审计日志
- 13.3 参数校验、安全响应与敏感信息保护
- 13.4 配置分层：dev、test、prod
- 13.5 服务启动、关闭、迁移和运维命令设计

**本篇特色项目**

将 Todo 平台升级为生产风格 API 服务。

**本篇能力验收标准**

能实现认证、日志、配置分层、健康检查和优雅关闭。

## 第 14 篇：Docker 基础

**大篇学习目标**

掌握 Docker 镜像、容器、网络、数据卷的基本使用方式。

**章节列表**

- 14.1 Docker 解决什么问题
- 14.2 镜像、容器、仓库与常用命令
- 14.3 容器生命周期与日志查看
- 14.4 Docker 数据卷与端口映射
- 14.5 Docker 网络基础

**本篇特色项目**

使用 Docker 运行 Todo API、PostgreSQL、Redis。

**本篇能力验收标准**

能构建、启动、停止、查看、进入、删除容器，能排查基础容器运行问题。

## 第 15 篇：Dockerfile 与镜像构建

**大篇学习目标**

掌握生产级 Dockerfile 编写、镜像优化和安全实践。

**章节列表**

- 15.1 Dockerfile 指令详解
- 15.2 Go 服务多阶段构建
- 15.3 镜像缓存、构建上下文与 `.dockerignore`
- 15.4 非 root 用户、最小镜像与安全扫描
- 15.5 镜像版本、标签和推送仓库

**本篇特色项目**

为 Todo 平台构建安全、小体积、可发布的 Go 服务镜像。

**本篇能力验收标准**

能写出生产可用 Dockerfile，能解释每一层镜像的作用和优化方式。

## 第 16 篇：Docker Compose 本地编排

**大篇学习目标**

掌握多服务本地开发环境编排能力。

**章节列表**

- 16.1 Compose 文件结构与服务定义
- 16.2 API、PostgreSQL、Redis 多容器编排
- 16.3 环境变量、数据卷、网络与依赖关系
- 16.4 本地开发、测试、调试工作流
- 16.5 Compose 常见故障排查

**本篇特色项目**

一条命令启动 Todo 平台完整本地环境。

**本篇能力验收标准**

能使用 Docker Compose 管理多服务开发环境，并能处理启动顺序、配置和数据持久化问题。

## 第 17 篇：容器运行原理

**大篇学习目标**

理解容器不是虚拟机，掌握 Namespace、Cgroups、UnionFS 等底层机制。

**章节列表**

- 17.1 容器与虚拟机的本质区别
- 17.2 Linux Namespace：进程、网络、挂载隔离
- 17.3 Cgroups：CPU、内存、IO 资源限制
- 17.4 UnionFS 与镜像分层原理
- 17.5 手动模拟一个简化容器

**本篇特色项目**

用 Linux 命令模拟容器隔离与资源限制。

**本篇能力验收标准**

能解释容器隔离、资源限制、镜像分层和容器进程模型。

## 第 18 篇：OCI、containerd、runc 与 CRI

**大篇学习目标**

理解 Kubernetes 底层如何调用容器运行时。

**章节列表**

- 18.1 OCI 规范与镜像格式
- 18.2 runc 与低层容器运行
- 18.3 containerd、shim 与容器生命周期
- 18.4 CRI、crictl 与 Kubernetes 运行时接口
- 18.5 Docker、containerd、nerdctl 的关系

**本篇特色项目**

使用 `nerdctl` 和 `crictl` 观察 Todo 平台容器运行状态。

**本篇能力验收标准**

能说明 Docker、containerd、runc、CRI、Kubernetes 之间的关系。

## 第 19 篇：Kubernetes 架构与集群搭建

**大篇学习目标**

建立 Kubernetes 整体架构认知，搭建可实验的本地集群。

**章节列表**

- 19.1 Kubernetes 解决什么问题
- 19.2 控制面组件：apiserver、scheduler、controller-manager、etcd
- 19.3 Node 组件：kubelet、kube-proxy、容器运行时
- 19.4 使用 kind / minikube 搭建集群
- 19.5 kubectl、kubeconfig 与资源操作基础

**本篇特色项目**

搭建本地 Kubernetes 集群并部署第一个测试应用。

**本篇能力验收标准**

能描述 Kubernetes 核心组件职责，能使用 kubectl 操作集群资源。

## 第 20 篇：Kubernetes 核心工作负载

**大篇学习目标**

掌握 Pod、Deployment、ReplicaSet、Job、CronJob 等核心对象。

**章节列表**

- 20.1 Pod 生命周期与容器状态
- 20.2 Deployment、ReplicaSet 与滚动更新
- 20.3 Job、CronJob 与批处理任务
- 20.4 DaemonSet 与节点级服务
- 20.5 Probe、Resource Request / Limit 与调度基础

**本篇特色项目**

将 Todo API 部署为 Kubernetes Deployment。

**本篇能力验收标准**

能部署、更新、回滚服务，能配置探针和资源限制。

## 第 21 篇：Kubernetes 服务发现与应用配置

**大篇学习目标**

掌握 Service、Ingress、ConfigMap、Secret 等应用运行基础对象。

**章节列表**

- 21.1 Service 类型与服务发现
- 21.2 Ingress 与 HTTP 流量入口
- 21.3 ConfigMap 配置管理
- 21.4 Secret 密钥管理
- 21.5 多环境配置与应用启动参数

**本篇特色项目**

为 Todo 平台配置 Service、Ingress、ConfigMap、Secret。

**本篇能力验收标准**

能让集群内外访问 Todo 服务，能安全管理配置和密钥。

## 第 22 篇：Kubernetes 网络

**大篇学习目标**

系统理解 Kubernetes 网络模型、CNI、Service、DNS、Ingress 和网络隔离。

**章节列表**

- 22.1 Kubernetes 网络模型与 Pod IP
- 22.2 CNI 插件原理与常见实现
- 22.3 CoreDNS 与集群内服务发现
- 22.4 kube-proxy、iptables / IPVS 与 Service 转发
- 22.5 NetworkPolicy 与服务隔离

**本篇特色项目**

为 Todo 平台设计网络访问路径和命名空间隔离策略。

**本篇能力验收标准**

能排查 Pod 到 Pod、Pod 到 Service、Ingress 到后端服务的网络问题。

## 第 23 篇：Kubernetes 存储

**大篇学习目标**

掌握 Kubernetes 中有状态服务、数据卷和动态存储供应机制。

**章节列表**

- 23.1 Volume、PV、PVC 基础
- 23.2 StorageClass 与动态供给
- 23.3 StatefulSet 与稳定网络标识
- 23.4 PostgreSQL 在 Kubernetes 中的部署方式
- 23.5 数据备份、恢复与迁移注意事项

**本篇特色项目**

将 Todo 平台数据库迁移到 Kubernetes 持久化存储方案。

**本篇能力验收标准**

能使用 PVC 持久化数据，能说明有状态服务在 Kubernetes 中的风险和边界。

## 第 24 篇：Kubernetes 安全

**大篇学习目标**

掌握 Kubernetes 权限、安全上下文、镜像安全和集群安全基线。

**章节列表**

- 24.1 ServiceAccount 与 RBAC
- 24.2 Role、ClusterRole、RoleBinding、ClusterRoleBinding
- 24.3 SecurityContext 与非 root 容器
- 24.4 Secret 安全、镜像拉取密钥与私有仓库
- 24.5 Pod Security、网络隔离与最小权限原则

**本篇特色项目**

为 Todo 平台制定最小权限部署方案。

**本篇能力验收标准**

能配置 RBAC、非 root 容器、安全上下文和基础安全策略。

## 第 25 篇：Helm 包管理

**大篇学习目标**

掌握 Helm Chart 编写和 Kubernetes 应用打包发布能力。

**章节列表**

- 25.1 Helm 解决什么问题
- 25.2 Chart 目录结构与模板语法
- 25.3 values.yaml 与多环境参数化
- 25.4 Helm install、upgrade、rollback
- 25.5 Chart 依赖、版本和发布规范

**本篇特色项目**

将 Todo 平台打包为 Helm Chart。

**本篇能力验收标准**

能使用 Helm 安装、升级、回滚 Todo 平台，并能维护 values 配置。

## 第 26 篇：Kustomize 多环境配置管理

**大篇学习目标**

掌握声明式补丁方式管理 dev、test、prod 环境差异。

**章节列表**

- 26.1 Kustomize 基础与 overlay 思想
- 26.2 base、overlay 与 patch
- 26.3 ConfigMapGenerator 与 SecretGenerator
- 26.4 镜像版本替换与环境差异管理
- 26.5 Helm 与 Kustomize 的使用边界

**本篇特色项目**

为 Todo 平台建立 dev、test、prod 三套环境配置。

**本篇能力验收标准**

能使用 Kustomize 管理多环境部署文件，并能解释与 Helm 的区别。

## 第 27 篇：CI/CD 自动化交付

**大篇学习目标**

掌握从代码提交到镜像构建、测试、发布的自动化流程。

**章节列表**

- 27.1 CI/CD 基本概念与流水线设计
- 27.2 GitHub Actions / GitLab CI 基础
- 27.3 自动执行 Go 测试和代码检查
- 27.4 自动构建并推送 Docker 镜像
- 27.5 自动部署到 Kubernetes 环境

**本篇特色项目**

为 Todo 平台建立完整 CI/CD 流水线。

**本篇能力验收标准**

能实现提交代码后自动测试、构建镜像、推送仓库并触发部署。

## 第 28 篇：GitOps 与 Argo CD

**大篇学习目标**

掌握声明式交付和 GitOps 运维模型。

**章节列表**

- 28.1 GitOps 的核心思想
- 28.2 Argo CD 安装与应用管理
- 28.3 Git 仓库作为部署事实来源
- 28.4 自动同步、手动同步、回滚与漂移检测
- 28.5 多环境、多集群发布策略

**本篇特色项目**

使用 Argo CD 管理 Todo 平台 Kubernetes 发布。

**本篇能力验收标准**

能通过 Git 变更驱动 Kubernetes 应用发布，并能处理同步失败和配置漂移。

## 第 29 篇：Prometheus 与 Grafana 监控

**大篇学习目标**

掌握指标采集、查询、告警和可视化能力。

**章节列表**

- 29.1 可观测性与指标体系设计
- 29.2 Prometheus 架构、ServiceMonitor 与抓取配置
- 29.3 Go 服务暴露业务指标
- 29.4 PromQL 基础与常用查询
- 29.5 Grafana 面板与告警规则

**本篇特色项目**

为 Todo 平台建立 API 延迟、错误率、QPS、资源使用监控面板。

**本篇能力验收标准**

能接入 Prometheus 指标，能编写 PromQL，能用 Grafana 展示服务状态。

## 第 30 篇：日志、ELK / Loki 与链路追踪

**大篇学习目标**

掌握日志采集、查询、分析和分布式链路追踪能力。

**章节列表**

- 30.1 日志规范与结构化日志
- 30.2 Loki、Promtail 与 Grafana 日志查询
- 30.3 ELK / EFK 架构与适用场景
- 30.4 OpenTelemetry 与 Trace 基础
- 30.5 日志、指标、链路追踪联合排障

**本篇特色项目**

为 Todo 平台接入日志采集和请求链路追踪。

**本篇能力验收标准**

能通过日志和 Trace 定位一次 API 请求的完整执行路径。

## 第 31 篇：Kubernetes 生产排障

**大篇学习目标**

掌握真实生产环境中 Kubernetes 常见故障的定位和修复方法。

**章节列表**

- 31.1 Pod Pending、CrashLoopBackOff、ImagePullBackOff 排查
- 31.2 OOMKilled、CPU Throttling 与资源瓶颈排查
- 31.3 Service、DNS、Ingress 网络故障排查
- 31.4 PVC、挂载失败和存储故障排查
- 31.5 节点异常、调度失败和集群组件排查

**本篇特色项目**

Todo 平台故障注入与恢复演练。

**本篇能力验收标准**

能根据事件、日志、指标、资源状态定位 Kubernetes 常见生产故障。

## 第 32 篇：Kubernetes API 扩展机制

**大篇学习目标**

理解 Kubernetes 为什么能扩展，以及 CRD 和 Controller 的基础关系。

**章节列表**

- 32.1 Kubernetes API Machinery 基础
- 32.2 声明式 API 与控制循环
- 32.3 Group、Version、Kind、Resource
- 32.4 CRD 的作用和基本结构
- 32.5 自定义资源状态设计思想

**本篇特色项目**

设计 Todo 平台的 `TodoApp` 自定义资源模型。

**本篇能力验收标准**

能解释 CRD、Controller、声明式 API 和状态回写的关系。

## 第 33 篇：CRD 设计与实践

**大篇学习目标**

掌握生产可用 CRD 的字段设计、版本管理和校验方式。

**章节列表**

- 33.1 CRD YAML 结构详解
- 33.2 OpenAPI Schema 与字段校验
- 33.3 spec、status 与 conditions 设计
- 33.4 CRD 版本升级与兼容性
- 33.5 使用 kubectl 操作自定义资源

**本篇特色项目**

实现 `TodoApp`、`TodoDatabase`、`TodoCache` 三个 CRD。

**本篇能力验收标准**

能设计结构清晰、可演进、可校验的 CRD。

## 第 34 篇：Controller、Informer 与 Workqueue

**大篇学习目标**

理解 Kubernetes Controller 的核心运行机制。

**章节列表**

- 34.1 Controller 控制循环原理
- 34.2 List-Watch 与 Informer 缓存机制
- 34.3 Workqueue、重试与限速队列
- 34.4 Reconcile 思想与幂等设计
- 34.5 Controller 常见异常和重复处理问题

**本篇特色项目**

手写简化版 Controller 监听 `TodoApp` 变化。

**本篇能力验收标准**

能解释 Informer、Workqueue、Reconcile、幂等和重试机制。

## 第 35 篇：Kubebuilder 与 controller-runtime

**大篇学习目标**

掌握使用主流工具开发 Kubernetes Operator 的基本流程。

**章节列表**

- 35.1 Kubebuilder 项目初始化
- 35.2 API 类型定义与代码生成
- 35.3 controller-runtime Client、Manager、Scheme
- 35.4 Reconciler 编写与资源创建
- 35.5 本地运行和部署 Controller

**本篇特色项目**

使用 Kubebuilder 开发 Todo 平台 Operator 初版。

**本篇能力验收标准**

能创建 Kubebuilder 项目，定义 API，编写 Reconciler 并部署到集群。

## 第 36 篇：Operator 高级机制

**大篇学习目标**

掌握生产级 Operator 必备机制：Webhook、Finalizer、OwnerReference、Status。

**章节列表**

- 36.1 OwnerReference 与资源归属管理
- 36.2 Finalizer 与删除前清理逻辑
- 36.3 Admission Webhook 默认值与校验
- 36.4 Status、Conditions 与状态回写
- 36.5 事件记录、重试策略与错误处理

**本篇特色项目**

让 Todo Operator 自动创建 Deployment、Service、ConfigMap，并维护状态。

**本篇能力验收标准**

能实现资源托管、删除清理、字段校验、默认值设置和状态回写。

## 第 37 篇：Operator 测试、发布与升级

**大篇学习目标**

掌握 Operator 的测试、镜像构建、部署发布和版本升级能力。

**章节列表**

- 37.1 envtest 与 Controller 单元测试
- 37.2 集成测试与 kind 环境验证
- 37.3 Operator 镜像构建与 RBAC 配置
- 37.4 Helm / Kustomize 发布 Operator
- 37.5 CRD 升级、兼容性与回滚策略

**本篇特色项目**

为 Todo Operator 建立测试和发布流水线。

**本篇能力验收标准**

能为 Operator 编写测试，能构建镜像、部署、升级和回滚 Operator。

## 第 38 篇：Operator 生产实践

**大篇学习目标**

掌握 Operator 在真实企业环境中的稳定性、安全性和可维护性设计。

**章节列表**

- 38.1 Operator 权限最小化与安全边界
- 38.2 多租户、命名空间隔离与资源配额
- 38.3 大规模资源监听与性能优化
- 38.4 Operator 监控、日志和告警
- 38.5 生产事故案例与设计反思

**本篇特色项目**

将 Todo Operator 升级为生产可用版本。

**本篇能力验收标准**

能从安全、性能、权限、监控、升级角度评估 Operator 是否可生产使用。

## 第 39 篇：综合项目集成实战

**大篇学习目标**

将前面所有阶段成果整合成完整云原生项目体系。

**章节列表**

- 39.1 项目总架构设计与仓库拆分
- 39.2 本地开发环境、Compose 环境与 Kubernetes 环境统一
- 39.3 CI/CD、GitOps、Helm、Kustomize 集成
- 39.4 监控、日志、链路追踪集成验证
- 39.5 Operator 一键交付完整 Todo 平台

**本篇特色项目**

完成 `Cloud Native Todo Platform` 全链路集成。

**本篇能力验收标准**

能从零部署完整平台，能解释每个组件的作用、依赖关系和发布流程。

## 第 40 篇：职业能力验收与面试准备

**大篇学习目标**

将课程能力转化为简历项目、面试表达和岗位实战能力。

**章节列表**

- 40.1 Go 后端岗位能力梳理
- 40.2 DevOps / Kubernetes 运维岗位能力梳理
- 40.3 云原生平台工程岗位能力梳理
- 40.4 Operator 开发岗位能力梳理
- 40.5 综合项目答辩、简历包装与面试题复盘

**本篇特色项目**

整理最终作品集、项目文档、架构图、部署说明和面试讲解稿。

**本篇能力验收标准**

能清晰讲解项目架构、技术选型、排障经验、生产注意事项和个人贡献。

## 目录规模统计

- 大篇数量：40 篇
- 章节数量：200 章
- 阶段项目数量：40 个
- 综合项目主线：Cloud Native Todo Platform

