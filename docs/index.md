---
hide:
  - navigation
  - toc
---

<style>
  .md-grid {
    max-width: 61rem;
  }

  .md-main__inner {
    max-width: 61rem;
    margin-left: auto;
    margin-right: auto;
  }

  .md-content__inner {
    margin-left: 1.2rem;
    margin-right: 1.2rem;
  }
</style>

# 从 Go、Docker、Kubernetes 到 Operator

欢迎来到这套面向真实岗位能力的云原生系统教程。

本教程以 **Cloud Native Todo Platform** 为项目主线，带你从课程导学与开发环境准备开始，逐步完成 Linux / Git / Shell 基础、Go 后端开发、Docker 容器化、Kubernetes 部署、CI/CD、GitOps、监控日志、生产排障，最后进入 CRD、Controller、Kubebuilder 与 Operator 开发。

## 教程定位

这不是一套只讲概念的速成笔记，而是一套职业能力培养课程。

课程目标是让学习者能够真正理解并落地：

- Go 后端服务如何设计、开发、测试和运行。
- Docker 镜像如何构建、优化和发布。
- Kubernetes 应用如何部署、暴露、扩缩容和排障。
- 云原生系统如何接入 CI/CD、GitOps、监控、日志和安全治理。
- Operator 如何通过 Kubernetes API 扩展机制自动化管理应用生命周期。

## 适合人群

- Linux 基础薄弱或中等的新手。
- 想系统学习 Go 后端开发的学习者。
- 想掌握 Docker、Kubernetes、Helm、CI/CD 的开发者。
- 想从传统运维转向 DevOps、SRE 或云原生平台工程的人。
- 想学习 CRD、Controller、Operator 开发的工程师。

## 学完后可以胜任的工作

完成课程后，学习者应具备以下工作能力：

- 独立开发 Go RESTful API 服务。
- 编写 Dockerfile 和 Docker Compose 本地开发环境。
- 将服务部署到 Kubernetes，并配置 Service、Ingress、ConfigMap、Secret、PVC、HPA。
- 使用 Helm 和多环境配置管理应用发布。
- 搭建 CI/CD 与 GitOps 发布链路。
- 接入 Prometheus、Grafana、Loki / ELK 等可观测系统。
- 排查 Kubernetes 常见生产故障。
- 设计 CRD 并开发 Controller / Operator。

## 完整学习路径

本课程共 **40 大篇，200 个章节**，分为 7 个学习阶段。

当前已完成 **阶段一：基础环境与工具链**，并开始进入 **阶段二：Go 语言与后端开发**。后续阶段会继续围绕 **Cloud Native Todo Platform** 项目逐步展开。

<details open markdown="1">
<summary><strong>阶段一：基础环境与工具链（第 1-6 篇 + 出版附录，已完成）</strong></summary>

掌握 Linux 命令、Git 协作、Shell 脚本等云原生开发必备基础。

- [第 1 篇：课程导学与开发环境准备](chapters/stage-01-foundation/01-course-guide-env.md)
- [第 2 篇：Linux 文件系统与命令基础](chapters/stage-01-foundation/02-linux-filesystem.md)
- [第 3 篇：Linux 进程、服务与软件管理](chapters/stage-01-foundation/03-linux-process.md)
- [第 4 篇：Linux 网络基础与排障](chapters/stage-01-foundation/04-linux-network.md)
- [第 5 篇：Git 基础与团队协作](chapters/stage-01-foundation/05-git-basics.md)
- [第 6 篇：Shell 脚本与自动化基础](chapters/stage-01-foundation/06-shell-scripting.md)
- [附录 A：基础环境作品集验收](chapters/stage-01-foundation/stage-01-acceptance.md)
- [附录 B：命令速查与排障手册](chapters/stage-01-foundation/stage-01-cheatsheet-troubleshooting.md)

</details>

<details markdown="1">
<summary><strong>阶段二：Go 语言与后端开发（第 7-13 篇，第 7 篇已完成）</strong></summary>

从 Go 基础语法到 Web API、数据库、Redis、并发编程，完成生产级后端服务开发。

- [第 7 篇：Go 语言基础](chapters/stage-02-go-backend/07-go-basics.md)
- 第 8 篇：Go 进阶与并发编程
- 第 9 篇：Go 工程化与测试
- 第 10 篇：Go Web API 开发
- 第 11 篇：数据库与持久化开发
- 第 12 篇：Redis、缓存与异步任务
- 第 13 篇：Go 后端生产化能力

</details>

<details markdown="1">
<summary><strong>阶段三：Docker 容器技术（第 14-18 篇，规划中）</strong></summary>

掌握 Docker 使用、Dockerfile 编写、容器原理和运行时机制。

- 第 14 篇：Docker 基础
- 第 15 篇：Dockerfile 与镜像构建
- 第 16 篇：Docker Compose 本地编排
- 第 17 篇：容器运行原理
- 第 18 篇：OCI、containerd、runc 与 CRI

</details>

<details markdown="1">
<summary><strong>阶段四：Kubernetes 核心能力（第 19-26 篇，规划中）</strong></summary>

系统学习 Kubernetes 架构、工作负载、网络、存储、安全、Helm 和 Kustomize。

- 第 19 篇：Kubernetes 架构与集群搭建
- 第 20 篇：Kubernetes 核心工作负载
- 第 21 篇：Kubernetes 服务发现与应用配置
- 第 22 篇：Kubernetes 网络
- 第 23 篇：Kubernetes 存储
- 第 24 篇：Kubernetes 安全
- 第 25 篇：Helm 包管理
- 第 26 篇：Kustomize 多环境配置管理

</details>

<details markdown="1">
<summary><strong>阶段五：云原生交付与可观测（第 27-31 篇，规划中）</strong></summary>

建立 CI/CD、GitOps、监控、日志、链路追踪和生产排障能力。

- 第 27 篇：CI/CD 自动化交付
- 第 28 篇：GitOps 与 Argo CD
- 第 29 篇：Prometheus 与 Grafana 监控
- 第 30 篇：日志、ELK / Loki 与链路追踪
- 第 31 篇：Kubernetes 生产排障

</details>

<details markdown="1">
<summary><strong>阶段六：Operator 开发与平台工程（第 32-38 篇，规划中）</strong></summary>

深入 Kubernetes API 扩展机制，掌握 CRD、Controller、Kubebuilder 和 Operator 开发。

- 第 32 篇：Kubernetes API 扩展机制
- 第 33 篇：CRD 设计与实践
- 第 34 篇：Controller、Informer 与 Workqueue
- 第 35 篇：Kubebuilder 与 controller-runtime
- 第 36 篇：Operator 高级机制
- 第 37 篇：Operator 测试、发布与升级
- 第 38 篇：Operator 生产实践

</details>

<details markdown="1">
<summary><strong>阶段七：综合项目与职业能力（第 39-40 篇，规划中）</strong></summary>

完成 Cloud Native Todo Platform 全链路集成，准备简历和面试。

- 第 39 篇：综合项目集成实战
- 第 40 篇：职业能力验收与面试准备

</details>

## 如何本地运行

=== "Linux / macOS"

    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    mkdocs serve
    ```

=== "Windows PowerShell"

    ```powershell
    py -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    mkdocs serve
    ```

启动后访问：

```text
http://127.0.0.1:8000
```

## 下一步计划

- 继续进入 Go 并发编程，增强 Todo CLI 的异步处理和并发安全能力。
- 搭建 Go Web API 项目骨架，并逐步接入测试、数据库和缓存。
- 引入 Docker、Kubernetes 与 Operator 实践内容，将 Todo 平台推进到云原生交付形态。
