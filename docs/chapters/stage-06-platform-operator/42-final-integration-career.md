# 第 42 篇：综合集成与职业能力验收 [C]

走到第 42 篇，Cloud Native Todo Platform 已经不再是一个单点练习。你已经写过 Go API，做过 Docker 镜像，部署过 Kubernetes 工作负载，配置过 Helm、Kustomize、CI/CD、GitOps、Prometheus、Grafana、Loki、OpenTelemetry，也从 CRD、Controller、Kubebuilder、Webhook、Finalizer、测试发布一直推进到 Operator 生产实践。

最后一篇要做的事不是再加一个孤立功能，而是把这些能力串成一条可以展示、可以验收、可以排障、可以讲给面试官听的完整交付链路。真实岗位里，一个项目能不能写在简历上，不取决于它用了多少技术名词，而取决于你能不能讲清楚：它解决了什么问题，架构边界在哪里，发布链路如何收敛，出故障时怎么定位，回滚时有什么证据。

本篇特色项目是：**整理 Cloud Native Todo Platform 最终作品集，完成从 Git Push、CI/CD、GitOps、Argo CD、Todo Operator 到一条 YAML 交付 Todo Platform 的综合演练，并把交付过程沉淀成部署说明、排障文档和面试讲解稿。**

## 1. 本章学习目标

### 1.1 知识目标

学完本章后，你应该能够：

- 能解释 Cloud Native Todo Platform 的最终架构分层，以及 Go API、容器镜像、Kubernetes、GitOps、可观测性和 Operator 各自负责什么。
- 能描述从 Git Push 到运行中 Pod 的全链路状态流转：代码提交、CI 验证、镜像发布、GitOps 同步、Operator 调谐、监控验证。
- 能对比“应用 Helm Chart 交付”和“Operator + 自定义资源交付”的边界、优势和风险。
- 能解释为什么最终作品集必须包含架构图、部署说明、验证记录、故障复盘和面试讲解稿，而不只是代码仓库地址。
- 能把 Service Mesh、WASM、eBPF、供应链安全、平台工程和 SRE 能力放到后续学习路线中，判断下一步应该补哪块短板。

### 1.2 技能目标

学完本章后，你应该能够：

- 能独立整理项目目录，形成面向团队交付的 `deployments/final/`、`docs/portfolio/`、`scripts/final-verify.sh` 和 GitOps Application 示例。
- 能编写一份最终 `TodoApp` 交付 YAML，用一条 `kubectl apply -f deployments/final/todoapp-full.yaml` 触发平台交付流程。
- 能配置最终集成 CI，验证 Go 测试、Operator 构建、Helm 模板、文档构建和最终 YAML server-side dry-run。
- 能通过 Argo CD Application 把最终交付入口纳入 GitOps，并判断 `Synced`、`OutOfSync`、`Healthy`、`Degraded` 的原因。
- 能模拟一次镜像错误故障，从 `TodoApp`、Deployment、Events、日志、metrics 和 Git 变更记录中定位并修复。
- 能写出可用于简历和面试的项目表达，包括项目亮点、个人贡献、技术选型、故障案例和追问答案。

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

很多学习者做到最后会遇到一个很现实的问题：每一篇单独看都能跑通，但项目放到一起就讲不清楚。面试官问“你这个项目怎么部署”，回答变成“先跑一个脚本，再装一个 Helm Chart，然后看一下 Grafana”；SRE 同学问“出了问题怎么回滚”，回答变成“应该可以看日志”；团队负责人问“这个 Operator 的边界是什么”，回答变成“它会创建 Deployment 和 Service”。

这类回答的问题不是技术没学，而是缺少最终集成视图。真实项目交付需要把功能链路、发布链路、观测链路和排障链路对齐。否则代码仓库里有很多文件，但没有一个人能快速判断：这次提交是否通过了验证，镜像标签是否可追踪，Argo CD 同步的是哪一次变更，Operator 接管了哪些命名空间，告警触发后应该看哪份手册。

本章要解决的痛点是“从能做实验到能交付项目”。你要把前 41 篇产物整理成一个可验收的最终状态：一条 YAML 能触发交付，CI 能说明变更是否可信，GitOps 能说明集群状态来自哪个提交，可观测系统能说明运行状态，作品集文档能说明你真的理解了这套系统。

### 2.2 团队协作场景

在团队里，平台工程师负责维护 Operator、CRD、Helm Chart、GitOps 模板和发布流水线；应用开发者负责提交 Todo API 代码和最终 `TodoApp` 声明；SRE 负责检查运行状态、告警规则、容量边界和回滚动作；安全团队负责审查 RBAC、镜像来源、Secret 管理、准入控制和供应链记录；面试或晋升评审时，候选人需要把这些协作边界讲成一个完整故事。

本章实验会模拟这条协作线。你会创建一个最终交付分支，补齐最终 YAML、GitHub Actions 工作流、Argo CD Application、验证脚本和作品集文档。然后通过一次故障注入证明这不是“截图项目”：当镜像标签错误导致 Pod 无法启动时，你能按证据链定位到 Deployment、Events、`TodoApp.status.conditions`、Operator 指标和 Git 变更，再通过 GitOps 修复。

### 2.3 课程项目关联

本章继续使用前面所有阶段积累的目录，尤其是：

- `api/`：第 9-14 篇积累的 Todo API 服务。
- `deployments/`：第 15-28 篇积累的 Docker、Kubernetes、Helm 和 Kustomize 交付文件。
- `.github/workflows/`：第 29 篇积累的 CI/CD 流水线。
- `observability/`：第 31-32 篇积累的 Prometheus、Grafana、Loki 和 OpenTelemetry 配置。
- `operator/kubebuilder/` 与 `operator/helm/todo-operator/`：第 38-41 篇积累的 Todo Operator。

本章把项目版本线推进到 `v5.0-final-delivery`。其中第 41 篇的 `v4.7-operator-production` 是 Operator 自身的生产基线，本篇的 `v5.0-final-delivery` 是整个 Cloud Native Todo Platform 的综合交付基线。

需要提前说明一个边界：第 35 篇定义过 `TodoApp`、`TodoDatabase`、`TodoCache` 三个 CRD，第 38-41 篇重点实现了 `TodoApp` 对 Deployment 和 Service 的自动化管理。因此本章实验采用“两级验收”：

- **可执行验收**：基于第 41 篇已有 Operator，`TodoApp` 能创建并维护 Deployment、Service、status、Events 和 metrics。
- **作品集验收**：把 `TodoDatabase`、`TodoCache` 作为平台 API 契约纳入最终 YAML，说明数据库和缓存的后续 Controller 扩展方向。

如果你已经实现了数据库和缓存 Controller，同一份最终 YAML 可以继续扩展为真正的一条 YAML 拉起全栈；如果还没有实现，本章至少保证最终交付入口、发布链路和排障证据完整可演示。

## 3. 核心概念

### 3.1 最终交付契约

最终交付契约是团队约定的“用户只需要提交什么，平台负责完成什么”。在本项目里，业务方提交的是 `TodoApp` 以及相关平台资源声明；平台方提前安装 CRD、Operator、监控、日志、链路追踪和 GitOps 控制面。

表 42-1 最终交付契约

| 契约对象 | 谁负责 | 作用 | 本章文件 |
|---|---|---|---|
| `TodoApp` CR | 应用团队提交，平台团队定义 | 声明 Todo API 镜像、副本数、端口和接管标签 | `deployments/final/todoapp-full.yaml` |
| Operator Helm release | 平台团队 | 安装 CRD、Webhook、Controller Manager、metrics、RBAC | `operator/helm/todo-operator/` |
| GitOps Application | 平台/SRE | 把最终交付目录同步到目标集群 | `deployments/gitops/applications/todo-platform-final.yaml` |
| CI 工作流 | 平台/应用共同维护 | 在合并前验证代码、模板、文档和最终 YAML | `.github/workflows/final-integration.yml` |
| 作品集文档 | 项目负责人 | 解释架构、部署、排障、截图和面试表达 | `docs/portfolio/` |

