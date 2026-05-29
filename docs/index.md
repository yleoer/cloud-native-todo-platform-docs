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

本教程以 **Cloud Native Todo Platform** 为项目主线，带你从课程导学与开发环境准备开始，逐步完成 YAML、Linux / Git / Shell 基础、Go 后端开发、Docker 容器化、Kubernetes 应用交付、CI/CD、GitOps、监控日志、链路追踪、生产排障，最后进入 CRD、Controller、Kubebuilder 与 Operator 开发。

## 教程定位

这不是一套只讲概念的速成笔记，而是一套职业能力培养课程。

课程目标是让学习者能够真正理解并落地：

- Go 后端服务如何设计、开发、测试和运行。
- Docker 镜像如何构建、优化和发布。
- Kubernetes 应用如何部署、暴露、配置、存储、扩缩容和排障。
- 云原生系统如何接入 CI/CD、GitOps、监控、日志、链路追踪和安全治理。
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
- 使用 Helm 4 和 Kustomize 管理多环境应用发布。
- 搭建 CI/CD 与 GitOps 发布链路。
- 接入 Prometheus、Grafana、Loki / ELK 等可观测系统。
- 排查 Kubernetes 常见生产故障。
- 设计 CRD 并开发 Controller / Operator。

## 完整学习路径

本课程共 **42 大篇，约 230 个章节**，分为 6 个学习阶段。

新版设计路线已更新为 **6 个阶段**。当前站点已发布阶段一至阶段五，并已进入阶段六平台工程与 Operator 能力。

<details open markdown="1">
<summary><strong>阶段一：基础能力（第 1-6 篇，已发布）</strong></summary>

掌握环境准备、YAML、Linux 文件/进程/网络、Git 协作和 Shell 自动化。

- [第 1 篇：课程导学与开发环境准备 [A]](chapters/stage-01-foundation/01-course-guide-env.md)
- [第 2 篇：Linux 文件系统与命令基础 [A]](chapters/stage-01-foundation/02-linux-filesystem.md)
- [第 3 篇：Linux 进程、服务与软件管理 [A]](chapters/stage-01-foundation/03-linux-process.md)
- [第 4 篇：Linux 网络基础与排障 [A]](chapters/stage-01-foundation/04-linux-network.md)
- [第 5 篇：Git 基础与团队协作 [A]](chapters/stage-01-foundation/05-git-basics.md)
- [第 6 篇：Shell 脚本与自动化基础 [A]](chapters/stage-01-foundation/06-shell-scripting.md)
- [附录 A：基础环境作品集验收](chapters/stage-01-foundation/stage-01-acceptance.md)
- [附录 B：命令速查与排障手册](chapters/stage-01-foundation/stage-01-cheatsheet-troubleshooting.md)

</details>

<details markdown="1">
<summary><strong>阶段二：Go 后端开发（新版规划第 7-14 篇，当前已发布后端章节）</strong></summary>

从 Go 基础到工程化、net/http、Gin、并发、PostgreSQL、Redis 和后端生产化。

- [第 7 篇：Go 语言基础](chapters/stage-02-go-backend/07-go-basics.md)
- [第 8 篇：Go 工程化与测试](chapters/stage-02-go-backend/08-go-engineering-testing.md)
- [第 9 篇：Go net/http 标准库与 HTTP 服务](chapters/stage-02-go-backend/09-go-net-http.md)
- [第 10 篇：Go Web API 开发——Gin 框架](chapters/stage-02-go-backend/10-go-web-api.md)
- [第 11 篇：Go 并发编程](chapters/stage-02-go-backend/11-go-concurrency.md)
- [第 12 篇：数据库与持久化开发](chapters/stage-02-go-backend/12-database.md)
- [第 13 篇：Redis、缓存与异步任务](chapters/stage-02-go-backend/13-redis-cache.md)
- [第 14 篇：Go 后端生产化能力](chapters/stage-02-go-backend/14-go-production.md)
- [附录 A：Go 后端项目综合验收](chapters/stage-02-go-backend/stage-02-acceptance.md)

</details>

<details markdown="1">
<summary><strong>阶段三：容器化能力（新版规划第 15-19 篇，当前已发布 Docker 章节）</strong></summary>

掌握 Docker 基础、Dockerfile、Compose、容器原理、OCI、containerd、runc 和 CRI。

- [第 15 篇：Docker 基础](chapters/stage-03-docker/15-docker-basics.md)
- [第 16 篇：Dockerfile 与镜像构建](chapters/stage-03-docker/16-dockerfile.md)
- [第 17 篇：Docker Compose 本地编排](chapters/stage-03-docker/17-docker-compose.md)
- [第 18 篇：容器运行原理](chapters/stage-03-docker/18-container-internals.md)
- [第 19 篇：OCI、containerd、runc 与 CRI](chapters/stage-03-docker/19-oci-containerd-cri.md)
- [附录 A：Docker 容器技术综合验收](chapters/stage-03-docker/stage-03-acceptance.md)
- [附录 B：Docker 速查与排障手册](chapters/stage-03-docker/stage-03-cheatsheet-troubleshooting.md)

