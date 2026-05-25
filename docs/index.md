# 从 Go、Docker、Kubernetes 到 Operator

欢迎来到这套面向真实岗位能力的云原生系统教程。

本教程以 **Cloud Native Todo Platform** 为项目主线，带你从 Linux、Git、Shell 基础开始，逐步完成 Go 后端开发、Docker 容器化、Kubernetes 部署、CI/CD、GitOps、监控日志、生产排障，最后进入 CRD、Controller、Kubebuilder 与 Operator 开发。

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

```text
Linux / Git / Shell
  -> Go 语言基础
  -> Go Web API
  -> PostgreSQL / Redis
  -> Docker / Dockerfile / Docker Compose
  -> 容器运行原理
  -> Kubernetes 架构与核心对象
  -> Kubernetes 网络 / 存储 / 安全 / 排障
  -> Helm / CI/CD / GitOps
  -> Prometheus / Grafana / 日志 / 链路追踪
  -> Kubernetes API 扩展
  -> CRD / Controller / Kubebuilder / Operator
  -> 综合项目交付
```

## 当前已完成章节

- [第一篇：Linux、Git 与 Shell 基础](chapters/01-linux-git-shell/index.md)

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

- 编写 Go 语言基础与 Todo CLI 章节。
- 搭建 Go Web API 项目骨架。
- 引入 PostgreSQL 和 Redis。
- 编写 Dockerfile 与 Docker Compose 本地环境。
- 将 Todo API 部署到 Kubernetes。