这份契约的价值在于降低协作成本。应用团队不用理解全部 Deployment 字段，平台团队也不用替每个应用手写 YAML。双方通过 CRD schema、Webhook 校验、RBAC 和验证脚本对齐边界。

### 3.2 全链路部署验证

全链路部署验证不是只看最后一个 Pod 是否 Running，而是证明每个控制点都有证据。代码提交要能对应 CI 记录，CI 记录要能对应镜像标签或 digest，GitOps 变更要能对应 Argo CD 同步记录，Argo CD 同步要能对应集群里的 `TodoApp`，`TodoApp` 要能对应 Deployment、Service、Events、Conditions 和 metrics。

最小证据链如下：

```text
git commit SHA
  -> GitHub Actions run
  -> image tag or digest
  -> GitOps manifest commit
  -> Argo CD application revision
  -> TodoApp metadata.generation
  -> Deployment rollout revision
  -> Service endpoint
  -> metrics/logs/traces evidence
```

如果其中任何一段断掉，生产排障时就会出现“我不知道现在集群里跑的是哪次提交”的问题。最终集成章的核心能力，就是让这条链路可追踪、可复现、可回滚。

### 3.3 一条 YAML 与平台前置能力

“一条 YAML 部署整套平台”容易被误解成一个文件里要塞进所有 Kubernetes 对象。更准确的说法是：平台前置能力已经安装完成后，应用团队通过一份声明式入口触发平台自动化交付。

本项目的一条 YAML 包含四类内容：

- 命名空间准入标签：告诉 Webhook 和 Operator 这个 namespace 属于 Todo Platform 管理范围。
- 租户资源边界：`ResourceQuota`、`LimitRange` 等限制教学集群资源消耗。
- 平台依赖契约：`TodoDatabase`、`TodoCache` 这类 CR 表达数据库和缓存需求。
- 应用交付入口：`TodoApp` 触发 Operator 创建 Deployment、Service，并回写 status。

注意，Operator、CRD、Prometheus、Loki、Tempo 或 Jaeger、Argo CD 这些属于平台控制面，不应该由业务 YAML 每次重复安装。它们更像“机场跑道”，业务 YAML 是“航班计划”。航班计划可以一份文件提交，但跑道需要平台团队先维护好。

### 3.4 最终作品集

最终作品集是把项目能力翻译成别人能检查的证据。它不是简历包装词，而是把工程产物整理成结构化材料。

表 42-2 作品集证据清单

| 证据 | 文件或截图 | 回答的问题 |
|---|---|---|
| 总架构图 | `docs/portfolio/architecture.md` | 系统由哪些层组成，数据和控制流如何走 |
| 部署说明 | `docs/portfolio/deploy-runbook.md` | 新环境如何安装、验证、回滚 |
| 最终 YAML | `deployments/final/todoapp-full.yaml` | 用户如何声明一个 Todo Platform 实例 |
| GitOps 记录 | Argo CD Application 截图或导出 | 当前集群状态来自哪个 Git revision |
| Grafana 截图 | `docs/portfolio/evidence/grafana-overview.png` | QPS、延迟、错误率和资源状态是否可观察 |
| 日志/Trace 截图 | `docs/portfolio/evidence/log-trace-correlation.png` | request_id 如何从日志跳到 Trace |
| 故障复盘 | `docs/portfolio/troubleshooting.md` | 出故障时如何定位、修复、预防 |
| 面试讲解稿 | `docs/portfolio/interview-talk-track.md` | 如何在 3-5 分钟讲清楚项目 |

面试官通常不会逐行读你的所有代码，但会抓住一个点深入追问。作品集的作用，是让你每个关键点都有对应证据，而不是靠记忆临场发挥。

### 3.5 职业能力表达模型

项目表达可以按“四层模型”组织：

1. **业务目标**：这个平台让应用团队用声明式方式交付 Todo 服务，减少手写 Kubernetes 资源和发布不一致。
2. **架构设计**：Go API 运行在 Kubernetes 上，CI/CD 生产镜像，GitOps 管理期望状态，Operator 负责应用生命周期，可观测系统负责反馈运行状态。
3. **工程取舍**：为什么用 CRD 表达应用，为什么 Operator 只接管带标签对象，为什么 Webhook 要限制 namespace，为什么使用 GitOps 而不是手工 `kubectl apply`。
4. **事故经验**：展示一次真实风格故障，从现象、影响面、定位路径、修复动作到预防措施。

这个模型能避免“背技术栈清单”。你不是说“我会 Kubernetes、Helm、Argo CD、Prometheus”，而是说“我用这些组件解决了一条从代码到生产运行的交付问题，并能说明每个组件的边界”。

## 4. 原理深入

### 4.1 最终总架构

```mermaid
flowchart TB
    Dev["Developer"] --> Git["Git repository"]
    Git --> CI["GitHub Actions CI/CD"]
    CI --> Registry["Image registry"]
    CI --> GitOpsRepo["GitOps manifests"]
    GitOpsRepo --> Argo["Argo CD"]
    Argo --> KubeAPI["Kubernetes API server"]
    KubeAPI --> Webhook["TodoApp Webhook"]
    KubeAPI --> CR["TodoApp / TodoDatabase / TodoCache"]
    CR --> Operator["Todo Operator"]
    Operator --> Workloads["Deployment / Service"]
    Workloads --> Pods["Todo API Pods"]
    Pods --> Metrics["Prometheus / Grafana"]
    Pods --> Logs["Loki"]
    Pods --> Traces["OpenTelemetry backend"]
    Operator --> Metrics
    SRE["SRE / Platform team"] --> Metrics
    SRE --> Logs
    SRE --> Traces
```

这张图有两条线。上半部分是交付控制线：开发者提交代码，CI 验证并发布镜像，GitOps 记录期望状态，Argo CD 同步到集群，API server 触发 Webhook 和 Operator。下半部分是运行反馈线：Pod、Operator 和 Kubernetes 事件把状态反馈给 Prometheus、日志系统和链路追踪系统。

真实生产中最重要的是这两条线能闭环。交付线没有反馈，就会变成“部署完才知道坏了”；反馈线没有交付记录，就会变成“看到故障但不知道是哪次变更引入的”。

### 4.2 Git Push 到 Operator 调谐的时序

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Git as GitHub
    participant CI as GitHub Actions
    participant Reg as Registry
    participant Argo as Argo CD
    participant API as Kubernetes API
    participant Op as Todo Operator
    participant Pod as Todo API Pod

    Dev->>Git: push feature branch
    Git->>CI: trigger final integration workflow
    CI->>CI: go test / helm template / docs build
    CI->>Reg: push image with tag or digest
    CI->>Git: update final manifest or open PR
    Dev->>Git: merge PR after review
    Argo->>Git: detect new revision
    Argo->>API: apply TodoApp YAML
    API->>API: run schema validation and webhook
    API->>Op: enqueue TodoApp event
    Op->>API: create or update Deployment and Service
    Pod->>API: report readiness
    Op->>API: update TodoApp status conditions
```

这条时序里有几个关键的状态门：

- CI 失败时，变更不应该进入 GitOps 目录。
- Webhook 拒绝时，错误应该暴露给提交 YAML 的人。
- Operator 调谐失败时，`TodoApp.status.conditions` 和 Events 应该能说明原因。
- Pod 不 Ready 时，Deployment rollout、容器日志和指标要能定位到镜像、探针、资源或依赖问题。

### 4.3 一条 YAML 背后的控制边界

```mermaid
flowchart LR
    YAML["todoapp-full.yaml"] --> NS["Namespace labels"]
    YAML --> Quota["ResourceQuota / LimitRange"]
    YAML --> DBCR["TodoDatabase CR"]
    YAML --> CacheCR["TodoCache CR"]
    YAML --> AppCR["TodoApp CR"]

    NS --> Admission["Webhook namespaceSelector"]
    AppCR --> Predicate["Operator label selector"]
    AppCR --> Reconcile["TodoApp Reconcile"]
    Reconcile --> Deploy["Deployment"]
    Reconcile --> Service["Service"]
    Reconcile --> Status["TodoApp status"]
    Quota --> Limit["Tenant resource boundary"]
