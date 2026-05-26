# 从 Go、Docker、Kubernetes 到 Operator

一套面向中高级云原生工程能力的系统教程，共 **40 大篇，200 个章节**，围绕 **Cloud Native Todo Platform** 项目主线展开。

## 📚 课程特色

- **系统性**：从 Linux 基础到 Operator 开发，完整覆盖云原生技术栈
- **实战性**：每个阶段都有配套项目，最终完成完整的云原生平台
- **渐进性**：7 个学习阶段，循序渐进，适合不同基础的学习者
- **职业导向**：对标真实岗位能力，包含面试题库和职业规划

## 🎯 学习路径

### 阶段一：基础环境与工具链（第 1-6 篇）
Linux 命令、Git 协作、Shell 脚本等云原生开发必备基础

### 阶段二：Go 语言与后端开发（第 7-13 篇）
从 Go 基础到生产级 Web API、数据库、Redis、并发编程

### 阶段三：Docker 容器技术（第 14-18 篇）
Docker 使用、Dockerfile 编写、容器原理和运行时机制

### 阶段四：Kubernetes 核心能力（第 19-26 篇）
K8s 架构、工作负载、网络、存储、安全、Helm、Kustomize

### 阶段五：云原生交付与可观测（第 27-31 篇）
CI/CD、GitOps、Prometheus、Grafana、日志、链路追踪、生产排障

### 阶段六：Operator 开发与平台工程（第 32-38 篇）
CRD、Controller、Kubebuilder、Operator 开发与生产实践

### 阶段七：综合项目与职业能力（第 39-40 篇）
全链路集成、简历准备、面试指导

## 🚀 快速开始

### 在线阅读

访问：[https://docs.yxuefeng.com/](https://docs.yxuefeng.com/)

### 本地运行

**Linux / macOS**

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

**Windows PowerShell**

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

启动后访问：`http://127.0.0.1:8000`

## 📖 文档结构

```
docs/
├── index.md                    # 首页
├── roadmap.md                  # 学习路线
├── chapters/                   # 课程章节
│   ├── 01-course-guide-env/   # 第 1 篇：课程导学与开发环境准备
│   ├── 02-linux-filesystem/   # 第 2 篇：Linux 文件系统与命令基础
│   ├── 03-linux-process/      # 第 3 篇：Linux 进程、服务与软件管理
│   ├── 04-linux-network/      # 第 4 篇：Linux 网络基础与排障
│   └── ...                     # 其他章节（待完成）
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
- **编排**：Kubernetes、Helm、Kustomize
- **数据库**：PostgreSQL、Redis
- **CI/CD**：GitHub Actions、GitLab CI、Argo CD
- **监控**：Prometheus、Grafana、Loki、Jaeger
- **开发框架**：Gin、GORM、Kubebuilder

## 📝 贡献指南

欢迎贡献内容、修正错误或提出建议！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 提交 Pull Request

### 章节编写规范

- 每章使用 `index.md` 作为入口
- 遵循 [章节写作规范](docs/course-design/00-chapter-writing-standard.md)
- 更新 `mkdocs.yml` 中的导航配置
- 本地执行 `mkdocs build` 确认构建通过

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
4. 访问 `https://docs.yxuefeng.com`

### 自定义域名配置

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

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

感谢所有为云原生技术发展做出贡献的开源社区和开发者。

## 📮 联系方式

- GitHub: [@yleoer](https://github.com/yleoer)
- 网站: [https://docs.yxuefeng.com/](https://docs.yxuefeng.com/)

---

⭐ 如果这个项目对你有帮助，欢迎 Star 支持！

