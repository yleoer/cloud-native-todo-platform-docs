# 阶段四附录 A：Kubernetes 应用交付综合验收

阶段四的目标不是只会写几份 YAML，而是把 Todo Platform 推进为一套可部署、可访问、可配置、可持久化、可隔离、可加固、可打包、可多环境交付的 Kubernetes 应用。

完成本附录后，你应该能把第 20-28 篇的成果整理成作品集：本地 kind 集群、Todo API 工作负载、入口层、配置与 Secret、PostgreSQL 持久化、NetworkPolicy、安全基线、Helm Chart 和 Kustomize overlay。

## 1. 验收目标

阶段四最终验收关注 8 件事：

| 验收方向 | 你需要证明什么 |
|---|---|
| 集群基础 | 能创建 kind 集群，确认 context、节点、Namespace 和基础对象状态 |
| 工作负载 | 能部署 Todo API Deployment、Service、Probe、HPA，并完成滚动更新和回滚 |
| 流量入口 | 能解释并验证 ClusterIP、NodePort、LoadBalancer、Ingress 和 Gateway API 的边界 |
| 配置与密钥 | 能把环境变量、运行配置和敏感信息拆到 ConfigMap / Secret，并避免本地 Secret 误提交 |
| 存储 | 能把 Todo API 切换到 PostgreSQL，验证 Pod 重建后数据仍存在 |
| 网络与安全 | 能配置 NetworkPolicy、ServiceAccount、RBAC、SecurityContext 和 Pod Security Admission |
| 包管理 | 能用 Helm 4 安装、升级、回滚、打包 Todo Platform |
| 多环境交付 | 能用 Kustomize 生成 dev、test、prod 三套 overlay，并通过 server-side dry-run |

## 2. 最终作品集目录

建议在应用仓库中形成以下结构：

```text
cloud-native-todo-platform/
├── api/
│   ├── Dockerfile
│   ├── cmd/
│   └── migrations/
├── deployments/
│   ├── k8s-base/
│   ├── k8s-network/
│   ├── k8s-security/
│   ├── helm/
│   │   ├── todo-platform/
│   │   └── todo-cache/
│   └── kustomize/
│       ├── base/
│       └── overlays/
│           ├── dev/
│           ├── test/
│           └── prod/
├── docs/
│   └── kubernetes/
│       ├── stage-04-acceptance.md
│       ├── release-record.md
│       ├── security-baseline.md
│       └── troubleshooting-record.md
└── README.md
```

如果你的应用仓库目录略有差异，没有关系。验收重点是：部署文件、验证命令、排障记录、版本说明和安全边界都能被别人复现。

## 3. 统一版本与工具基线

阶段四建议使用以下基线：

| 工具或镜像 | 建议版本 | 说明 |
|---|---|---|
| Kubernetes | kind 实际 v1.35.0，1.36.x 可选覆盖 | 第 20 篇默认使用 kind 官方 v1.35.0 节点镜像；User Namespaces 增强步骤需要按第 26 篇说明确认版本和运行时支持 |
| kind | 0.31.x | 本地 Kubernetes 集群 |
| kubectl | 与 API Server 相差不超过 1 个小版本 | 用于 `kubectl apply`、`kubectl kustomize`、`kubectl auth can-i` |
| Docker | 29.x | 构建和加载 `todo-api:v0.1.0` |
| Helm | v4.2.x | 第 27 篇 Helm 4 Chart 实验 |
| Kustomize | kubectl 内置 v5.x | 第 28 篇 overlay 实验 |
| PostgreSQL | `postgres:18-alpine` | 第 24 篇 StatefulSet 实验 |
| Alpine | `alpine:3.23` | 网络、Job、DaemonSet 和排障客户端 |

真实团队应把这些版本写入 README、CI、镜像构建参数和发布说明。课程出版前如果 kind 官方已提供可复现的 Kubernetes 1.36.x 节点镜像和 digest，应统一更新第 20、21、22、25、28 篇的版本表述。

## 4. 主线验收步骤