```

从用户视角看，这是一条 YAML。从平台视角看，它会经过多道边界：namespace 标签决定 Admission 是否生效，接管标签决定 Operator 是否处理，RBAC 决定 Operator 是否有权创建子资源，Quota 决定租户能消耗多少资源，status 决定用户能看到什么结果。

这也是为什么第 41 篇强调最小 RBAC、Watch 范围、Webhook `namespaceSelector`、predicate 和 metrics。没有这些边界，一条 YAML 不是简化交付，而是扩大事故影响面。

### 4.4 故障演练闭环

```mermaid
flowchart TD
    A["Change image tag"] --> B["Argo CD sync"]
    B --> C["TodoApp generation increases"]
    C --> D["Operator updates Deployment"]
    D --> E{"Pods Ready?"}
    E -- "yes" --> F["Status Ready=True"]
    E -- "no" --> G["Status Ready=False"]
    G --> H["Check Deployment rollout"]
    H --> I["Check Pod Events"]
    I --> J["Check logs / metrics / traces"]
    J --> K["Fix manifest or rollback Git commit"]
    K --> B
```

本章故障演练选择“错误镜像标签”，因为它真实、常见、影响明确。现象通常是 `ImagePullBackOff` 或 `ErrImagePull`，不会破坏集群，也能完整覆盖 GitOps、Operator、Deployment、Events 和 status。排障时不要直接改线上 Pod，而要回到声明式入口：修复 Git 中的镜像值，让 Argo CD 重新同步，Operator 再调谐到新状态。

### 4.5 从项目到岗位能力

表 42-3 项目能力到岗位能力的映射

| 项目证据 | 岗位能力 | 面试表达重点 |
|---|---|---|
| Go API 与测试 | 后端工程能力 | API 设计、测试、配置、优雅关闭 |
| Dockerfile 与镜像扫描 | 容器化能力 | 多阶段构建、非 root、镜像体积和安全 |
| Kubernetes YAML / Helm / Kustomize | 应用交付能力 | 工作负载、配置、存储、网络和多环境 |
| CI/CD 与 GitOps | 发布工程能力 | 可重复发布、审查、回滚和审计 |
| Prometheus / Loki / Trace | 可观测性能力 | 指标、日志、链路追踪如何协同排障 |
| CRD / Controller / Operator | 平台工程能力 | 声明式 API、控制循环、生命周期自动化 |
| 故障复盘 | SRE 思维 | 影响面、定位证据、修复动作、预防机制 |

最终作品集要服务于这个映射。一个好的项目讲解不是“我写了很多文件”，而是“这些文件分别证明了哪些岗位能力”。

## 5. 手把手实验

### 5.1 步骤 1：实验目标

本次实验目标是：在项目仓库中整理最终交付入口和作品集材料，用一条 `kubectl apply -f deployments/final/todoapp-full.yaml` 创建 Todo Platform 声明，并用验证脚本证明 Operator、GitOps、可观测性和排障链路可用。

预计耗时：90 分钟（动手操作约 60 分钟）。

### 5.2 步骤 2：实验环境

表 42-4 实验工具版本

| 工具 | 版本 | 用途 |
|---|---|---|
| Go | 1.26.x | API 和 Operator 测试构建 |
| Docker | 29.x | 构建和加载镜像 |
| Kubernetes | 1.36.x | kind 集群和 API server 验证 |
| kubectl | 1.36.x | 资源 apply、wait、describe、logs |
| Helm | 4.2.x | Operator Chart lint、template、install |
| Kubebuilder | 4.11.x | Operator 项目和 controller-runtime 依赖 |
| Argo CD | 3.2.x | GitOps 同步最终交付目录 |
| Prometheus / Grafana | 课程第 31 篇版本 | 指标采集和面板验证 |
| Loki / OpenTelemetry backend | 课程第 32 篇版本 | 日志和链路追踪验证 |

本章默认你已经完成第 41 篇，至少具备以下前置状态：

- `todoapps.platform.todo.example.com` CRD 已安装；如果要直接运行本章完整 YAML，`tododatabases.platform.todo.example.com` 和 `todocaches.platform.todo.example.com` 也应已安装。
- Todo Operator 已通过 Helm 安装到 `todo-operator-system`。
- Operator Watch 范围包含 `todo-team-a`。
- `WATCH_LABEL_SELECTOR` 包含 `platform.todo.example.com/managed=true`。
- metrics Service 已暴露。

先执行下面的检查：

```bash
kubectl get crd todoapps.platform.todo.example.com
kubectl get deploy -n todo-operator-system
kubectl get svc -n todo-operator-system
kubectl get ns todo-team-a --ignore-not-found
```

如果你还没有安装 Operator，先回到第 41 篇完成 Helm 部署和 smoke test，再继续本章。

### 5.3 步骤 3：文件目录结构

本章在项目根目录新增或整理下面这些文件：

```text
cloud-native-todo-platform/
├── .github/
│   └── workflows/
│       └── final-integration.yml
├── deployments/
│   ├── final/
│   │   └── todoapp-full.yaml
│   └── gitops/
│       └── applications/
│           └── todo-platform-final.yaml
├── docs/
│   └── portfolio/
│       ├── architecture.md
│       ├── deploy-runbook.md
│       ├── troubleshooting.md
│       ├── interview-talk-track.md
│       └── evidence/
│           └── README.md
└── scripts/
    └── final-verify.sh
```

如果你的仓库里还没有这些目录，先创建：

```bash
mkdir -p .github/workflows
mkdir -p deployments/final
mkdir -p deployments/gitops/applications
mkdir -p docs/portfolio/evidence
mkdir -p scripts
```

### 5.4 步骤 4：完整配置

#### 5.4.1 最终一条 YAML

创建 `deployments/final/todoapp-full.yaml`：

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: todo-team-a
  labels:
    platform.todo.example.com/admission: "enabled"
    platform.todo.example.com/tenant: "todo-team-a"
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: todo-team-a-quota
  namespace: todo-team-a
spec:
  hard:
    pods: "20"
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    count/todoapps.platform.todo.example.com: "5"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: todo-team-a-defaults
  namespace: todo-team-a
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      default:
        cpu: 500m
        memory: 512Mi
---
apiVersion: v1
kind: Secret
metadata:
  name: todo-postgres-credentials
  namespace: todo-team-a
type: Opaque
stringData:
  username: todo
  password: change-me-in-real-env
---
apiVersion: platform.todo.example.com/v1alpha1
kind: TodoDatabase
metadata:
  name: todo-postgres
  namespace: todo-team-a
  labels:
    platform.todo.example.com/managed: "true"
spec:
  engine: PostgreSQL
  version: "18"
  storage:
    size: 5Gi
  credentialsSecretName: todo-postgres-credentials
  backup:
    enabled: true
    schedule: "0 2 * * *"
    retentionDays: 7
---
apiVersion: platform.todo.example.com/v1alpha1
kind: TodoCache
metadata:
  name: todo-redis
  namespace: todo-team-a
  labels:
    platform.todo.example.com/managed: "true"
spec:
  engine: Redis
  version: "8"
  memoryProfile: small
  replicas: 1
  persistence:
    enabled: false
---
apiVersion: platform.todo.example.com/v1alpha1
kind: TodoApp
metadata:
  name: todo-platform-final
  namespace: todo-team-a
  labels:
    platform.todo.example.com/managed: "true"
    platform.todo.example.com/part-of: "cloud-native-todo-platform"
  annotations:
    platform.todo.example.com/release: "v5.0-final-delivery"
    platform.todo.example.com/source: "deployments/final/todoapp-full.yaml"
spec:
  image: nginxdemos/hello:plain-text
  replicas: 2
  port: 80
```

