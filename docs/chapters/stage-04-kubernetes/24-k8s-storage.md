# 第 24 篇：Kubernetes 存储

第 23 篇已经把 Todo API 的运行参数和敏感信息从 Deployment 中拆到了 ConfigMap 与 Secret。现在 Todo API 仍然有一个明显短板：它虽然可以在 Kubernetes 中被访问，但默认还在使用内存 Repository。Pod 重建后，内存里的 Todo 会消失；副本数增加后，每个 Pod 也会看到不同的数据。

本篇特色项目是：**将 Todo Platform 的 PostgreSQL 迁移到 Kubernetes，用 PersistentVolumeClaim（PVC，持久卷声明）保存数据库数据，并验证 PostgreSQL Pod 重建后 Todo 数据仍然存在。**

## 1. 本章学习目标

### 1.1 知识目标

- 能解释 Volume、PersistentVolume（PV，持久卷）、PVC 和 StorageClass 的职责边界。
- 能说明动态存储供给从 PVC 到 PV 绑定的完整过程。
- 能对比 Deployment 与 StatefulSet 在有状态服务中的差异。
- 能解释 PostgreSQL 在 Kubernetes 中本地教学、生产自建和托管数据库三种方式的边界。
- 能说明备份、恢复、迁移和 ReclaimPolicy 对数据安全的影响。

### 1.2 技能目标

- 能为 PostgreSQL 编写 ConfigMap、Secret、Service、StatefulSet 和 PVC 配置。
- 能使用 Kubernetes Job 执行 Todo API 数据库迁移。
- 能把 Todo API 从内存模式切换到集群内 PostgreSQL。
- 能通过 `kubectl get pvc`、`kubectl describe pod`、`kubectl logs` 和 `psql` 排查存储问题。
- 能验证删除 PostgreSQL Pod 后，PVC 中的数据仍然保留。

### 1.3 前置条件

开始本篇前，请确认你已经完成：

- 第 20 篇：本地 kind 集群 `todo-k8s` 可用，`kubectl` context 指向 `kind-todo-k8s`。
- 第 21 篇：`todo-api:v0.1.0` 已经导入 kind 集群，`todo-workloads` Namespace 存在。
- 第 22 篇：Todo API 可以通过 Service / Ingress / Gateway API 访问。
- 第 23 篇：Todo API 的 ConfigMap / Secret 已经拆分完成，`todo-api` Deployment 处于 Ready 状态。
- 第 12 篇：理解 Todo API 的 PostgreSQL 表结构、迁移文件和 Data Source Name（DSN，数据源名称）配置 `TODO_DATABASE_DSN`。
- 第 14 篇：理解 JSON Web Token（JWT）Secret、`serve`、`migrate`、`hash-password` 等运维命令。
- 第 16 篇：本地已经构建 `todo-api:v0.1.0` 镜像。

本篇命令以 Linux / macOS / WSL2 Bash 为主。Windows 用户建议在 WSL2 Ubuntu 中完成实验；需要创建 YAML 文件时，请按页面给出的文件名手动创建同名文件，并复制对应内容。

!!! warning "本篇数据库密码只用于本地教学"
    文中的 `todo_password`、DSN 和 Secret 文件只用于本地 kind 实验。真实环境必须使用随机密码、受控 Secret 管理、最小权限 Role-Based Access Control（RBAC，基于角色的访问控制）、审计和轮换流程。

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

无状态应用迁移到 Kubernetes 相对容易：镜像、Deployment、Service 和 Ingress 配好后，Pod 可以随时重建。但数据库不是这样。PostgreSQL 保存的是权威数据，不能因为节点重启、Pod 删除或镜像更新就丢失。

真实团队常见的存储事故包括：

- 把数据库数据写在容器可写层，Pod 重建后数据全部消失。
- PVC 一直 `Pending`，应用 Pod 卡住，团队只盯着 Deployment 看不到存储层问题。
- 误删 PVC 或使用 `Delete` 回收策略，导致 PV 和底层磁盘一起被删除。
- 用 Deployment 跑数据库，副本扩容后多个 Pod 同时写同一块盘，引发数据损坏风险。
- 只做了 PVC 持久化，却没有备份和恢复演练，真正故障时无法恢复。

本篇会把这些问题收束到一条主线：**用 StatefulSet 运行单实例 PostgreSQL，用 PVC 保存数据，用 Job 执行迁移，用 Todo API 验证数据真实可用。**

### 2.2 团队协作场景

在真实团队中，数据库上 Kubernetes 不是某个角色单独决定的：

- 后端工程师定义表结构、迁移脚本、连接池和应用 DSN。
- 平台工程师提供 StorageClass、PVC 模板、StatefulSet 写法和节点存储约束。
- Site Reliability Engineer（SRE，站点可靠性工程师）负责备份、恢复、容量告警、故障切换和演练。
- 安全工程师审查数据库密码、Secret 权限、网络访问边界和审计记录。
- Database Administrator（DBA，数据库管理员）或数据平台团队负责数据库参数、慢查询、索引、升级和数据迁移。

开发环境可以用 kind 的本地存储完成学习闭环；生产环境则要更谨慎地选择托管数据库、数据库 Operator 或成熟的自建方案。

### 2.3 Todo 平台模拟案例

> Todo 平台需要在 Kubernetes 中保存数据库数据。你需要为 PostgreSQL 配置 Service、StatefulSet、PVC、Secret 和初始化脚本，并验证 Pod 重建后数据仍然存在。

这个案例用于理解有状态服务的基本要求：身份、存储、访问地址、凭据和备份恢复都不能只按无状态应用处理。
## 3. 核心概念

### 3.1 Volume 是什么

Volume 是 Pod 里声明的一块可挂载存储。容器可以把它挂到某个目录，例如 `/var/lib/postgresql/data`。

最容易混淆的是：Volume 不是天然持久化。不同 Volume 类型有不同生命周期：

表 24-1 常见 Volume 类型对比：