</details>

<details markdown="1">
<summary><strong>阶段四：Kubernetes 应用交付（第 20-28 篇，当前已发布第 28 篇 + 阶段验收）</strong></summary>

系统学习 Kubernetes 架构、工作负载、Service / Ingress / Gateway API、配置、存储、网络、安全、Helm 4 和 Kustomize。

- [第 20 篇：Kubernetes 架构与集群搭建](chapters/stage-04-kubernetes/20-k8s-architecture.md)
- [第 21 篇：Kubernetes 核心工作负载](chapters/stage-04-kubernetes/21-k8s-workloads.md)
- [第 22 篇：Service、Ingress 与流量入口](chapters/stage-04-kubernetes/22-k8s-service-ingress.md)
- [第 23 篇：ConfigMap、Secret 与配置管理](chapters/stage-04-kubernetes/23-k8s-config-secret.md)
- [第 24 篇：Kubernetes 存储](chapters/stage-04-kubernetes/24-k8s-storage.md)
- [第 25 篇：Kubernetes 网络原理](chapters/stage-04-kubernetes/25-k8s-networking.md)
- [第 26 篇：Kubernetes 安全](chapters/stage-04-kubernetes/26-k8s-security.md)
- [第 27 篇：Helm 4 包管理](chapters/stage-04-kubernetes/27-helm4.md)
- [第 28 篇：Kustomize 多环境配置管理](chapters/stage-04-kubernetes/28-kustomize.md)
- [阶段四附录 A：Kubernetes 应用交付综合验收](chapters/stage-04-kubernetes/stage-04-acceptance.md)

</details>

<details markdown="1">
<summary><strong>阶段五：生产工程能力（第 29-33 篇）</strong></summary>

建立 CI/CD、GitOps、Prometheus / Grafana、Loki、OpenTelemetry 和 Kubernetes 生产排障能力。

- [第 29 篇：CI/CD 自动化交付](chapters/stage-05-production-engineering/29-cicd.md)
- [第 30 篇：GitOps 与 Argo CD](chapters/stage-05-production-engineering/30-gitops-argocd.md)
- [第 31 篇：Prometheus 与 Grafana 监控](chapters/stage-05-production-engineering/31-prometheus-grafana.md)
- [第 32 篇：日志与 OpenTelemetry 链路追踪](chapters/stage-05-production-engineering/32-logging-opentelemetry.md)
- [第 33 篇：Kubernetes 生产排障](chapters/stage-05-production-engineering/33-k8s-troubleshooting.md)
- [附录 A：生产工程作品集验收](chapters/stage-05-production-engineering/stage-05-acceptance.md)

</details>

<details markdown="1">
<summary><strong>阶段六：平台工程与 Operator 能力（第 34-42 篇，更新中）</strong></summary>

深入 Kubernetes API Machinery、CRD、手写 Controller、Kubebuilder、Webhook、Finalizer、Operator 测试发布、生产实践和最终集成。

- [第 34 篇：Kubernetes API 扩展机制 [B]](chapters/stage-06-platform-operator/34-k8s-api-extension.md)
- [第 35 篇：CRD 设计与实践 [C]](chapters/stage-06-platform-operator/35-crd-design.md)
- [第 36 篇：Controller 机制：Informer 与 Workqueue [B]](chapters/stage-06-platform-operator/36-controller-informer-workqueue.md)
- [第 37 篇：手写简化版 Controller [C]](chapters/stage-06-platform-operator/37-handwritten-controller.md)
- [第 38 篇：Kubebuilder 入门 [C]](chapters/stage-06-platform-operator/38-kubebuilder.md)
- [第 39 篇：Operator 高级机制 [C]](chapters/stage-06-platform-operator/39-operator-advanced.md)
- [第 40 篇：Operator 测试、发布与升级 [C]](chapters/stage-06-platform-operator/40-operator-test-release.md)
- 第 41 篇：Operator 生产实践
- 第 42 篇：综合集成与职业能力验收

</details>

## 如何本地运行

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

启动后访问：

```text
http://127.0.0.1:8000
```

## 下一步计划

- 进入第 41 篇 Operator 生产实践，继续收敛 RBAC、Watch 范围、资源限制和可观测性。
- 把第 40 篇的测试发布流水线接入生产化检查：发布前验证、发布后 smoke test、回滚演练和告警。
- 延续阶段六产物，逐步把 TodoApp Operator 推进到可生产运维、可规模化管理的版本。