这里使用 `nginxdemos/hello:plain-text` 是为了让本地 kind 验收稳定可执行。生产作品集里应把它替换为 CI 产出的 Todo API 镜像，例如 `ghcr.io/your-org/todo-api:v5.0.0` 或更推荐的 digest 形式。

如果你还没有安装 `TodoDatabase` 和 `TodoCache` CRD，可以先临时删除这两个对象，完成 `TodoApp` 主链路验收；作品集里仍要说明数据库和缓存 CRD 是第 35 篇的 API 契约，后续 Controller 扩展会让它们真正创建底层资源。

#### 5.4.2 GitOps Application

创建 `deployments/gitops/applications/todo-platform-final.yaml`：

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: todo-platform-final
  namespace: argocd
  labels:
    app.kubernetes.io/part-of: cloud-native-todo-platform
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/cloud-native-todo-platform.git
    targetRevision: main
    path: deployments/final
  destination:
    server: https://kubernetes.default.svc
    namespace: todo-team-a
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

把 `repoURL` 改成你的项目仓库地址。生产环境建议把 `targetRevision` 固定到环境分支或发布标签，例如 `prod`、`release/v5.0.0`，避免所有 `main` 变更自动进入生产。

#### 5.4.3 最终集成 CI

创建 `.github/workflows/final-integration.yml`：

```yaml
name: final-integration

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Set up Go
        uses: actions/setup-go@v6
        with:
          go-version: "1.26.x"

      - name: Set up Python
        uses: actions/setup-python@v6
        with:
          python-version: "3.14"

      - name: Install docs dependencies
        run: |
          if [ -f requirements.txt ]; then
            python -m pip install --upgrade pip
            python -m pip install -r requirements.txt
          fi

      - name: Validate API
        run: |
          if [ -d api ]; then
            cd api
            go test ./...
            go build ./...
          fi

      - name: Validate Operator
        run: |
          if [ -d operator/kubebuilder ]; then
            cd operator/kubebuilder
            go test ./...
            go build ./...
          fi

      - name: Validate Operator Helm chart
        run: |
          if [ -d operator/helm/todo-operator ]; then
            helm lint operator/helm/todo-operator
            helm template todo-operator operator/helm/todo-operator \
              --namespace todo-operator-system \
              --set watch.namespaces="{todo-team-a}" \
              >/tmp/todo-operator-rendered.yaml
          fi

      - name: Validate final YAML syntax
        run: |
          test -f deployments/final/todoapp-full.yaml
          kubectl apply --dry-run=client -f deployments/final/todoapp-full.yaml

      - name: Build docs
        run: |
          if [ -f mkdocs.yml ]; then
            python -m mkdocs build --strict
          fi
```

`kubectl apply --dry-run=client` 只能检查 YAML 基本结构，无法验证集群中是否真的有 CRD。生产 CI 可以增加一个 kind job：安装 CRD 和 Operator 后执行 `--dry-run=server`，这样能发现 schema、Webhook 和 RBAC 问题。

#### 5.4.4 最终验证脚本

创建 `scripts/final-verify.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-todo-team-a}"
APP_NAME="${APP_NAME:-todo-platform-final}"
MANIFEST="${MANIFEST:-deployments/final/todoapp-full.yaml}"
OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-todo-operator-system}"
METRICS_SERVICE="${METRICS_SERVICE:-todo-operator-metrics}"
METRICS_LOCAL_PORT="${METRICS_LOCAL_PORT:-18080}"

port_forward_pid=""

cleanup() {
  if [ -n "${port_forward_pid}" ]; then
    kill "${port_forward_pid}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

need kubectl
need grep
need sed
need curl

echo "==> checking CRDs"
kubectl get crd todoapps.platform.todo.example.com >/dev/null

missing_crd=0
if kubectl get crd tododatabases.platform.todo.example.com >/dev/null 2>&1; then
  echo "TodoDatabase CRD found"
else
  echo "TodoDatabase CRD not found; install Chapter 35 CRDs or remove TodoDatabase from ${MANIFEST}" >&2
  missing_crd=1
fi

if kubectl get crd todocaches.platform.todo.example.com >/dev/null 2>&1; then
  echo "TodoCache CRD found"
else
  echo "TodoCache CRD not found; install Chapter 35 CRDs or remove TodoCache from ${MANIFEST}" >&2
  missing_crd=1
fi

if [ "${missing_crd}" = "1" ]; then
  exit 1
fi

echo "==> applying final manifest"
kubectl apply -f "${MANIFEST}"

echo "==> waiting for namespace and TodoApp"
kubectl get namespace "${NAMESPACE}" >/dev/null
kubectl -n "${NAMESPACE}" get todoapp "${APP_NAME}" >/dev/null

echo "==> waiting for generated Deployment"
kubectl -n "${NAMESPACE}" rollout status "deployment/${APP_NAME}" --timeout=180s

echo "==> checking Service"
kubectl -n "${NAMESPACE}" get service "${APP_NAME}" >/dev/null

echo "==> checking TodoApp Ready condition"
ready_condition="$(kubectl -n "${NAMESPACE}" get todoapp "${APP_NAME}" \
  -o jsonpath='{range .status.conditions[?(@.type=="Ready")]}{.status}{" "}{.reason}{end}')"
echo "${ready_condition}"
echo "${ready_condition}" | grep -E 'True .*DeploymentReady|True'

echo "==> checking RBAC boundary"
SA="system:serviceaccount:${OPERATOR_NAMESPACE}:todo-operator"
kubectl auth can-i create deployments --as="${SA}" -n "${NAMESPACE}" | grep yes
kubectl auth can-i delete todoapps --as="${SA}" -n "${NAMESPACE}" | grep no

echo "==> checking operator metrics"
kubectl -n "${OPERATOR_NAMESPACE}" port-forward "svc/${METRICS_SERVICE}" "${METRICS_LOCAL_PORT}:8080" \
  >/tmp/todo-final-port-forward.log 2>&1 &
port_forward_pid="$!"

for attempt in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${METRICS_LOCAL_PORT}/metrics" >/tmp/todo-final-metrics.txt 2>/dev/null; then
    break
  fi
  sleep 1
done

grep 'controller_runtime_reconcile' /tmp/todo-final-metrics.txt

echo "==> collecting evidence"
mkdir -p docs/portfolio/evidence
kubectl -n "${NAMESPACE}" get todoapp "${APP_NAME}" -o yaml > docs/portfolio/evidence/final-todoapp.yaml
kubectl -n "${NAMESPACE}" get deploy,svc,pod > docs/portfolio/evidence/final-k8s-state.txt
kubectl -n "${NAMESPACE}" get events --sort-by=.lastTimestamp > docs/portfolio/evidence/final-events.txt
sed -n '1,80p' /tmp/todo-final-metrics.txt > docs/portfolio/evidence/final-metrics-sample.txt

echo "final verification passed"
```

给脚本增加执行权限：

```bash
chmod +x scripts/final-verify.sh
```

Windows 用户建议在 WSL 或 Git Bash 中执行这个脚本。如果必须使用 PowerShell，可以把每条 `kubectl` 命令拆开执行，本章后面的验证标准保持不变。

#### 5.4.5 作品集架构说明

创建 `docs/portfolio/architecture.md`：

~~~~markdown
# Cloud Native Todo Platform 架构说明

## 项目目标

Cloud Native Todo Platform 用一个渐进式项目串联 Go 后端、容器化、Kubernetes 应用交付、生产工程、可观测性和 Operator 开发能力。最终目标是让应用团队通过 TodoApp 自定义资源声明 Todo 服务，由平台自动完成 Deployment、Service、状态回写和运行观测。

## 总架构

