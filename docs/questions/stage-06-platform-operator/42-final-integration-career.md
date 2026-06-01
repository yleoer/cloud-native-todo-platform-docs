# 第 42 篇：综合集成与能力验收：练习题与面试题

> 本页由 [第 42 篇：综合集成与能力验收](../../chapters/stage-06-platform-operator/42-final-integration-career.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. 为什么“Pod Running”不能代表最终交付链路完全健康？还需要哪些证据？
2. CI/CD、GitOps 和 Operator 分别负责哪一段自动化？它们的边界是什么？
3. 为什么最小 YAML 中必须保留 namespace 标签和接管标签？完整 YAML 中为什么还要增加 ResourceQuota？
4. 作品集里的架构图、部署手册、故障复盘和面试讲解稿分别回答什么问题？
5. 使用镜像 digest 相比使用普通 tag 有什么生产价值？

### 实操题

1. 把 `todoapp-local-smoke.yaml` 中的 `replicas` 从 2 改为 3，通过手工 apply 触发变更。验收标准：Deployment 最终 Ready 副本数为 3，`TodoApp.status.readyReplicas` 同步更新。
2. 给 `scripts/final-verify.sh` 增加 Ingress 或 Gateway API 验证。验收标准：当入口资源存在时脚本检查 HTTP 状态码；不存在时输出跳过说明。
3. 在 `.github/workflows/final-integration.yml` 中增加 kind server-side dry-run job。验收标准：CI 能安装 CRD 后执行 `kubectl apply --dry-run=server -f deployments/final/todoapp-full.yaml`。

### 思考题

1. 如果公司不允许应用团队直接创建 CR，只允许通过内部平台页面提交，你会如何保留 GitOps 审计和回滚能力？
2. 如果最终交付链路中 Argo CD 显示 Healthy，但 Grafana 告警显示 5xx 错误率升高，你会如何判断是发布问题、依赖问题还是观测误报？

## 面试题

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

### 面试题 6：当前 Operator 还没有管理数据库和缓存，你如何解释项目边界？

**一句话结论**：我会明确说明当前已实现的是 `TodoApp` 应用交付闭环，`TodoDatabase` 和 `TodoCache` 是已经设计好的平台 API 契约，后续可以继续实现对应 Controller。

**展开解释**：项目里最小可执行路径已经能用 `TodoApp` 自动创建 Deployment 和 Service，并完成 status、Events、metrics 和故障演练。完整作品集 YAML 中保留 DB/Cache CR，是为了展示最终平台 API 设计和演进方向，但不会把尚未实现的 Controller 说成已经完成。

**深入追问**：如果要补齐这部分，你会怎么做？我会先为 `TodoDatabase` 和 `TodoCache` 定义 Reconcile 边界、RBAC、OwnerReference/Finalizer 策略和 status conditions，再分别对接 PostgreSQL/Redis Helm Chart 或托管云服务，并补齐 envtest、kind e2e 和迁移回滚策略。
