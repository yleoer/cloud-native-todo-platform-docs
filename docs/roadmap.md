# 学习路线

本路线围绕 **Cloud Native Todo Platform** 展开。每个阶段都有明确学习目标、产出物和能力验收标准。

| 阶段 | 学习目标 | 产出物 | 能力验收标准 |
|---|---|---|---|
| 1. Linux / Git / Shell | 掌握学习云原生所需的 Linux、Git、Shell 基础 | 云原生学习工作站 | 能完成用户、权限、SSH、Git、脚本和目录初始化 |
| 2. Go 语言基础 | 掌握 Go 基础语法、函数、结构体、接口和错误处理 | Todo CLI 初版 | 能用 Go 实现本地 Todo 增删改查 |
| 3. Go Web API | 掌握 HTTP、路由、中间件、参数校验和统一响应 | Todo API v1 | 能通过 HTTP 完成 Todo CRUD |
| 4. Docker 基础 | 理解镜像、容器、数据卷、网络和常用命令 | 容器化运行 Todo API | 能启动、查看、进入、停止和删除容器 |
| 5. Dockerfile | 掌握生产级镜像构建、多阶段构建和镜像优化 | Todo API 镜像 | 能构建小体积、非 root、可发布的镜像 |
| 6. Docker Compose | 掌握多服务本地编排 | API + PostgreSQL + Redis 本地环境 | 能一条命令启动完整开发环境 |
| 7. 容器运行原理 | 理解 Namespace、Cgroups、UnionFS、OCI、containerd、runc | 容器原理实验 | 能解释容器隔离、资源限制和镜像分层 |
| 8. Kubernetes 基础 | 理解 Kubernetes 架构和集群组件 | kind / minikube 实验集群 | 能使用 kubectl 操作基础资源 |
| 9. Kubernetes 核心对象 | 掌握 Pod、Deployment、Service、ConfigMap、Secret、Probe | Todo API Kubernetes 部署 | 能部署、更新、回滚并暴露服务 |
| 10. Kubernetes 网络 | 理解 CNI、Service、DNS、Ingress、NetworkPolicy | Todo 平台网络访问路径 | 能排查 Pod、Service、Ingress 访问问题 |
| 11. Kubernetes 存储 | 掌握 PV、PVC、StorageClass、StatefulSet | PostgreSQL 持久化部署 | 能保证 Pod 重建后数据不丢失 |
| 12. Kubernetes 安全 | 掌握 RBAC、ServiceAccount、SecurityContext、TLS | 最小权限部署方案 | 能配置 RBAC、Secret、非 root 和 TLS |
| 13. Helm | 掌握 Chart、模板、values、升级和回滚 | Todo Platform Helm Chart | 能用 Helm 安装、升级、回滚应用 |
| 14. CI/CD | 掌握自动测试、构建镜像和部署流程 | GitHub Actions 流水线 | 能 push 后自动构建和发布制品 |
| 15. GitOps | 理解声明式交付和配置漂移治理 | Argo CD 应用 | 能通过 Git 变更驱动集群同步 |
| 16. Prometheus / Grafana | 掌握指标暴露、采集、查询和看板 | Todo 监控面板 | 能观察 QPS、延迟、错误率和资源使用 |
| 17. 日志系统 | 掌握结构化日志、Loki / ELK、日志查询 | Todo 日志查询链路 | 能按 request_id 查询一次请求日志 |
| 18. 生产排障 | 掌握 Pod、网络、存储、资源和节点故障排查 | 故障注入与恢复手册 | 能定位 CrashLoop、Pending、OOM、DNS、Ingress 问题 |
| 19. Kubernetes API 扩展 | 理解 API Machinery、声明式 API 和控制循环 | TodoApp API 设计草案 | 能解释 GVK、Resource、spec/status |
| 20. CRD | 掌握 CRD Schema、版本、校验和 Conditions | TodoApp CRD | 能设计可演进、可校验的自定义资源 |
| 21. Controller | 掌握 Informer、Workqueue、Reconcile 和幂等 | TodoApp Controller 原型 | 能解释控制循环和重试机制 |
| 22. Kubebuilder | 掌握 Kubebuilder 与 controller-runtime | Todo Operator 初版 | 能生成 API、编写 Reconciler 并部署 |
| 23. Operator | 掌握 Webhook、Finalizer、OwnerReference、Status 和测试 | 生产化 Todo Operator | 能用一份 YAML 自动管理 Todo 平台 |
| 24. 综合项目 | 整合后端、容器、Kubernetes、CI/CD、监控和 Operator | Cloud Native Todo Platform | 能从零部署并讲清完整架构 |

## 能力成长路径

```text
会用 Linux
  -> 会写 Go 服务
  -> 会容器化服务
  -> 会部署到 Kubernetes
  -> 会自动化交付
  -> 会观测和排障
  -> 会扩展 Kubernetes API
  -> 会开发 Operator
```