```mermaid
flowchart TB
    Dev["Developer"] --> CI["GitHub Actions"]
    CI --> Image["Todo API image"]
    CI --> GitOps["GitOps manifests"]
    GitOps --> Argo["Argo CD"]
    Argo --> API["Kubernetes API server"]
    API --> Operator["Todo Operator"]
    Operator --> App["Todo API Deployment / Service"]
    App --> Obs["Prometheus / Loki / OpenTelemetry"]
```

## 核心取舍

- 用 CRD 表达业务交付入口，减少应用团队直接维护底层 Kubernetes 资源。
- 用 GitOps 管理集群期望状态，保证变更可审查、可追踪、可回滚。
- 用 Operator 管理生命周期，把默认值、校验、OwnerReference、Finalizer、status 和 Events 做成平台能力。
- 用 Prometheus、日志和 Trace 形成排障闭环，而不是只依赖 Pod 是否 Running。

## 当前边界

当前 Operator 已实现 TodoApp 到 Deployment/Service 的调谐。TodoDatabase 和 TodoCache 是平台 API 契约，可在后续 Controller 中扩展为 PostgreSQL 和 Redis 的自动化交付。
~~~~

#### 5.4.6 部署手册

创建 `docs/portfolio/deploy-runbook.md`：

```markdown
# Cloud Native Todo Platform 部署手册

## 前置条件

- Kubernetes 1.36.x 集群可用。
- cert-manager、Prometheus Operator、Argo CD 已按课程前文安装。
- Todo Operator 已安装到 todo-operator-system。
- Operator Watch 范围包含 todo-team-a。

## 部署步骤

1. 推送代码并等待 final-integration 工作流通过。
2. 确认 Todo API 镜像已发布，并更新 deployments/final/todoapp-full.yaml。
3. 通过 PR 合并 GitOps 变更。
4. 等待 Argo CD Application 进入 Synced 和 Healthy。
5. 执行 scripts/final-verify.sh 收集证据。

## 回滚步骤

1. 找到上一次健康的 Git commit 或镜像 digest。
2. revert GitOps manifest 变更，禁止直接修改线上 Deployment。
3. 等待 Argo CD 同步。
4. 观察 TodoApp conditions、Deployment rollout、Prometheus 告警和业务探针。

## 发布后观察窗口

发布后至少观察 15-30 分钟：

- TodoApp Ready condition 是否稳定为 True。
- Deployment 是否有重复重启。
- controller_runtime_reconcile_errors_total 是否增长。
- API QPS、P95 延迟、5xx 错误率是否异常。
- Loki 中是否出现启动失败或依赖连接错误。
```

#### 5.4.7 故障排查文档

创建 `docs/portfolio/troubleshooting.md`：

```markdown
# Cloud Native Todo Platform 故障排查记录

## 演练场景：错误镜像标签

### 现象

TodoApp 更新后长时间不是 Ready，Deployment rollout 超时，Pod 出现 ImagePullBackOff。

### 影响面

影响 todo-team-a 命名空间中的 todo-platform-final 实例。Operator 自身和其他命名空间不受影响。

### 定位步骤

1. 查看 TodoApp 状态：

   kubectl -n todo-team-a describe todoapp todo-platform-final

2. 查看 Deployment rollout：

   kubectl -n todo-team-a rollout status deployment/todo-platform-final

3. 查看 Pod 事件：

   kubectl -n todo-team-a get events --sort-by=.lastTimestamp

4. 查看 Operator 日志和 metrics：

   kubectl -n todo-operator-system logs deploy/todo-operator-controller-manager
   curl -s http://127.0.0.1:18080/metrics | grep controller_runtime_reconcile

### 根因

GitOps manifest 中的 spec.image 指向不存在或无权限拉取的镜像标签。

### 修复

把 spec.image 修复为 CI 已发布的 tag 或 digest，通过 PR 合并后等待 Argo CD 同步。不要直接 patch Deployment。

### 预防

CI 中增加镜像存在性检查；生产 manifest 优先使用 digest；发布前执行 server-side dry-run 和最终 smoke test。
```

#### 5.4.8 面试讲解稿

创建 `docs/portfolio/interview-talk-track.md`：

```markdown
# Cloud Native Todo Platform 面试讲解稿

## 30 秒版本

这个项目用 Todo 业务串联 Go 后端、Docker、Kubernetes、CI/CD、GitOps、可观测性和 Operator 开发。最终形态是业务方提交 TodoApp 自定义资源，平台用 Operator 自动创建 Deployment 和 Service，并通过 status、Events、Prometheus、日志和 Trace 反馈运行状态。

## 3 分钟版本

项目分为六个阶段。前两阶段完成 Go API 和工程化测试；第三阶段完成 Docker 镜像和本地编排；第四阶段把应用迁移到 Kubernetes，并补齐网络、存储、安全、Helm 和 Kustomize；第五阶段接入 CI/CD、Argo CD、Prometheus、Grafana、Loki、OpenTelemetry 和生产排障；第六阶段从 CRD 和 Controller 原理出发，用 Kubebuilder 实现 Todo Operator，并补齐 Webhook、Finalizer、Conditions、测试发布和生产基线。

我重点负责最终平台交付链路：定义 TodoApp API，编写 Reconciler，限制 RBAC 和 Watch 范围，配置 Helm Chart、metrics、ServiceMonitor、PrometheusRule，并整理最终一条 YAML、GitOps Application、验证脚本和故障复盘。

## 可展开追问

- 为什么用 Operator，而不是只用 Helm？
- Webhook 失败会影响什么，如何限制影响范围？
- Reconcile 为什么必须幂等？
- GitOps 回滚和 kubectl patch 回滚有什么区别？
- 看到 ImagePullBackOff 时，你会按什么顺序排查？
```

#### 5.4.9 证据目录说明

创建 `docs/portfolio/evidence/README.md`：

```markdown
# Evidence

这个目录保存最终验收证据。

建议包含：

- final-todoapp.yaml：最终 TodoApp 对象状态。
- final-k8s-state.txt：Deployment、Service、Pod 状态。
- final-events.txt：按时间排序的 Kubernetes Events。
- final-metrics-sample.txt：Operator metrics 样例。
- grafana-overview.png：Grafana 面板截图。
- log-trace-correlation.png：日志和 Trace 关联截图。
- argocd-final-application.png：Argo CD Application 同步状态截图。

不要提交真实生产 Secret、Token、内网地址或用户数据。
```

### 5.5 步骤 5：执行命令

#### 5.5.1 本地验证文件和模板

先检查文件是否都在：

```bash
test -f deployments/final/todoapp-full.yaml
test -f deployments/gitops/applications/todo-platform-final.yaml
test -f .github/workflows/final-integration.yml
test -x scripts/final-verify.sh
```

验证 YAML 基本结构：

```bash
kubectl apply --dry-run=client -f deployments/final/todoapp-full.yaml
kubectl apply --dry-run=client -f deployments/gitops/applications/todo-platform-final.yaml
```

如果你的集群已安装所有 CRD，可以进一步执行 server-side dry-run：

```bash
kubectl apply --dry-run=server -f deployments/final/todoapp-full.yaml
```

#### 5.5.2 确认 Operator 安装状态

```bash
kubectl get pods -n todo-operator-system
kubectl get deploy -n todo-operator-system
kubectl get svc -n todo-operator-system
kubectl get validatingwebhookconfiguration | grep todo
```

确认 Operator 的 ServiceAccount 权限仍符合第 41 篇收敛结果：

```bash
SA=system:serviceaccount:todo-operator-system:todo-operator
kubectl auth can-i create deployments --as="${SA}" -n todo-team-a
kubectl auth can-i delete todoapps --as="${SA}" -n todo-team-a
```

预期第一个返回 `yes`，第二个返回 `no`。

#### 5.5.3 应用最终 YAML