| 类型 | 生命周期 | 适合场景 | 本篇是否使用 |
|---|---|---|---|
| `emptyDir` | 跟随 Pod，Pod 删除后消失 | 临时缓存、临时文件 | 不用于数据库 |
| `configMap` | 跟随 ConfigMap 对象 | 配置文件挂载 | 第 23 篇已使用 |
| `secret` | 跟随 Secret 对象 | 证书、密钥文件挂载 | 本篇只用环境变量注入 |
| `persistentVolumeClaim` | 跟随 PVC 和底层 PV | 数据库、上传文件、长期数据 | 本篇核心 |

PostgreSQL 不能使用 `emptyDir` 保存正式数据。`emptyDir` 适合缓存，不适合权威数据。

### 3.2 PV 与 PVC 是什么

PV 是集群中的一块持久存储资源。它可能来自本机目录、云硬盘、NFS、Ceph、EBS、Azure Disk 或其他存储系统。

PVC 是应用对存储资源的声明：我需要多大容量、什么访问模式、哪个 StorageClass。Pod 不直接绑定具体磁盘，而是引用 PVC。

最小 PVC 示例：

```yaml linenums="0"
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: todo-workloads
spec:
  accessModes:
    - ReadWriteOnce # ← 单节点读写，适合单实例 PostgreSQL
  resources:
    requests:
      storage: 1Gi # ← 请求 1Gi 持久存储
```

PVC 的价值是把“应用需要存储”与“集群如何提供存储”分开。后端工程师写 PVC，平台团队负责 StorageClass 和底层存储。

### 3.3 StorageClass 与动态供给

StorageClass 描述“如何创建一块存储”。例如 kind 默认会提供一个本地路径存储类，真实云上可能是 `gp3`、`premium-rwo` 或企业内部的 CSI（Container Storage Interface，容器存储接口）驱动。

动态供给的过程是：

1. 用户创建 PVC。
2. PVC 指向默认 StorageClass 或显式指定的 StorageClass。
3. 存储控制器创建 PV。
4. Kubernetes 将 PVC 与 PV 绑定。
5. Pod 引用 PVC 后，kubelet 把存储挂载进容器。

如果 PVC 一直 `Pending`，通常不是应用代码问题，而是 StorageClass、容量、访问模式或存储驱动出了问题。

### 3.4 StatefulSet 是什么

StatefulSet 是 Kubernetes 中管理有状态 Pod 的工作负载对象。它与 Deployment 的关键差异是：StatefulSet 给每个 Pod 稳定身份。

表 24-2 Deployment 与 StatefulSet 对比：

| 对比项 | Deployment | StatefulSet |
|---|---|---|
| Pod 名称 | 随 ReplicaSet 变化，例如 `todo-api-xxxx` | 稳定有序，例如 `todo-postgres-0` |
| 网络身份 | 通常通过 Service 访问 | 可通过 Headless Service 获得稳定 DNS |
| 存储声明 | 通常引用已有 PVC | 可用 `volumeClaimTemplates` 为每个副本创建 PVC |
| 适合对象 | 无状态 API、Worker | 数据库、消息队列、有状态中间件 |

本篇用 StatefulSet 跑单实例 PostgreSQL，并用 `volumeClaimTemplates` 自动生成 PVC。这样删除 `todo-postgres-0` Pod 后，StatefulSet 会重建同名 Pod，并重新挂载原来的 PVC。

### 3.5 PostgreSQL 在 Kubernetes 中的部署方式

PostgreSQL 可以运行在 Kubernetes 中，但要分清学习环境和生产环境：

- 本地教学：单实例 PostgreSQL + StatefulSet + PVC，方便理解存储链路。
- 团队测试环境：可以使用数据库 Operator，例如 CloudNativePG、Crunchy Postgres Operator，统一管理备份、复制和故障恢复。
- 生产环境：优先考虑云厂商托管 PostgreSQL 或经过团队验证的数据库平台；如果自建，需要完整的备份、恢复、升级、监控、故障切换和容量规划。

本篇采用第一种方案。它适合学习 Kubernetes 存储，不代表生产高可用数据库方案。

### 3.6 备份、恢复与迁移

PVC 只是保存数据目录，不等于备份。备份至少要回答四个问题：

- 备份什么：逻辑备份、物理备份、WAL（Write-Ahead Logging，预写日志）归档。
- 备份到哪里：对象存储、异地存储、备份集群。
- 如何恢复：恢复到新库、指定时间点恢复、恢复后验证业务数据。
- 谁来演练：定期恢复演练，而不是只看备份任务成功。

本篇会验证 Pod 重建后数据不丢；生产环境还必须验证“PVC 损坏、节点丢失、误删表、错误迁移”这类更严重场景。

## 4. 原理深入

### 4.1 PVC 动态供给链路

图 24-1 PVC 动态供给流程：

```mermaid
flowchart LR
    User["kubectl apply PVC"] --> API["API Server"]
    API --> PVC["PVC: requests 1Gi"]
    PVC --> SC["StorageClass: provisioner"]
    SC --> Provisioner["CSI / local-path provisioner"]
    Provisioner --> PV["PV: bound volume"]
    PV --> PVC
    Pod["Pod references PVC"] --> Kubelet["kubelet"]
    Kubelet --> Mount["Mount volume into container"]
```

这个流程里有两个控制循环：一个负责根据 PVC 创建 PV，一个负责把已经绑定的 PV 挂载到运行 Pod 的节点上。Pod 卡住时，要同时看 Pod 事件和 PVC 事件。

### 4.2 StatefulSet、Headless Service 与稳定身份

StatefulSet 需要一个 `serviceName`。通常这个 Service 是 Headless Service，也就是 `clusterIP: None`。它不会做普通负载均衡，而是为每个 Pod 提供稳定 DNS。

本篇会创建两个 Service：

- `todo-postgres-headless`：给 StatefulSet 提供稳定身份，支持 `todo-postgres-0.todo-postgres-headless.todo-workloads.svc.cluster.local`。
- `todo-postgres`：给 Todo API 使用的普通 ClusterIP Service，API 只需要访问 `todo-postgres:5432` 或完整集群域名。

