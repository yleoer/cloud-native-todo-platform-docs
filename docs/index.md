---
hide:
  - navigation
  - toc
---

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

本课程共 **40 大篇，200 个章节**，分为 7 个学习阶段：

### 阶段一：基础环境与工具链（第 1-6 篇）
掌握 Linux 命令、Git 协作、Shell 脚本等云原生开发必备基础。

### 阶段二：Go 语言与后端开发（第 7-13 篇）
从 Go 基础语法到 Web API、数据库、Redis、并发编程，完成生产级后端服务开发。

### 阶段三：Docker 容器技术（第 14-18 篇）
掌握 Docker 使用、Dockerfile 编写、容器原理和运行时机制。

### 阶段四：Kubernetes 核心能力（第 19-26 篇）
系统学习 Kubernetes 架构、工作负载、网络、存储、安全、Helm 和 Kustomize。

### 阶段五：云原生交付与可观测（第 27-31 篇）
建立 CI/CD、GitOps、监控、日志、链路追踪和生产排障能力。

### 阶段六：Operator 开发与平台工程（第 32-38 篇）
深入 Kubernetes API 扩展机制，掌握 CRD、Controller、Kubebuilder 和 Operator 开发。

### 阶段七：综合项目与职业能力（第 39-40 篇）
完成 Cloud Native Todo Platform 全链路集成，准备简历和面试。

## 快速开始

- [查看完整学习路线](roadmap.md)
- [开始第一篇：课程导学与开发环境准备](chapters/01-course-guide-env/index.md)
- [查看完整课程目录（40 篇 200 章）](course-design/02-full-curriculum.md)

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

## 如何参与维护

新增章节时建议遵循：

1. 在 `docs/chapters/` 下创建对应目录。
2. 每章使用 `index.md` 作为入口。
3. 更新 `mkdocs.yml` 中的 `nav`。
4. 本地执行 `mkdocs build --strict`。
5. 确认构建通过后提交并推送。

## 下一步计划

- 编写 Linux 文件系统与命令基础章节。
- 编写 Git 与 Shell 自动化基础章节。
- 编写 Go 语言基础与 Todo CLI 章节。
- 搭建 Go Web API 项目骨架。
- 引入 Docker、Kubernetes 与 Operator 实践内容。