```bash
kubectl apply -f deployments/final/todoapp-full.yaml
kubectl -n todo-team-a get todoapp,tododatabase,todocache
kubectl -n todo-team-a get deploy,svc,pod
```

如果你没有安装 `TodoDatabase` 和 `TodoCache` CRD，先删除最终 YAML 中对应两段，再执行本节命令。不要为了跳过错误而删除 `TodoApp` 的接管标签，否则第 41 篇的 predicate 会让 Operator 忽略这个对象。

#### 5.5.4 运行最终验证脚本

```bash
scripts/final-verify.sh
```

脚本会完成这些检查：

- CRD 是否存在。
- 最终 YAML 是否能 apply。
- `TodoApp` 是否存在。
- Deployment 是否 rollout 成功。
- Service 是否存在。
- `TodoApp.status.conditions` 是否进入 Ready。
- Operator RBAC 是否符合预期。
- metrics 是否能访问。
- 证据文件是否写入 `docs/portfolio/evidence/`。

#### 5.5.5 模拟一次错误镜像故障

把镜像改成一个不存在的 tag：

```bash
kubectl -n todo-team-a patch todoapp todo-platform-final --type=merge \
  -p '{"spec":{"image":"nginxdemos/hello:missing-final-42"}}'
```

观察 rollout：

```bash
kubectl -n todo-team-a rollout status deployment/todo-platform-final --timeout=60s
kubectl -n todo-team-a get pods
kubectl -n todo-team-a get events --sort-by=.lastTimestamp | tail -n 20
kubectl -n todo-team-a describe todoapp todo-platform-final
```

修复镜像：

```bash
kubectl -n todo-team-a patch todoapp todo-platform-final --type=merge \
  -p '{"spec":{"image":"nginxdemos/hello:plain-text"}}'

kubectl -n todo-team-a rollout status deployment/todo-platform-final --timeout=180s
```

在 GitOps 生产流程中，这个修复不应该用 `kubectl patch` 直接做在线修改，而应该改 `deployments/final/todoapp-full.yaml` 并通过 PR 合并。这里用 patch 是为了本地快速演练定位路径。

#### 5.5.6 接入 Argo CD

如果你的本地集群已经安装 Argo CD，先修改 Application 的 `repoURL`，然后执行：

```bash
kubectl apply -f deployments/gitops/applications/todo-platform-final.yaml
kubectl -n argocd get application todo-platform-final
```

查看同步状态：

```bash
argocd app get todo-platform-final
argocd app sync todo-platform-final
argocd app wait todo-platform-final --health --timeout 180
```

如果没有安装 Argo CD CLI，也可以用 `kubectl` 查看：

```bash
kubectl -n argocd get application todo-platform-final -o yaml
```

重点看 `.status.sync.status`、`.status.health.status`、`.status.operationState.phase` 和 `.status.summary`。

### 5.6 步骤 6：预期输出

最终 YAML apply 成功时，你会看到类似输出：

```text
namespace/todo-team-a configured
resourcequota/todo-team-a-quota configured
limitrange/todo-team-a-defaults configured
secret/todo-postgres-credentials configured
tododatabase.platform.todo.example.com/todo-postgres configured
todocache.platform.todo.example.com/todo-redis configured
todoapp.platform.todo.example.com/todo-platform-final configured
```

查看核心对象：

```bash
kubectl -n todo-team-a get todoapp todo-platform-final
```

预期输出：

```text
NAME                  IMAGE                         REPLICAS   PHASE   READY   AGE
todo-platform-final   nginxdemos/hello:plain-text   2          Ready   2       2m
```

查看工作负载：

```bash
kubectl -n todo-team-a get deploy,svc,pod
```

预期输出：

```text
NAME                                  READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/todo-platform-final   2/2     2            2           2m

NAME                          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
service/todo-platform-final   ClusterIP   10.96.120.42    <none>        80/TCP    2m

NAME                                       READY   STATUS    RESTARTS   AGE
pod/todo-platform-final-6f8d7d9c7f-2b9xw   1/1     Running   0          2m
pod/todo-platform-final-6f8d7d9c7f-vm7sk   1/1     Running   0          2m
```

验证脚本成功时，最后会输出：

```text
final verification passed
```

故障演练时，错误镜像会看到类似输出：

```text
Warning  Failed     kubelet  Failed to pull image "nginxdemos/hello:missing-final-42"
Warning  Failed     kubelet  Error: ImagePullBackOff
```

这就是排障文档中要记录的关键证据。

### 5.7 步骤 7：验证方法

本章完成后，用下面的 checklist 验收：

| 验收项 | 命令 | 通过标准 |
|---|---|---|
| 最终 YAML 可应用 | `kubectl apply -f deployments/final/todoapp-full.yaml` | 所有目标资源 created 或 configured |
| Operator 接管对象 | `kubectl -n todo-team-a get deploy todo-platform-final` | Deployment 存在 |
| 业务副本 Ready | `kubectl -n todo-team-a rollout status deploy/todo-platform-final` | rollout 成功 |
| 状态回写 | `kubectl -n todo-team-a describe todoapp todo-platform-final` | Ready condition 为 True |
| RBAC 边界 | `kubectl auth can-i delete todoapps --as="${SA}" -n todo-team-a` | 返回 no |
| metrics 暴露 | `curl http://127.0.0.1:18080/metrics` | 包含 controller_runtime_reconcile 指标 |
| 故障可定位 | 查看 Events 和排障文档 | 能解释 ImagePullBackOff 根因 |
| 作品集完整 | `ls docs/portfolio` | 架构、部署、排障、讲解稿和 evidence 目录存在 |
| GitOps 可接入 | `argocd app get todo-platform-final` | Application 可创建并进入 Synced |

如果要把本章作为最终课程验收，建议录制或保存三类证据：

- 终端输出：最终验证脚本完整通过。
- 截图：Argo CD Application、Grafana 面板、日志/Trace 关联。
- 文档：架构说明、部署手册、故障复盘和面试讲解稿。

### 5.8 步骤 8：清理步骤

如果只想清理本章创建的租户资源：

```bash
kubectl delete -f deployments/final/todoapp-full.yaml --ignore-not-found
```

如果删除时 `TodoApp` 卡在 `Terminating`，先查看 finalizer 和 Operator 日志：

```bash
kubectl -n todo-team-a get todoapp todo-platform-final -o yaml
kubectl -n todo-operator-system logs deploy/todo-operator-controller-manager --tail=100
```

确认不是生产环境、且已经理解风险后，才可以在实验环境中手动移除 finalizer：

```bash
kubectl -n todo-team-a patch todoapp todo-platform-final --type=merge \
  -p '{"metadata":{"finalizers":[]}}'
```

如果还创建了 Argo CD Application：

```bash
kubectl -n argocd delete application todo-platform-final --ignore-not-found
```

不要在共享集群中随意删除 CRD 或 Operator。删除 CRD 会删除所有命名空间中的同类自定义资源，这不是普通清理动作。

## 6. 常见错误与排障

### 错误 1：`no matches for kind "TodoApp"`

- **现象**：

  ```text
  error: resource mapping not found for name: "todo-platform-final" namespace: "todo-team-a" from "deployments/final/todoapp-full.yaml": no matches for kind "TodoApp" in version "platform.todo.example.com/v1alpha1"
  ensure CRDs are installed first
  ```

- **原因**：集群中没有安装 `todoapps.platform.todo.example.com` CRD，或当前 kubeconfig 指向了错误集群。

- **排查**：

  ```bash
  kubectl config current-context
  kubectl get crd | grep todo
  kubectl get crd todoapps.platform.todo.example.com
  ```

  如果 `kubectl get crd` 中没有 `todoapps`，说明第 35 篇或第 40-41 篇的 CRD 安装没有完成。

- **修复**：安装 Operator Helm Chart 或 CRD 清单，然后重新 apply 最终 YAML。

- **预防**：在最终验证脚本开头检查 CRD；GitOps 应用可以用 sync wave 或依赖关系保证 CRD 先于 CR 实例安装。

