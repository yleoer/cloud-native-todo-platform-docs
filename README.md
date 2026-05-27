# 从 Go、Docker、Kubernetes 到 Operator

一套面向中高级云原生工程能力的系统教程，共 **42 大篇，约 230 个章节**，围绕 **Cloud Native Todo Platform** 项目主线展开。

## 📚 课程特色

- **系统性**：从 Linux 基础到 Operator 开发，完整覆盖云原生技术栈
- **实战性**：每个阶段都有配套项目，最终完成完整的云原生平台
- **渐进性**：6 个学习阶段，按照“先会用，再深入”的顺序逐步推进
- **可复现性**：锁定 Go 1.26、Docker 29、Kubernetes 1.36、Helm 4 等课程基线
- **职业导向**：对标真实岗位能力，包含实验、排障、面试和作品集验收

## 🎯 学习路径

新版课程设计为 **6 个学习阶段、42 大篇、约 230 章**。当前站点已发布阶段一至阶段三的现有课程内容；后续会按新版设计继续推进 Kubernetes、生产工程和 Operator 能力。

<details open>
<summary><strong>阶段一：基础能力（第 1-6 篇，已发布）</strong></summary>

环境准备、YAML、Linux 文件/进程/网络、Git 协作和 Shell 自动化。

- [第 1 篇：课程导学与开发环境准备 [A]](docs/chapters/stage-01-foundation/01-course-guide-env.md)
- [第 2 篇：Linux 文件系统与命令基础 [A]](docs/chapters/stage-01-foundation/02-linux-filesystem.md)
- [第 3 篇：Linux 进程、服务与软件管理 [A]](docs/chapters/stage-01-foundation/03-linux-process.md)
- [第 4 篇：Linux 网络基础与排障 [A]](docs/chapters/stage-01-foundation/04-linux-network.md)
- [第 5 篇：Git 基础与团队协作](docs/chapters/stage-01-foundation/05-git-basics.md)
- [第 6 篇：Shell 脚本与自动化基础](docs/chapters/stage-01-foundation/06-shell-scripting.md)
- [附录 A：基础环境作品集验收](docs/chapters/stage-01-foundation/stage-01-acceptance.md)
- [附录 B：命令速查与排障手册](docs/chapters/stage-01-foundation/stage-01-cheatsheet-troubleshooting.md)

</details>

<details>
<summary><strong>阶段二：Go 后端开发（新版规划第 7-14 篇，当前已发布后端章节）</strong></summary>

从 Go 基础到工程化、net/http、Gin、并发、PostgreSQL、Redis 和后端生产化。

- [第 7 篇：Go 语言基础](docs/chapters/stage-02-go-backend/07-go-basics.md)
- [第 8 篇：Go 进阶与并发编程](docs/chapters/stage-02-go-backend/08-go-concurrency.md)
- [第 9 篇：Go 工程化与测试](docs/chapters/stage-02-go-backend/09-go-engineering.md)
- [第 10 篇：Go Web API 开发](docs/chapters/stage-02-go-backend/10-go-web-api.md)
- [第 11 篇：数据库与持久化开发](docs/chapters/stage-02-go-backend/11-database.md)
- [第 12 篇：Redis、缓存与异步任务](docs/chapters/stage-02-go-backend/12-redis-cache.md)
- [第 13 篇：Go 后端生产化能力](docs/chapters/stage-02-go-backend/13-go-production.md)
- [附录 A：Go 后端项目综合验收](docs/chapters/stage-02-go-backend/stage-02-acceptance.md)

</details>

<details>
<summary><strong>阶段三：容器化能力（新版规划第 15-19 篇，当前已发布 Docker 章节）</strong></summary>

Docker 基础、Dockerfile、Compose、容器原理、OCI、containerd、runc 和 CRI。

- [第 14 篇：Docker 基础](docs/chapters/stage-03-docker/14-docker-basics.md)
- [第 15 篇：Dockerfile 与镜像构建](docs/chapters/stage-03-docker/15-dockerfile.md)
- [第 16 篇：Docker Compose 本地编排](docs/chapters/stage-03-docker/16-docker-compose.md)
- [第 17 篇：容器运行原理](docs/chapters/stage-03-docker/17-container-internals.md)
- [第 18 篇：OCI、containerd、runc 与 CRI](docs/chapters/stage-03-docker/18-container-runtime.md)
- [附录 A：Docker 容器技术综合验收](docs/chapters/stage-03-docker/stage-03-acceptance.md)
- [附录 B：Docker 速查与排障手册](docs/chapters/stage-03-docker/stage-03-cheatsheet-troubleshooting.md)