单实例 PostgreSQL 不需要客户端感知 Pod 序号，所以 API 连接普通 Service 即可。Headless Service 的价值主要是让你理解 StatefulSet 的稳定网络身份。

### 4.3 PostgreSQL 数据目录为什么要显式设置 PGDATA

PostgreSQL 官方镜像默认把数据放在 `/var/lib/postgresql/data` 下。本篇把 PVC 挂载到 `/var/lib/postgresql/data`，并显式设置：

```text linenums="0"
PGDATA=/var/lib/postgresql/data/pgdata
```

这样做是为了让数据库初始化目录稳定落在 PVC 内部的 `pgdata` 子目录。它也方便排查：只要 PVC 没删，`pgdata` 就应该继续存在。第 12 篇和第 17 篇也采用了同样写法，避免学习者在 Docker、Compose 和 Kubernetes 之间切换时被路径差异干扰。

### 4.4 Todo API 如何切换到集群内数据库

Todo API 从第 12 篇开始支持 `TODO_DATABASE_DSN`：

- 没有设置 `TODO_DATABASE_DSN`：使用内存 Repository。
- 设置了 `TODO_DATABASE_DSN`：连接 PostgreSQL Repository。

图 24-2 Todo API 访问 PostgreSQL 链路：

```mermaid
flowchart LR
    Client["curl / Browser"] --> SvcAPI["Service: todo-api"]
    SvcAPI --> PodAPI["Pod: todo-api"]
    PodAPI --> Env["TODO_DATABASE_DSN from Secret"]
    PodAPI --> SvcPG["Service: todo-postgres:5432"]
    SvcPG --> PodPG["StatefulSet Pod: todo-postgres-0"]
    PodPG --> PVC["PVC: postgres-data-todo-postgres-0"]
    PVC --> PV["PV / local-path volume"]
```

第 23 篇已经让 API 通过 Secret 读取 JWT 和管理员用户。本篇继续新增数据库 DSN Secret，让 Deployment 不直接暴露数据库密码。

### 4.5 迁移 Job 为什么独立于 API

数据库迁移是一次性任务，不适合放进每个 API Pod 的启动流程。多个 API 副本同时执行迁移，轻则重复执行，重则并发修改 schema。

Kubernetes 中更清晰的做法是：

1. PostgreSQL StatefulSet 先 Ready。
2. `todo-api-migrate` Job 使用同一个 `todo-api:v0.1.0` 镜像执行 `migrate`。
3. Job 成功后，重启 Todo API Deployment，让它带着 `TODO_DATABASE_DSN` 连接数据库。

本篇的迁移脚本是教学简化版，重复执行基本可接受。生产项目应使用具备版本表、锁、回滚和失败恢复能力的 Structured Query Language（SQL，结构化查询语言）迁移工具，并把迁移纳入发布流程。

## 5. 手把手实验

预计耗时：90 分钟（动手操作约 60 分钟）。

### 5.1 实验目标

本实验要完成：在 `todo-workloads` Namespace 中部署 PostgreSQL 18 StatefulSet，使用 PVC 持久化数据，执行 Todo API 迁移，把 Todo API 切换到 PostgreSQL，并验证删除 PostgreSQL Pod 后 Todo 数据仍然存在。

### 5.2 实验环境

表 24-3 实验环境版本：

| 项目 | 版本 | 说明 |
|---|---|---|
| Kubernetes | kind 实际 v1.35.0，1.36.x 可选覆盖 | 本篇不依赖 1.36 专属 API，按第 20 篇集群版本执行 |
| kubectl | 与 API Server 相差不超过 1 个小版本 | 用于 apply、logs、exec 和 PVC/StatefulSet 排障 |
| kind | 0.31.x | 本地 Kubernetes 集群 |
| Docker Engine | 29.x | 构建与导入本地镜像 |
| PostgreSQL | 18.x | 使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` |
| Todo API 镜像 | `todo-api:v0.1.0` | 第 16 篇构建，第 21 篇导入 kind |

确认当前 context 和集群版本：

```bash linenums="0"
kubectl config current-context
kubectl version
kubectl get nodes
```

预期输出应包含 `kind-todo-k8s` 和 Ready 节点：

```text linenums="0"
kind-todo-k8s
Client Version: v1.35.x
...
Server Version: v1.35.0
NAME                     STATUS   ROLES           AGE   VERSION
todo-k8s-control-plane   Ready    control-plane   ...   v1.35.0
```

不同平台的 `kubectl version` 可能额外输出 `Kustomize Version` 等行，上面的 `...` 表示省略了非关键版本信息。

确认 kind 集群存在默认 StorageClass。PVC 后续会依赖它动态创建 PV：

```bash linenums="0"
kubectl get storageclass
```

预期输出中通常能看到 `standard`：

```text linenums="0"
NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  ...
```

如果没有默认 StorageClass，本篇 PVC 会一直 `Pending`。本地 kind 环境建议回到第 20 篇重新创建集群，或由平台同学安装适合本地实验的 local-path provisioner。

确认 Todo API 镜像已经导入 kind：

```bash linenums="0"
docker image inspect todo-api:v0.1.0 >/dev/null
kind load docker-image todo-api:v0.1.0 --name todo-k8s
```

准备 PostgreSQL 镜像。网络正常时，kind 节点可以直接拉取 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine`；如果你所在网络访问 Docker Hub 不稳定，建议先在宿主机拉取并导入 kind，避免后续 PostgreSQL Pod 卡在 `ImagePullBackOff`：

```bash linenums="0"
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine --name todo-k8s
```

确认第 23 篇的基础对象存在：

```bash linenums="0"
kubectl -n todo-workloads get deployment todo-api
kubectl -n todo-workloads get configmap todo-api-config
kubectl -n todo-workloads get secret todo-api-auth
kubectl -n todo-workloads get service todo-api
```

### 5.3 文件目录结构

以下命令均在项目根目录执行，也就是包含 `go.mod`、`api/` 和 `deployments/` 的目录。

本篇会继续使用第 21-23 篇的 Kubernetes 基础目录：