### 错误 2：Webhook 调用失败，创建 TodoApp 被拒绝

- **现象**：

  ```text
  Error from server (InternalError): error when creating "todoapp-full.yaml":
  Internal error occurred: failed calling webhook "vtodoapp.kb.io":
  failed to call webhook: Post "https://todo-operator-webhook-service...": no endpoints available for service
  ```

- **原因**：Webhook Service 没有 endpoints、证书没有挂载、cert-manager 未正常签发证书，或 namespace 标签触发了 Webhook 但 Operator Pod 不可用。

- **排查**：

  ```bash
  kubectl -n todo-operator-system get pods,svc,endpoints
  kubectl get validatingwebhookconfiguration | grep todo
  kubectl -n todo-operator-system describe certificate
  kubectl -n todo-operator-system logs deploy/todo-operator-controller-manager --tail=100
  ```

  重点看 Webhook Service 是否有 endpoints，证书 Secret 是否存在，Controller Manager 是否 Ready。

- **修复**：恢复 Operator Pod、检查 cert-manager、重新部署 Helm Chart。实验环境中如果必须先恢复写入，可以临时移除目标 namespace 的 admission 标签，但要记录风险。

- **预防**：Webhook 必须限制 `namespaceSelector`；证书过期、Webhook 请求错误率和 endpoints 缺失应进入告警。

### 错误 3：Argo CD Application 一直 `OutOfSync`

- **现象**：

  ```text
  Name:               argocd/todo-platform-final
  Sync Status:        OutOfSync from main
  Health Status:      Missing
  ```

- **原因**：`repoURL`、`targetRevision` 或 `path` 配错；Argo CD 没有仓库权限；目标目录里有 CRD 不存在导致同步失败；命名空间或资源被手工改动后与 Git 不一致。

- **排查**：

  ```bash
  argocd app get todo-platform-final
  argocd app diff todo-platform-final
  kubectl -n argocd get application todo-platform-final -o yaml
  ```

  看 `.status.conditions` 和 `.status.operationState.message`，通常会直接指出路径不存在、认证失败或 apply 失败。

- **修复**：修正 Application 的 source 配置；给 Argo CD 添加仓库凭据；先安装 CRD；删除不该手工维护的线上漂移。

- **预防**：最终交付目录合并前用 CI 检查路径存在；生产 GitOps 不要依赖本地未提交文件。

### 错误 4：Deployment 卡在 `ImagePullBackOff`

- **现象**：

  ```text
  NAME                                   READY   STATUS             RESTARTS   AGE
  todo-platform-final-6f8d7d9c7f-abcde   0/1     ImagePullBackOff   0          2m
  ```

- **原因**：镜像标签不存在、仓库需要认证、镜像架构不匹配、`imagePullPolicy` 与本地 kind 镜像加载方式冲突。

- **排查**：

  ```bash
  kubectl -n todo-team-a describe pod -l app.kubernetes.io/name=todo-platform-final
  kubectl -n todo-team-a get events --sort-by=.lastTimestamp | tail -n 20
  kubectl -n todo-team-a get deploy todo-platform-final -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
  ```

  Events 中如果出现 `manifest unknown`，说明镜像标签不存在；如果是 `pull access denied`，多半是认证或仓库地址问题。

- **修复**：把 `TodoApp.spec.image` 改成存在的 tag 或 digest；私有仓库要配置 `imagePullSecrets`，并让 Operator 支持传递该字段。

- **预防**：CI 在更新最终 YAML 前检查镜像存在；生产使用 digest；kind 本地测试时确保镜像已 load 到目标集群。

### 错误 5：验证脚本访问不到 metrics

- **现象**：

  ```text
  curl: (7) Failed to connect to 127.0.0.1 port 18080 after 0 ms: Could not connect to server
  grep: /tmp/todo-final-metrics.txt: No such file or directory
  ```

- **原因**：metrics Service 名称和脚本变量不一致；Service 没有暴露 8080；port-forward 端口被占用；Operator Chart 没有启用 metrics。

- **排查**：

  ```bash
  kubectl -n todo-operator-system get svc
  kubectl -n todo-operator-system describe svc todo-operator-metrics
  cat /tmp/todo-final-port-forward.log
  ```

  如果日志里出现 `address already in use`，说明本地端口冲突。

- **修复**：设置 `METRICS_SERVICE` 或 `METRICS_LOCAL_PORT` 后重跑脚本，例如 `METRICS_LOCAL_PORT=18081 scripts/final-verify.sh`；或修复 Helm values 中的 metrics Service 配置。

- **预防**：把 metrics Service 名称写入项目约定；验证脚本要允许通过环境变量覆盖端口和 Service 名称。

## 7. 生产环境注意事项

1. **一条 YAML 是交付入口，不是绕过评审的理由。** 生产环境中，最终 YAML 仍然必须经过 PR、CI、代码审查、Argo CD 同步和发布窗口。越是把复杂性封装到 Operator，越要保证 CRD schema、Webhook 校验和 RBAC 边界可信，否则一个看似简单的字段变化就可能触发大范围调谐。

2. **镜像必须可追踪，最好使用 digest。** 教学环境可以用 tag 演示，生产环境应让 CI 输出镜像 digest，并把 digest 写入 GitOps 变更。这样当告警出现时，SRE 能从 Pod 镜像反查构建记录、源代码提交和审批记录。只使用 `latest` 或手工覆盖镜像，会让回滚和审计变得很脆弱。

3. **Operator 的影响面要在发布单里写清楚。** 发布 Operator 不是普通业务发布。它可能影响多个命名空间的 CR、Webhook 写路径、status 回写和子资源调谐。生产发布前要列出 Watch namespace、接管标签、Webhook selector、RBAC 变化、CRD schema 变化和回滚方案，避免控制面升级变成租户故障。

4. **可观测证据要能支持复盘。** Grafana 截图、日志查询和 Trace 链接不是装饰材料，它们要能回答影响面、开始时间、结束时间、错误率、慢请求路径和修复结果。生产事故复盘时，只有“看了日志，重启好了”是不够的；需要保留能解释因果链的证据。

5. **作品集要脱敏。** 面试或公开分享时，不要暴露真实域名、Token、Secret、客户名称、内部镜像仓库地址和生产告警截图。可以保留结构、流程、字段和排障方法，把敏感值替换为示例值。专业的脱敏比炫耀真实生产截图更能体现工程素养。

## 8. 本章小项目

本章小项目是完成 Cloud Native Todo Platform 最终交付包。你需要在项目仓库中交付：

- `deployments/final/todoapp-full.yaml`：最终一条 YAML 交付入口。
- `deployments/gitops/applications/todo-platform-final.yaml`：Argo CD Application 示例。
- `.github/workflows/final-integration.yml`：最终集成 CI。
- `scripts/final-verify.sh`：最终验收脚本。
- `docs/portfolio/architecture.md`：项目总架构说明。
- `docs/portfolio/deploy-runbook.md`：部署和回滚手册。
- `docs/portfolio/troubleshooting.md`：故障演练与复盘。
- `docs/portfolio/interview-talk-track.md`：面试讲解稿。
- `docs/portfolio/evidence/`：最终验证证据和截图目录。

验收标准：

| 验收项 | 判断方式 |
|---|---|
| 一条 YAML 可执行 | `kubectl apply -f deployments/final/todoapp-full.yaml` 成功 |
| Operator 自动调谐 | `TodoApp` 创建后生成同名 Deployment 和 Service |
| 业务状态 Ready | Deployment rollout 成功，`TodoApp.status.conditions` 为 Ready |
| GitOps 可接入 | Argo CD Application 能指向 `deployments/final` |
| CI 覆盖核心路径 | Go、Helm、YAML、docs 至少有对应验证步骤 |
| 故障可复现 | 错误镜像演练能产生可解释的 `ImagePullBackOff` 证据 |
| 证据可归档 | `docs/portfolio/evidence/` 包含对象状态、Events、metrics 样例和截图占位 |
| 面试可表达 | 3 分钟讲解稿能讲清业务目标、架构、取舍和故障经验 |

