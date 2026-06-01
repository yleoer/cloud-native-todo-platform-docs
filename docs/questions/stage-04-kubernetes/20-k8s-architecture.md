# 第 20 篇：Kubernetes 架构与集群搭建：练习题与面试题

> 本页由 [第 20 篇：Kubernetes 架构与集群搭建](../../chapters/stage-04-kubernetes/20-k8s-architecture.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

基础题：

1. Kubernetes 的声明式 API 和 Docker CLI 的命令式操作有什么区别？
2. API Server、etcd、Scheduler、Controller Manager 分别负责什么？
3. kubelet 和 containerd 的关系是什么？
4. Pod 和容器是什么关系？为什么 Kubernetes 不直接把容器作为调度单位？
5. kubeconfig 中 cluster、user、context 分别表示什么？

实操题：

1. 把 `todo-k8s-smoke` Pod 的 label 从 `app: todo-k8s-smoke` 改成 `app: changed`，重新 `kubectl apply`，观察 Service 是否还能访问。恢复 label 后重新验证访问成功。
2. 修改 `smoke.yaml` 中的镜像为 `alpine:not-exist`，观察 `ImagePullBackOff` 和 Events。记录现象后恢复为 `registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23`。
3. 新建一个 `dev-lab` Namespace，并用 `kubectl config set-context --current --namespace=dev-lab` 设置默认 Namespace。执行 `kubectl config view --minify` 看到 namespace 生效时，说明操作成功。

思考题：

1. 如果公司有 dev、test、prod 三套集群，你会如何命名 context，避免误操作生产？
2. 如果一个新人说“我已经会 Docker Compose，不需要 Kubernetes”，你会如何解释 Kubernetes 在团队协作、调度、自愈和生产治理上的价值？

## 面试题

### 面试题 1：Kubernetes 的核心架构是什么？

**一句话结论**：Kubernetes 由控制面和工作节点组成，控制面保存和调谐期望状态，节点负责真正运行 Pod。

**展开解释**：控制面包括 API Server、etcd、Scheduler、Controller Manager。`kubectl` 请求进入 API Server，状态保存到 etcd，Scheduler 为 Pod 选择节点，Controller Manager 运行控制器做调谐。每个节点上有 kubelet、容器运行时、kube-proxy 和网络插件，kubelet 根据分配到本节点的 PodSpec 通过 CRI 调 containerd 创建容器。

**深入追问**：生产里控制面要高可用，etcd 要备份和监控，节点运行时和 CNI 要与 Kubernetes 版本兼容。排障时要分清对象状态问题、调度问题、节点问题和运行时问题。

### 面试题 2：声明式 API 相比手工命令有什么优势？

**一句话结论**：声明式 API 让团队描述期望状态，由控制器持续调谐，适合审查、复现、回滚和自动化。

**展开解释**：手工命令强调立即执行动作，容易依赖个人终端状态。声明式 YAML 可以进入 Git，经过代码审查和 CI 校验，再由 `kubectl apply` 或 GitOps 工具同步到集群。Kubernetes 控制器会持续观察对象状态，发现真实状态偏离期望状态时进行修复。

**深入追问**：声明式不是“不需要命令”，而是把命令变成提交和同步配置的入口。生产环境还要配合准入控制、策略校验、审计和回滚流程。

### 面试题 3：kind 和真实 Kubernetes 集群有什么区别？

**一句话结论**：kind 是把 Kubernetes 节点跑在 Docker 容器里的本地实验集群，适合学习和 CI，不适合生产。

**展开解释**：kind 节点本身是宿主机 Docker 容器，节点内部运行 kubelet、containerd、API Server 等组件。它启动快、可删除、适合本地复现 Kubernetes 行为。但它的网络、存储、负载均衡、节点生命周期和高可用都和生产集群不同。

**深入追问**：kind 的优势是可复现和低成本，限制是不能代表云厂商负载均衡、真实多节点网络、CSI 存储、生产安全和控制面高可用。学习时用 kind，生产设计要回到真实集群约束。

### 面试题 4：为什么 `kubectl get pod` Running 不等于业务一定可用？

**一句话结论**：`Running` 只说明 Pod 已被调度且容器进程在运行，不等于应用依赖、健康检查和业务路径都正常。

**展开解释**：一个 Pod 可能处于 `Running`，但应用还没完成启动、数据库连接失败、探针配置缺失、Service selector 不匹配，或者入口流量没有转发到它。本篇只做 smoke test，后续第 21 篇会加入 readiness、liveness、startup probes 来表达应用健康。

**深入追问**：生产排障要同时看 Pod phase、container status、Events、logs、readiness condition、Service endpoints、Ingress/Gateway 状态和应用指标。

### 面试题 5：kubeconfig 为什么是敏感文件？

**一句话结论**：kubeconfig 包含访问集群的地址和身份凭证，泄露后可能让别人以你的权限操作集群。

**展开解释**：kubeconfig 中有 cluster、user、context。user 部分可能包含证书、token 或云厂商 exec 登录配置。即使只泄露到测试集群，也可能暴露内部服务、镜像信息和配置。生产环境应使用最小权限、短期凭证、审计日志和集中身份系统。

**深入追问**：团队不应共享管理员 kubeconfig。应该使用 RBAC、OIDC、云 IAM 或集中认证，并为 CI/CD 使用专用 ServiceAccount 和受控 Secret。