```bash linenums="0"
mkdir -p deployments/k8s-base
```

本篇完成后，目录结构应类似：

```text linenums="0"
deployments/k8s-base
├── namespace.yaml
├── todo-api-configmap.yaml
├── todo-api-secret.local.yaml
├── todo-api-database-secret.local.yaml   # ← 本地生成，不提交公开仓库
├── todo-api-deployment.yaml
├── todo-api-service.yaml
├── todo-api-migrate-job.yaml
├── todo-postgres-configmap.yaml
├── todo-postgres-secret.local.yaml       # ← 本地生成，不提交公开仓库
├── todo-postgres-service.yaml
└── todo-postgres-statefulset.yaml
```

确认本地 Secret 文件不会进入 Git：

```bash linenums="0"
grep -F 'deployments/k8s-base/*.local.yaml' .gitignore || \
  printf '\ndeployments/k8s-base/*.local.yaml\n' >> .gitignore
```

### 5.4 完整代码或配置

创建 PostgreSQL ConfigMap。这里保存非敏感配置：数据库名、数据目录和服务地址。

将下面内容写入 `deployments/k8s-base/todo-postgres-configmap.yaml`：

```yaml title="deployments/k8s-base/todo-postgres-configmap.yaml"
apiVersion: v1
kind: ConfigMap
metadata:
  name: todo-postgres-config
  namespace: todo-workloads
  labels:
    app.kubernetes.io/name: todo-postgres
    app.kubernetes.io/part-of: todo-platform
data:
  POSTGRES_DB: "todo_platform" # ← PostgreSQL 初始化时创建的数据库名
  PGDATA: "/var/lib/postgresql/data/pgdata" # ← 数据目录位于 PVC 内部
  TODO_DATABASE_HOST: "todo-postgres.todo-workloads.svc.cluster.local" # ← API 访问数据库的服务 DNS
  TODO_DATABASE_PORT: "5432" # ← PostgreSQL 默认端口
  TODO_DATABASE_NAME: "todo_platform" # ← 给排障和文档阅读使用，应用真正读取 DSN
```

生成 PostgreSQL 本地实验 Secret。用户名和密码属于敏感信息，所以放在 Secret 中：

```bash linenums="0"
kubectl -n todo-workloads create secret generic todo-postgres-auth \
  --from-literal=POSTGRES_USER=todo \
  --from-literal=POSTGRES_PASSWORD=todo_password \
  --dry-run=client -o yaml > deployments/k8s-base/todo-postgres-secret.local.yaml
```

生成 Todo API 数据库 DSN Secret。DSN 中包含数据库密码，因此不要放进 ConfigMap：

```bash linenums="0"
kubectl -n todo-workloads create secret generic todo-api-database \
  --from-literal=TODO_DATABASE_DSN="postgres://todo:todo_password@todo-postgres.todo-workloads.svc.cluster.local:5432/todo_platform?sslmode=disable" \
  --dry-run=client -o yaml > deployments/k8s-base/todo-api-database-secret.local.yaml
```

这里的 `sslmode=disable` 只适合本地 kind 教学实验。生产环境应为 PostgreSQL 配置 TLS 证书，并使用 `sslmode=verify-full` 或团队安全基线要求的等同选项。

创建 PostgreSQL Service。一个 Headless Service 提供 StatefulSet 稳定身份，一个普通 ClusterIP Service 给 Todo API 访问：

将下面内容写入 `deployments/k8s-base/todo-postgres-service.yaml`：

```yaml title="deployments/k8s-base/todo-postgres-service.yaml"
apiVersion: v1
kind: Service
metadata:
  name: todo-postgres-headless
  namespace: todo-workloads
  labels:
    app.kubernetes.io/name: todo-postgres
    app.kubernetes.io/part-of: todo-platform
spec:
  clusterIP: None # ← Headless Service，为 StatefulSet Pod 提供稳定 DNS
  selector:
    app.kubernetes.io/name: todo-postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
---
apiVersion: v1
kind: Service
metadata:
  name: todo-postgres
  namespace: todo-workloads
  labels:
    app.kubernetes.io/name: todo-postgres
    app.kubernetes.io/part-of: todo-platform
spec:
  type: ClusterIP # ← 仅集群内访问，Todo API 通过此 Service 连接数据库
  selector:
    app.kubernetes.io/name: todo-postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
```

创建 PostgreSQL StatefulSet。`volumeClaimTemplates` 会为 `todo-postgres-0` 自动创建 PVC：

将下面内容写入 `deployments/k8s-base/todo-postgres-statefulset.yaml`：

```yaml title="deployments/k8s-base/todo-postgres-statefulset.yaml"
# 结构概览：
# 1. serviceName：绑定 Headless Service，提供稳定网络身份
# 2. template：PostgreSQL Pod 模板，包含镜像、环境变量、探针和挂载点
# 3. volumeClaimTemplates：为每个 StatefulSet Pod 创建独立 PVC
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: todo-postgres
  namespace: todo-workloads
  labels:
    app.kubernetes.io/name: todo-postgres
    app.kubernetes.io/part-of: todo-platform
spec:
  serviceName: todo-postgres-headless # ← StatefulSet 稳定 DNS 依赖的 Headless Service
  replicas: 1 # ← 教学环境使用单实例 PostgreSQL
  selector:
    matchLabels:
      app.kubernetes.io/name: todo-postgres
  template:
    metadata:
      labels:
        app.kubernetes.io/name: todo-postgres
        app.kubernetes.io/part-of: todo-platform
    spec:
      terminationGracePeriodSeconds: 60 # ← 给数据库优雅停止和刷盘时间
      containers:
        - name: postgres
          image: registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
          imagePullPolicy: IfNotPresent
          ports:
            - name: postgres
              containerPort: 5432
          envFrom:
            - configMapRef:
                name: todo-postgres-config # ← 非敏感数据库配置
            - secretRef:
                name: todo-postgres-auth # ← 数据库用户名和密码
          readinessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
          livenessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 3
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data # ← PVC 挂载到 PostgreSQL 数据根目录
  volumeClaimTemplates:
    - metadata:
        name: postgres-data # ← 自动生成的 PVC 名为 postgres-data-todo-postgres-0
        labels:
          app.kubernetes.io/name: todo-postgres
          app.kubernetes.io/part-of: todo-platform
      spec:
        accessModes:
          - ReadWriteOnce # ← 单节点读写，适合单实例数据库
        resources:
          requests:
            storage: 1Gi # ← 本地实验 1Gi 足够；生产按容量规划设置
```