项目完成后，版本线可以标记为 `v5.0-final-delivery`。

## 9. 本章练习题

### 基础题

1. 为什么“Pod Running”不能代表最终交付链路完全健康？还需要哪些证据？
2. CI/CD、GitOps 和 Operator 分别负责哪一段自动化？它们的边界是什么？
3. 为什么最终 YAML 中仍然需要 namespace 标签、ResourceQuota 和接管标签？
4. 作品集里的架构图、部署手册、故障复盘和面试讲解稿分别回答什么问题？
5. 使用镜像 digest 相比使用普通 tag 有什么生产价值？

### 实操题

1. 把最终 YAML 中的 `replicas` 从 2 改为 3，通过 GitOps 或手工 apply 触发变更。验收标准：Deployment 最终 Ready 副本数为 3，`TodoApp.status.readyReplicas` 同步更新。
2. 给 `scripts/final-verify.sh` 增加 Ingress 或 Gateway API 验证。验收标准：当入口资源存在时脚本检查 HTTP 状态码；不存在时输出跳过说明。
3. 在 `.github/workflows/final-integration.yml` 中增加 kind server-side dry-run job。验收标准：CI 能安装 CRD 后执行 `kubectl apply --dry-run=server -f deployments/final/todoapp-full.yaml`。

### 思考题

1. 如果公司不允许应用团队直接创建 CR，只允许通过内部平台页面提交，你会如何保留 GitOps 审计和回滚能力？
2. 如果最终交付链路中 Argo CD 显示 Healthy，但 Grafana 告警显示 5xx 错误率升高，你会如何判断是发布问题、依赖问题还是观测误报？

## 10. 本章面试题

### 面试题 1：你如何介绍 Cloud Native Todo Platform 的整体架构？

**一句话结论**：它是一套从 Go API 到 Kubernetes Operator 的端到端云原生交付项目，用 GitOps 和 Operator 把应用发布、生命周期管理和可观测性串成闭环。

**展开解释**：项目前半段完成 Go API、Docker 镜像、Kubernetes 部署、Helm 和 Kustomize；中段接入 CI/CD、Argo CD、Prometheus、Grafana、Loki 和 OpenTelemetry；后半段设计 CRD 并实现 Todo Operator，让用户通过 `TodoApp` 声明应用，Operator 自动创建 Deployment 和 Service，回写 status，并暴露 metrics。

**深入追问**：这个项目最核心的工程价值是什么？不是 Todo 业务本身，而是完整展示了现代云原生平台如何把代码、镜像、声明式配置、控制循环和观测反馈串起来。

### 面试题 2：CI/CD、GitOps 和 Operator 有什么区别？

**一句话结论**：CI/CD 负责验证和产出，GitOps 负责把期望状态同步到集群，Operator 负责在集群内持续调谐业务生命周期。

**展开解释**：CI/CD 跑测试、构建镜像、渲染模板并提交变更；GitOps 以 Git 为真相源，检测 manifest 变化并 apply 到集群；Operator 监听 CR 变化，把高层声明转换为 Deployment、Service、status、Events 等底层状态。

**深入追问**：为什么不让 CI 直接 `kubectl apply` 到生产？直接 apply 难以审计、回滚和漂移检测。GitOps 让集群状态和 Git revision 对齐，更适合多人协作和生产治理。

### 面试题 3：为什么最终选择 Operator 作为一键交付入口？

**一句话结论**：Operator 可以把平台领域知识封装到 Kubernetes API 中，让用户提交简洁的 `TodoApp`，由控制循环处理默认值、校验、子资源创建、状态回写和清理。

**展开解释**：Helm 擅长安装一组静态资源，但它不持续观察业务状态，也不天然处理运行时生命周期。Operator 通过 Reconcile 循环持续比较期望态和实际态，适合做自愈、状态同步、Finalizer 清理和跨资源协同。

**深入追问**：Operator 会带来什么成本？需要维护 CRD 版本、Webhook、RBAC、Controller 性能、升级兼容和故障影响面。因此第 41 篇做了最小权限、Watch 范围、leader election、metrics 和 smoke test。

### 面试题 4：线上出现 `ImagePullBackOff` 时你怎么排查？

**一句话结论**：先确认影响面和变更来源，再沿 `TodoApp -> Deployment -> Pod Events -> 镜像仓库 -> GitOps commit` 追踪。

**展开解释**：我会先看 `TodoApp.status.conditions` 和 Deployment rollout，确认哪个实例不 Ready；再看 Pod Events 判断是 tag 不存在、认证失败还是网络问题；然后反查当前镜像来自哪个 Git commit 和 CI run；最后通过修复 GitOps manifest 或回滚 commit 恢复，而不是直接改线上 Deployment。

**深入追问**：为什么不先重启 Pod？镜像拉取失败不是运行时偶发现象，重启不会改变不存在的镜像标签。应该修复声明式源头。

### 面试题 5：如何把这个项目写进简历而不显得堆技术词？

**一句话结论**：用“目标、动作、结果、证据”写，而不是罗列 Kubernetes、Prometheus、Operator 等关键词。

**展开解释**：例如可以写：“设计并实现 Cloud Native Todo Platform，使用 GitOps + Operator 将应用交付收敛为 TodoApp 自定义资源；补齐 CI 验证、Helm 发布、最小 RBAC、Webhook 校验、Prometheus 指标和故障演练，使最终交付可通过一条 YAML 创建并通过 smoke test 验收。”

**深入追问**：如果面试官问你个人贡献怎么证明？可以指向 Reconciler 代码、CRD schema、Helm Chart、CI 工作流、最终验证脚本、Grafana 截图和故障复盘文档。

## 11. 本章总结

本篇完成了 Cloud Native Todo Platform 的最终集成。知识上，你把 Go API、Docker、Kubernetes、Helm、Kustomize、CI/CD、GitOps、可观测性、CRD、Controller 和 Operator 放进同一张交付图里，理解了从代码提交到运行中 Pod 的完整状态链路。

实践上，你整理了最终一条 YAML、GitOps Application、最终集成 CI、验证脚本、架构说明、部署手册、故障排查文档和面试讲解稿。你还通过错误镜像演练验证了排障路径：从 `TodoApp` 到 Deployment、Pod Events、Operator metrics 和 GitOps 源头，而不是停留在“重启试试”。

能力上，你已经具备把一个学习项目转换成职业作品集的基本方法：用工程证据证明技术能力，用故障复盘证明生产意识，用清晰表达证明你理解架构取舍。至此，这套课程的主线从“会写一个服务”推进到了“能交付一个可治理的平台能力”。

## 12. 课程收官与后续学习路线

这是 Cloud Native Todo Platform 主线课程的最后一篇。后续不再进入新的正文章节，但你的学习可以沿六条路线继续深入：

- **Service Mesh**：学习 Istio、Linkerd、流量治理、mTLS、灰度发布和服务间可观测性。
- **WASM**：理解 Wasm 在网关扩展、插件系统、边缘计算和安全沙箱中的应用。
- **eBPF**：学习 Cilium、网络观测、内核级性能分析和低侵入故障定位。
- **供应链安全**：补齐 SBOM、SLSA、镜像签名、准入策略、漏洞扫描和 provenance。
- **平台工程**：继续演进开发者门户、模板化交付、Backstage、Crossplane 和多租户治理。
- **SRE**：深入 SLO、错误预算、容量规划、混沌工程、事故指挥和复盘机制。

最终建议你保留三份材料：一个能运行的仓库，一个能证明运行结果的 evidence 目录，一份能讲清楚项目的 3-5 分钟讲解稿。技术会更新，但这种把复杂系统讲清楚、交付清楚、排障清楚的能力，会长期有用。