从干净环境验收时，按下面顺序执行：

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl get namespace
docker image inspect todo-api:v0.1.0
```

核心检查清单：

1. 第 20 篇：`todo-k8s` kind 集群存在，`todo-k8s-control-plane` 为 Ready。
2. 第 21 篇：`todo-workloads` 中 Todo API Deployment Ready，Service 可通过 `port-forward` 访问。
3. 第 22 篇：Ingress 和 Gateway API 路由可通过 Traefik 入口访问，LoadBalancer 在 kind 中的 `<pending>` 行为能解释清楚。
4. 第 23 篇：Pod 中能看到 ConfigMap 注入的 `TODO_ENV`、`TODO_API_ADDR`、`TODO_RELEASE`，Secret 不被明文提交。
5. 第 24 篇：Todo API 已连接 PostgreSQL，删除 PostgreSQL Pod 后数据仍存在。
6. 第 25 篇：NetworkPolicy 能阻断未授权客户端，并允许指定客户端访问 Todo API。
7. 第 26 篇：RBAC 最小权限、Restricted Pod Security、非 root 安全上下文和反例拒绝验证通过。
8. 第 27 篇：Helm release 可安装、升级、回滚、打包，`helm history` 能看到 revision 变化。
9. 第 28 篇：dev、test、prod overlay 渲染结果不同，`kubectl apply --dry-run=server -k` 通过。

## 5. 统一清理清单

阶段四会创建多个 Namespace 和临时文件。完整清理前确认不再需要实验数据：

```bash
kubectl delete namespace todo-dev todo-test todo-prod --ignore-not-found
kubectl delete namespace todo-helm-lab todo-security-lab todo-network-lab --ignore-not-found
kubectl delete namespace todo-workloads todo-ingress --ignore-not-found
kind delete cluster --name todo-network-lab
kind delete cluster --name todo-k8s
```

本地文件清理按需执行：

```bash
rm -rf deployments/k8s-base
rm -rf deployments/k8s-network
rm -rf deployments/k8s-security
rm -rf deployments/helm
rm -rf deployments/kustomize
```

不要在真实集群或共享集群直接复制这些清理命令。生产清理必须先确认 Namespace 归属、备份状态、PVC 数据保留策略和审批记录。

## 6. 作品集交付物

阶段四结束后，建议整理以下材料：

- 一张 Kubernetes 资源拓扑图：Client、Ingress/Gateway、Service、Deployment、ConfigMap、Secret、PostgreSQL、NetworkPolicy、RBAC。
- 一份发布记录：镜像 tag、Helm Chart 版本、Kustomize overlay、验证命令和回滚方式。
- 一份安全基线：ServiceAccount、Role、RoleBinding、Pod Security Admission、SecurityContext、Secret 管理策略。
- 一份排障记录：至少包含 ImagePullBackOff、Probe 失败、Service 无 Endpoints、PVC Pending、NetworkPolicy 拦截、RBAC 拒绝、Helm 升级失败、Kustomize patch 漏改。
- 一份生产差距清单：托管数据库、证书自动化、外部 Secret、镜像扫描、准入策略、备份恢复、监控告警、GitOps 审批。

这些材料可以直接用于求职作品集，也能在真实团队 onboarding、技术分享或内部培训中复用。

## 7. 面试复盘题

1. Kubernetes 中 Deployment、Service、Ingress/Gateway、ConfigMap、Secret、PVC、NetworkPolicy、RBAC 分别解决哪类问题？
2. 为什么 `kubectl get pod` 显示 Running 不等于业务可用？
3. ConfigMap 和 Secret 更新后，为什么有些场景需要滚动重启？
4. 为什么 NetworkPolicy、RBAC 和 Pod Security Admission 是不同层面的安全控制？
5. Helm 和 Kustomize 如何组合？什么时候改 Chart，什么时候改 overlay？
6. 如果一次生产发布失败，你会从哪些对象、日志、事件和发布记录开始排查？

## 8. 出版前验证

出版前至少完成：

```bash
mkdocs build --strict
```

如果修改过示例 YAML 或命令，还要在干净实验环境中完成第 20-28 篇主线验收。验收记录应包含：命令、关键输出、失败排查、最终清理结果。

## 9. 下一阶段衔接

第 29 篇会进入 CI/CD 自动化交付。阶段四已经准备好 Kubernetes 交付物：基础 YAML、Helm Chart、Kustomize overlay、server-side dry-run、排障清单和安全基线。下一阶段会把这些手工验证串进流水线，让代码测试、镜像构建、Chart 渲染、策略检查和部署验证形成自动化闭环。