创建迁移 Job。它复用 Todo API 镜像，但只执行 `migrate` 命令：

将下面内容写入 `deployments/k8s-base/todo-api-migrate-job.yaml`：

```yaml title="deployments/k8s-base/todo-api-migrate-job.yaml"
apiVersion: batch/v1
kind: Job
metadata:
  name: todo-api-migrate
  namespace: todo-workloads
  labels:
    app.kubernetes.io/name: todo-api-migrate
    app.kubernetes.io/part-of: todo-platform
spec:
  backoffLimit: 1 # ← 迁移失败时最多重试 1 次，避免反复执行有风险的 SQL
  ttlSecondsAfterFinished: 1800 # ← 成功或失败后保留 30 分钟，方便查看日志
  template:
    metadata:
      labels:
        app.kubernetes.io/name: todo-api-migrate
        app.kubernetes.io/part-of: todo-platform
    spec:
      restartPolicy: Never # ← Job 失败交给 Job controller 重试，不让容器无限重启
      containers:
        - name: migrate
          image: todo-api:v0.1.0
          imagePullPolicy: IfNotPresent
          args:
            - migrate
          envFrom:
            - secretRef:
                name: todo-api-database # ← 提供 TODO_DATABASE_DSN
```

更新 Todo API Deployment，让它额外读取数据库 DSN Secret。下面保留第 23 篇的 ConfigMap / Secret 写法，只新增 `todo-api-database`：

将下面内容写入 `deployments/k8s-base/todo-api-deployment.yaml`：

```yaml title="deployments/k8s-base/todo-api-deployment.yaml"
# 结构概览：
# 1. envFrom：从 ConfigMap / Secret 注入运行配置、认证配置和数据库 DSN
# 2. probes：继续使用 /healthz 和 /readyz
# 3. runtime-config：保留第 23 篇的 ConfigMap 文件挂载示例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: todo-api
  namespace: todo-workloads
  labels:
    app.kubernetes.io/name: todo-api
    app.kubernetes.io/part-of: todo-platform
spec:
  replicas: 2
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app.kubernetes.io/name: todo-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: todo-api
        app.kubernetes.io/part-of: todo-platform
    spec:
      containers:
        - name: todo-api
          image: todo-api:v0.1.0
          imagePullPolicy: IfNotPresent
          args:
            - serve
          envFrom:
            - configMapRef:
                name: todo-api-config # ← 第 23 篇创建的非敏感 API 配置
            - secretRef:
                name: todo-api-auth # ← 第 23 篇创建的 JWT Secret 和管理员用户
            - secretRef:
                name: todo-api-database # ← 本篇新增的 TODO_DATABASE_DSN
          ports:
            - name: http
              containerPort: 18080
          startupProbe:
            httpGet:
              path: /healthz
              port: http
            failureThreshold: 30
            periodSeconds: 2
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
            initialDelaySeconds: 3
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 500m
              memory: 256Mi
          volumeMounts:
            - name: runtime-config
              mountPath: /app/runtime-config
              readOnly: true
      volumes:
        - name: runtime-config
          configMap:
            name: todo-api-config-file
```

### 5.5 执行命令

先用 API Server 做 YAML 语法和字段校验：

```bash linenums="0"
kubectl apply --dry-run=server -f deployments/k8s-base/todo-postgres-configmap.yaml
kubectl apply --dry-run=server -f deployments/k8s-base/todo-postgres-secret.local.yaml
kubectl apply --dry-run=server -f deployments/k8s-base/todo-api-database-secret.local.yaml
kubectl apply --dry-run=server -f deployments/k8s-base/todo-postgres-service.yaml
kubectl apply --dry-run=server -f deployments/k8s-base/todo-postgres-statefulset.yaml
kubectl apply --dry-run=server -f deployments/k8s-base/todo-api-migrate-job.yaml
kubectl apply --dry-run=server -f deployments/k8s-base/todo-api-deployment.yaml
```

应用 PostgreSQL 配置、Secret 和 Service：

```bash linenums="0"
kubectl apply -f deployments/k8s-base/todo-postgres-configmap.yaml
kubectl apply -f deployments/k8s-base/todo-postgres-secret.local.yaml
kubectl apply -f deployments/k8s-base/todo-api-database-secret.local.yaml
kubectl apply -f deployments/k8s-base/todo-postgres-service.yaml
```

创建 PostgreSQL StatefulSet：

```bash linenums="0"
kubectl apply -f deployments/k8s-base/todo-postgres-statefulset.yaml
kubectl -n todo-workloads rollout status statefulset/todo-postgres --timeout=180s
kubectl -n todo-workloads wait pod/todo-postgres-0 --for=condition=Ready --timeout=180s
```

查看 PVC 与 Pod 状态：

```bash linenums="0"
kubectl -n todo-workloads get pod todo-postgres-0
kubectl -n todo-workloads get pvc
kubectl -n todo-workloads get pv
```

确认 PostgreSQL 可以执行 SQL：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform -c "SELECT version();"
```

验证 StatefulSet 的稳定网络身份。`hostname -f` 应该包含 Pod 序号和 Headless Service 名称：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- hostname -f
```

删除旧迁移 Job，再执行本篇迁移。Job 是一次性对象，重复实验时先删掉旧对象更清楚：

```bash linenums="0"
kubectl -n todo-workloads delete job todo-api-migrate --ignore-not-found
kubectl apply -f deployments/k8s-base/todo-api-migrate-job.yaml
kubectl -n todo-workloads wait --for=condition=complete job/todo-api-migrate --timeout=120s
kubectl -n todo-workloads logs job/todo-api-migrate
```