</details>

<details>
<summary><strong>阶段四：Kubernetes 应用交付（第 20-28 篇，规划中）</strong></summary>

Kubernetes 架构、工作负载、Service / Ingress / Gateway API、配置、存储、网络、安全、Helm 4 和 Kustomize。

- 第 20 篇：Kubernetes 架构与集群搭建
- 第 21 篇：Kubernetes 核心工作负载
- 第 22 篇：Service、Ingress 与流量入口
- 第 23 篇：ConfigMap、Secret 与配置管理
- 第 24 篇：Kubernetes 存储
- 第 25 篇：Kubernetes 网络原理
- 第 26 篇：Kubernetes 安全
- 第 27 篇：Helm 4 包管理
- 第 28 篇：Kustomize 多环境配置管理

</details>

<details>
<summary><strong>阶段五：生产工程能力（第 29-33 篇，规划中）</strong></summary>

CI/CD、GitOps、Prometheus / Grafana、Loki、OpenTelemetry 和 Kubernetes 生产排障。

- 第 29 篇：CI/CD 自动化交付
- 第 30 篇：GitOps 与 Argo CD
- 第 31 篇：Prometheus 与 Grafana 监控
- 第 32 篇：日志与 OpenTelemetry 链路追踪
- 第 33 篇：Kubernetes 生产排障

</details>

<details>
<summary><strong>阶段六：平台工程与 Operator 能力（第 34-42 篇，规划中）</strong></summary>

Kubernetes API Machinery、CRD、手写 Controller、Kubebuilder、Webhook、Finalizer、Operator 测试发布、生产实践和最终集成。

- 第 34 篇：Kubernetes API 扩展机制
- 第 35 篇：CRD 设计与实践
- 第 36 篇：Controller 机制：Informer 与 Workqueue
- 第 37 篇：手写简化版 Controller
- 第 38 篇：Kubebuilder 入门
- 第 39 篇：Operator 高级机制
- 第 40 篇：Operator 测试、发布与升级
- 第 41 篇：Operator 生产实践
- 第 42 篇：综合集成与职业能力验收

</details>

## 🚀 快速开始

### 在线阅读