确认迁移后表已经创建：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform -c "\dt"
```

把 Todo API Deployment 更新为数据库模式：

```bash linenums="0"
kubectl apply -f deployments/k8s-base/todo-api-deployment.yaml
kubectl -n todo-workloads rollout status deployment/todo-api --timeout=180s
kubectl -n todo-workloads get pods -l app.kubernetes.io/name=todo-api
```

打开一个终端做 Service 转发。这个命令会占用当前终端，验证完成后按 `Ctrl+C` 结束：

```bash linenums="0"
kubectl -n todo-workloads port-forward service/todo-api 18082:80
```

另开一个终端验证 API 就绪：

```bash linenums="0"
curl -i http://127.0.0.1:18082/readyz
```

登录并通过 API 创建一条 Todo：

```bash linenums="0"
TOKEN=$(curl -s \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:18082/api/v2/auth/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

curl -i \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"persist through Kubernetes PVC"}' \
  http://127.0.0.1:18082/api/v2/todos
```

这里用 `sed` 简化提取单行 JSON 中的 `token`。如果你安装了 `jq`，可以把第一段命令中的 `sed -n ...` 替换为 `jq -r '.token'`，解析 JSON 会更可靠。

也可以直接从 PostgreSQL 查询这条 Todo：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform \
  -c "SELECT id, title, status FROM todos WHERE title = 'persist through Kubernetes PVC';"
```

现在删除 PostgreSQL Pod，模拟数据库 Pod 被重建。注意这里不是删除 PVC：

```bash linenums="0"
kubectl -n todo-workloads delete pod todo-postgres-0
kubectl -n todo-workloads wait pod/todo-postgres-0 --for=condition=Ready --timeout=180s
kubectl -n todo-workloads get pod todo-postgres-0
```

再次查询数据。如果数据仍在，说明 PVC 已经保存了 PostgreSQL 数据目录：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform \
  -c "SELECT id, title, status FROM todos WHERE title = 'persist through Kubernetes PVC';"
```

最后通过 API 再查一次列表，确认 Todo API 也能从 PostgreSQL 读到数据：

```bash linenums="0"
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:18082/api/v2/todos | grep "persist through Kubernetes PVC"
```

做一次最小备份与恢复验证。`pg_dump` 生成的是逻辑备份，也就是 SQL 文本格式，适合小数据量教学验证。生产大数据量场景通常还需要配合 `pg_basebackup` 做物理备份，并持续归档 WAL。

这里把当前数据库导出到本地临时 SQL 文件，再恢复到同一个 PostgreSQL 实例里的检查库。这个实验不是生产备份方案，但能让你看到“备份文件能否恢复”比“备份命令是否执行成功”更重要：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  pg_dump -U todo -d todo_platform > todo-platform-backup.sql

kubectl -n todo-workloads exec todo-postgres-0 -- \
  createdb -U todo todo_platform_restore_check

kubectl -n todo-workloads exec -i todo-postgres-0 -- \
  psql -U todo -d todo_platform_restore_check < todo-platform-backup.sql

kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform_restore_check \
  -c "SELECT count(*) FROM todos WHERE title = 'persist through Kubernetes PVC';"
```

验证完成后清理恢复检查库，避免后续实验误把它当成业务库：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  dropdb -U todo todo_platform_restore_check
```

### 5.6 预期输出

StatefulSet Ready 后，应看到：

```text linenums="0"
statefulset rolling update complete 1 pods at revision todo-postgres-...
pod/todo-postgres-0 condition met
```

PVC 应处于 `Bound`：

```text linenums="0"
NAME                             STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
postgres-data-todo-postgres-0    Bound    pvc-...                                    1Gi        RWO            standard       ...
```

迁移 Job 应成功完成：

```text linenums="0"
job.batch/todo-api-migrate condition met
```

表结构应包含 `todos`、`todo_events` 和 `schema_migrations`：

```text linenums="0"
             List of relations
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | schema_migrations | table | todo
 public | todo_events       | table | todo
 public | todos             | table | todo
```

`/readyz` 应返回 `200 OK`：

```text linenums="0"
HTTP/1.1 200 OK
...
```

Headless Service 稳定身份验证应看到类似输出：

```text linenums="0"
todo-postgres-0.todo-postgres-headless.todo-workloads.svc.cluster.local
```

删除并重建 `todo-postgres-0` 后，SQL 查询仍应看到刚才创建的 Todo：

```text linenums="0"
 id |              title               | status
----+----------------------------------+---------
 1 | persist through Kubernetes PVC   | pending
```

恢复检查库中的计数应大于等于 `1`：

```text linenums="0"
 count
-------
     1
```

### 5.7 验证方法

完成实验后，用下面的清单做最终验收。

确认存储对象：

```bash linenums="0"
kubectl -n todo-workloads get statefulset todo-postgres
kubectl -n todo-workloads get pod todo-postgres-0
kubectl -n todo-workloads get pvc postgres-data-todo-postgres-0
```

判断标准：

- StatefulSet `READY` 为 `1/1`。
- `todo-postgres-0` 为 `Running` 且 `READY` 为 `1/1`。
- PVC `postgres-data-todo-postgres-0` 为 `Bound`。

确认数据库表：

```bash linenums="0"
kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform -c "\dt"
```

判断标准：能看到 `todos`、`todo_events`、`schema_migrations` 三张表。

确认 API 已切换到数据库模式：

```bash linenums="0"
POD=$(kubectl -n todo-workloads get pods \
  -l app.kubernetes.io/name=todo-api \
  -o jsonpath='{.items[0].metadata.name}')

kubectl -n todo-workloads exec "$POD" -- printenv TODO_DATABASE_DSN
```

判断标准：输出中包含 `todo-postgres.todo-workloads.svc.cluster.local:5432`。

确认数据重建后仍在：

```bash linenums="0"
kubectl -n todo-workloads delete pod todo-postgres-0
kubectl -n todo-workloads wait pod/todo-postgres-0 --for=condition=Ready --timeout=180s
kubectl -n todo-workloads exec todo-postgres-0 -- \
  psql -U todo -d todo_platform \
  -c "SELECT count(*) FROM todos WHERE title = 'persist through Kubernetes PVC';"
```

判断标准：`count` 大于等于 `1`。

确认备份文件可以恢复：

```bash linenums="0"
test -s todo-platform-backup.sql
```

判断标准：命令返回成功，且前面恢复检查库中的 `count` 大于等于 `1`。如果 `todo-platform-backup.sql` 为空或恢复失败，不能把这次备份视为有效备份。

### 5.8 清理步骤

本篇产生了真实 PVC 数据。为了后续章节继续使用 Todo Platform，建议默认保留 PostgreSQL、PVC 和 API 数据库配置，只清理一次性迁移 Job：

```bash linenums="0"
kubectl -n todo-workloads delete job todo-api-migrate --ignore-not-found
rm -f todo-platform-backup.sql
```

如果你要彻底清理本篇数据库资源，先确认不再需要实验数据。下面命令会删除 StatefulSet、Service、Secret、ConfigMap 和 PVC；删除 PVC 后，数据库数据会消失：

```bash linenums="0"
kubectl -n todo-workloads delete statefulset todo-postgres --ignore-not-found
kubectl -n todo-workloads delete service todo-postgres todo-postgres-headless --ignore-not-found
kubectl -n todo-workloads delete configmap todo-postgres-config --ignore-not-found
kubectl -n todo-workloads delete secret todo-postgres-auth todo-api-database --ignore-not-found
kubectl -n todo-workloads delete pvc postgres-data-todo-postgres-0 --ignore-not-found
```

如果删除了数据库 Secret，但还想继续运行 Todo API，请把 Deployment 恢复到第 23 篇的不带 `todo-api-database` Secret 写法，或重新执行第 23 篇的 Deployment 配置。

## 6. 常见错误与排障

### 错误 1：PVC 一直是 `Pending`

- **现象**：`kubectl get pvc` 显示：

  ```text linenums="0"
  NAME                            STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
  postgres-data-todo-postgres-0   Pending                                      standard       3m
  ```

- **原因**：集群没有默认 StorageClass、StorageClass 不存在、动态供给器异常，或访问模式与存储类不匹配。
- **排查**：

  ```bash linenums="0"
  kubectl get storageclass
  kubectl -n todo-workloads describe pvc postgres-data-todo-postgres-0
  ```

  重点看 `Events` 中是否出现 `no persistent volumes available`、`storageclass.storage.k8s.io not found` 或 provisioner 报错。

- **修复**：本地 kind 环境优先确认 `standard` StorageClass 存在；如果没有，回到第 20 篇重建 kind 集群，或安装 local-path provisioner。
- **预防**：创建有状态应用前，先执行 `kubectl get storageclass`，确认默认存储类和访问模式。

### 错误 2：PostgreSQL Pod `CrashLoopBackOff`

- **现象**：`kubectl get pods` 显示：

  ```text linenums="0"
  todo-postgres-0   0/1   CrashLoopBackOff   3   2m
  ```

- **原因**：常见原因包括 Secret 缺失、`POSTGRES_PASSWORD` 没有设置、数据目录权限异常，或旧数据目录与新初始化参数冲突。
- **排查**：

  ```bash linenums="0"
  kubectl -n todo-workloads describe pod todo-postgres-0
  kubectl -n todo-workloads logs todo-postgres-0
  kubectl -n todo-workloads get secret todo-postgres-auth
  ```

  如果日志出现 `Database is uninitialized and superuser password is not specified`，说明 Secret 中缺少 `POSTGRES_PASSWORD`。如果出现 `Permission denied`，优先检查挂载目录权限、镜像默认用户和是否启用了不兼容的 Pod SecurityContext。

- **修复**：重新生成 `todo-postgres-secret.local.yaml`，确认包含 `POSTGRES_USER` 和 `POSTGRES_PASSWORD`，再 `kubectl apply` 并重建 Pod；如果是权限问题，本地教学环境先使用本篇默认写法，不额外设置 `runAsUser`。
- **预防**：不要手工编辑 base64 后的 Secret；优先使用 `kubectl create secret --dry-run=client -o yaml` 生成。

### 错误 3：迁移 Job 失败或 `BackoffLimitExceeded`

- **现象**：

  ```text linenums="0"
  job.batch/todo-api-migrate condition failed
  ```

  或：

  ```text linenums="0"
  Warning  BackoffLimitExceeded  Job has reached the specified backoff limit
  ```

- **原因**：PostgreSQL 还没有 Ready、DSN 写错、Service DNS 不通、迁移文件在镜像中不存在，或数据库认证失败。
- **排查**：

  ```bash linenums="0"
  kubectl -n todo-workloads logs job/todo-api-migrate
  kubectl -n todo-workloads get endpoints todo-postgres
  kubectl -n todo-workloads exec todo-postgres-0 -- pg_isready -U todo -d todo_platform
  kubectl -n todo-workloads get secret todo-api-database -o yaml
  ```

  看到 `TODO_DATABASE_DSN is required for migrate` 说明 DSN Secret 没有正确注入。看到 `password authentication failed` 说明 DSN 中的用户名密码与 PostgreSQL Secret 不一致，或 Kubernetes Secret 与数据库内部用户密码已经不一致。

- **修复**：修正 `todo-api-database-secret.local.yaml` 后重新 apply；删除失败的 Job，再重新创建。如果你修改过 `todo-postgres-auth`，要注意 `POSTGRES_PASSWORD` 只在 PostgreSQL 官方镜像初始化空数据目录时用于创建数据库用户。PVC 中已经有数据目录后，单纯修改 Kubernetes Secret 不会自动修改数据库内部用户密码；本地实验可以恢复原来的 `todo_password`，生产环境应通过受控 SQL 变更执行 `ALTER USER`，再同步更新应用 DSN Secret。
- **预防**：把数据库用户名、密码、库名和 DSN 当成一组配置审查，避免只改其中一处；把“修改 Secret”和“修改数据库内部用户密码”当成两个动作设计轮换流程。

### 错误 4：Todo API 仍然像内存模式一样丢数据

- **现象**：API 可以启动，但重启 Deployment 后刚创建的 Todo 消失，或 Pod 日志中出现 `using memory repository`。
- **原因**：Deployment 没有引用 `todo-api-database` Secret，或者 `TODO_DATABASE_DSN` key 写错。
- **排查**：

  ```bash linenums="0"
  POD=$(kubectl -n todo-workloads get pods \
    -l app.kubernetes.io/name=todo-api \
    -o jsonpath='{.items[0].metadata.name}')

  kubectl -n todo-workloads exec "$POD" -- printenv TODO_DATABASE_DSN
  kubectl -n todo-workloads logs "$POD" --tail=50
  ```

  如果 `printenv` 没有输出，说明 API Pod 没拿到 DSN。

- **修复**：重新应用本篇的 `todo-api-deployment.yaml`，确认 `envFrom` 中包含 `todo-api-database`。
- **预防**：每次切换存储后都检查 Pod 环境变量和启动日志，不只看 `/readyz`。

### 错误 5：删除 PVC 后数据消失

- **现象**：重新创建 PostgreSQL 后，`SELECT count(*) FROM todos;` 返回 `0`，旧数据不存在。
- **原因**：PVC 被删除后，绑定的 PV 可能按 `Delete` 回收策略删除底层数据。kind 默认 local-path 存储就是教学环境，不提供生产级数据保护。
- **排查**：

  ```bash linenums="0"
  kubectl -n todo-workloads get pvc
  kubectl get pv
  kubectl get storageclass standard -o yaml
  ```

  重点看 PVC 是否已经不存在，以及 StorageClass 的 `reclaimPolicy`。

- **修复**：如果只是本地实验，只能重新执行迁移并重新造数据；生产环境应从备份恢复。
- **预防**：生产环境不要把 PVC 当备份。删除 PVC 前必须有审批、备份和恢复方案。

## 7. 生产环境注意事项

1. **PVC 持久化不是数据库高可用。** PVC 解决的是 Pod 重建后数据目录还在，不解决数据库主从复制、自动故障切换、跨可用区容灾和误操作恢复。生产 PostgreSQL 优先考虑托管数据库或成熟 Operator。确需自建时，必须补齐备份、复制、监控、升级和演练。

2. **备份恢复要按业务目标设计。** 团队需要明确恢复点目标（Recovery Point Objective，RPO）和恢复时间目标（Recovery Time Objective，RTO）。只看到备份任务成功不够，还必须定期恢复到新实例，并校验表结构、数据量和关键业务查询。数据库迁移前也要准备回滚或前滚策略。

3. **StorageClass 和 ReclaimPolicy 影响数据生命周期。** 教学环境常用 `Delete`，删除 PVC 后底层数据也可能被删。生产环境要明确哪些存储类允许删除、哪些 PV 需要 `Retain`，并通过权限、审批和策略工具限制误删 PVC。

4. **数据库资源要和 API 副本一起容量规划。** API 副本数增加后，连接池总数也会增加。如果每个 Pod 都开很大的连接池，PostgreSQL 会被连接耗尽拖垮。CPU、内存、磁盘 Input/Output Operations Per Second（IOPS，输入输出操作次数）、连接数、慢查询和锁等待都要进入监控。

5. **Secret、网络和运维入口要最小暴露。** 数据库密码应使用受控 Secret 管理和轮换流程；PostgreSQL Service 默认只暴露集群内访问，不应直接开放到公网。生产中还应配合 NetworkPolicy、审计日志、Transport Layer Security（TLS，传输层安全）、备份加密和最小权限 ServiceAccount。

## 8. 练习题与面试题

本章练习题和面试题已拆分到独立页面，完成正文学习后再进入题库练习与复盘。

[查看本章练习题与面试题](../../questions/stage-04-kubernetes/24-k8s-storage.md)

## 9. 本章总结

本篇把 Todo Platform 从“API 可以在 Kubernetes 中运行”推进到“核心业务数据可以通过 PostgreSQL 持久化”。你学习了 Volume、PV、PVC、StorageClass 和 StatefulSet 的职责边界，理解了 PVC 动态供给、StatefulSet 稳定身份、PostgreSQL 数据目录和迁移 Job 的运行链路。

项目成果上，你新增了 PostgreSQL 18 StatefulSet、Headless Service、ClusterIP Service、PVC 模板、数据库 Secret、API DSN Secret 和迁移 Job，并把 Todo API 切换到集群内 PostgreSQL。通过删除 `todo-postgres-0` 并再次查询数据，你验证了 Pod 重建不等于数据丢失。

能力价值上，你已经能处理 Kubernetes 中最常见的有状态服务入门任务：申请持久存储、部署单实例数据库、执行迁移、切换应用配置、验证数据保留，并能区分“教学可用”和“生产可用”的边界。

## 10. 下一章衔接

第 25 篇会进入 Kubernetes 网络原理，解释 Pod、Service、DNS、CNI、kube-proxy 和 NetworkPolicy 如何共同完成集群通信。本篇的 `todo-api -> todo-postgres` 访问链路会成为下一章的真实案例：如果 DNS 解析失败、Service 没有 Endpoints 或网络策略拦截，Todo API 就无法连接数据库。

下一章为了验证 NetworkPolicy 会创建一个临时 kind 集群 `todo-network-lab`，而不是直接改动本篇使用的 `todo-k8s` 主集群。原因是 kind 默认网络插件不执行 NetworkPolicy，需要换成 Calico；把 CNI 实验隔离到临时集群，可以保护本篇已经建立好的 PostgreSQL、PVC 和 Todo API 主线资源。

如果跳过本篇，下一章看到 `todo-postgres.todo-workloads.svc.cluster.local`、Service Endpoints 和 Pod 网络排障时会缺少真实业务上下文。第 24 篇先把“谁访问谁、数据在哪里”搭起来，第 25 篇再解释“网络为什么能通、哪里会不通”。