访问：[https://docs.yxuefeng.com/](https://docs.yxuefeng.com/)

### 本地运行

<details open>
<summary><strong>Linux / macOS</strong></summary>

```bash
# 克隆仓库
git clone https://github.com/yleoer/cloud-native-todo-platform-docs.git
cd cloud-native-todo-platform-docs

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
mkdocs serve
```

</details>

<details>
<summary><strong>Windows PowerShell</strong></summary>

```powershell
# 克隆仓库
git clone https://github.com/yleoer/cloud-native-todo-platform-docs.git
cd cloud-native-todo-platform-docs

# 创建虚拟环境
py -m venv .venv
.\.venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
mkdocs serve
```

</details>

启动后访问：`http://127.0.0.1:8000`

## 📖 文档结构

```
docs/
├── index.md                    # 首页
├── chapters/                   # 课程章节
│   ├── stage-01-foundation/   # 阶段一：基础能力
│   │   ├── 01-course-guide-env.md   # 第 1 篇：课程导学与开发环境准备 [A]
│   │   ├── 02-linux-filesystem.md   # 第 2 篇：Linux 文件系统与命令基础 [A]
│   │   ├── 03-linux-process.md      # 第 3 篇：Linux 进程、服务与软件管理 [A]
│   │   ├── 04-linux-network.md      # 第 4 篇：Linux 网络基础与排障 [A]
│   │   ├── 05-git-basics.md         # 第 5 篇：Git 基础与团队协作
│   │   ├── 06-shell-scripting.md    # 第 6 篇：Shell 脚本与自动化基础
│   │   ├── stage-01-acceptance.md   # 阶段一附录 A：作品集验收
│   │   └── stage-01-cheatsheet-troubleshooting.md # 阶段一附录 B：速查与排障
│   ├── stage-02-go-backend/    # 阶段二：Go 语言与后端开发
│   │   ├── 07-go-basics.md          # 第 7 篇：Go 语言基础
│   │   ├── 08-go-concurrency.md     # 第 8 篇：Go 进阶与并发编程
│   │   ├── 09-go-engineering.md     # 第 9 篇：Go 工程化与测试
│   │   ├── 10-go-web-api.md         # 第 10 篇：Go Web API 开发
│   │   ├── 11-database.md           # 第 11 篇：数据库与持久化开发
│   │   ├── 12-redis-cache.md        # 第 12 篇：Redis、缓存与异步任务
│   │   ├── 13-go-production.md      # 第 13 篇：Go 后端生产化能力
│   │   └── stage-02-acceptance.md   # 阶段二附录 A：Go 后端项目综合验收
│   ├── stage-03-docker/        # 阶段三：容器化能力
│   │   ├── 14-docker-basics.md      # 第 14 篇：Docker 基础
│   │   ├── 15-dockerfile.md         # 第 15 篇：Dockerfile 与镜像构建
│   │   ├── 16-docker-compose.md     # 第 16 篇：Docker Compose 本地编排
│   │   ├── 17-container-internals.md # 第 17 篇：容器运行原理
│   │   ├── 18-container-runtime.md   # 第 18 篇：OCI、containerd、runc 与 CRI
│   │   ├── stage-03-acceptance.md    # 阶段三附录 A：综合验收
│   │   └── stage-03-cheatsheet-troubleshooting.md # 阶段三附录 B：速查与排障
│   └── ...                     # 后续阶段章节（待完成）
├── projects/                   # 项目实战
├── labs/                       # 实验索引
├── troubleshooting/           # 排障手册
├── interviews/                # 面试题库
├── course-design/             # 课程设计文档
├── stylesheets/               # 自定义样式
├── javascripts/               # 自定义脚本
└── includes/                  # 公共内容（缩写等）
```

## 🎓 适合人群

- Linux 基础薄弱或中等的新手
- 想系统学习 Go 后端开发的学习者
- 想掌握 Docker、Kubernetes、Helm、CI/CD 的开发者
- 想从传统运维转向 DevOps、SRE 或云原生平台工程的人
- 想学习 CRD、Controller、Operator 开发的工程师

## 💼 学完后可以胜任的工作

- **Go 后端开发工程师**：独立开发 RESTful API 服务
- **DevOps 工程师**：搭建 CI/CD、GitOps 流程，管理 K8s 集群
- **云原生平台工程师**：设计云原生架构，接入可观测系统
- **Kubernetes Operator 开发工程师**：开发 CRD、Controller、Operator
- **SRE 工程师**：排查生产故障，优化系统可靠性

## 🛠️ 技术栈

- **语言**：Go
- **容器**：Docker、containerd、runc
- **入口**：Traefik Ingress Controller、Gateway API
- **编排**：Kubernetes 1.36、Helm 4、Kustomize
- **数据库**：PostgreSQL 18、Redis 8.2
- **CI/CD**：GitHub Actions、GitLab CI、Argo CD
- **监控**：Prometheus、Grafana、Loki、OpenTelemetry
- **开发框架**：Gin 1.12、GORM、Kubebuilder

## 🔧 构建与部署

### 本地构建

```bash
mkdocs build
```

构建产物生成到 `site/` 目录。

### GitHub Pages 自动部署

本仓库配置了 GitHub Actions 自动部署：

1. 推送到 `main` 分支
2. 自动执行 `.github/workflows/deploy-docs.yml`
3. 构建并部署到 GitHub Pages
4. 根据是否配置自定义域名选择访问地址

<details open>
<summary><strong>不配置自定义域名</strong></summary>

如果不配置自定义域名，GitHub Pages 默认访问地址通常是：

```text
https://<GitHub用户名>.github.io/<仓库名>/
```

以本仓库为例，默认地址可能是：

```text
https://yleoer.github.io/cloud-native-todo-platform-docs/
```

GitHub Pages 设置：

1. 进入 `Settings -> Pages`
2. 选择 `GitHub Actions` 作为部署源
3. 不填写 `Custom domain`
4. 等待 GitHub Actions 部署完成后访问默认 Pages 地址

</details>

<details>
<summary><strong>自定义域名配置</strong></summary>

DNS 配置：

```
类型: CNAME
主机记录: docs
记录值: <GitHub用户名>.github.io
```

GitHub Pages 设置：

1. 进入 `Settings -> Pages`
2. 选择 `GitHub Actions` 作为部署源
3. 设置 Custom domain 为 `docs.yxuefeng.com`
4. 启用 `Enforce HTTPS`

</details>

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

你可以在遵守许可证条款的前提下自由使用、复制、修改、合并、发布、分发和再授权本项目内容。使用时需要保留原始版权声明和许可证声明。

本项目按 “AS IS” 方式提供，不附带任何明示或暗示担保。

## 🙏 致谢

感谢所有为云原生技术发展做出贡献的开源社区和开发者。

感谢 Codex 在课程内容编写、文档结构调整和本地验证过程中的协作支持。

---

⭐ 如果这个项目对你有帮助，欢迎 Star 支持！

