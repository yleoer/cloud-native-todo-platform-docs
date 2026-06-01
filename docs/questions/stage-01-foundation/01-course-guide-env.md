# 第 1 篇：课程导学与开发环境准备：练习题与面试题

> 本页由 [第 1 篇：课程导学与开发环境准备](../../chapters/stage-01-foundation/01-course-guide-env.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. 找出下面这段故意写错的 YAML 片段的问题，并写出修复后的片段。

    ```yaml linenums="0"
    tools:
    - go
      - docker
    ```
    提示：本题重点是 YAML 列表缩进；如果想提前观察 Kubernetes 多文档格式，可以参考 `docs/examples/multi-doc.yaml`。
2. `kubectl` 和 `kind` 分别解决什么问题？
3. 为什么本课程统一要求使用 Ubuntu 24.04？
4. 为什么 `.env` 和 kubeconfig 不应该提交到 Git？

### 实操题

1. 在你的机器上运行 `scripts/check-env.sh`，把关键版本记录到 `docs/environment.md`。
2. 修改 `docs/examples/basic.yaml`，增加 `helm` 和 `kind` 两个工具项。
3. 执行 `kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml`，观察输出。
4. 创建分支 `feature/env-notes`，补充环境记录并提交一次 Git 记录。

### 思考题

1. 如果团队里有人使用 Go 1.22，有人使用 Go 1.26，可能会带来哪些问题？
2. 如果你要给新同事写一份环境安装文档，你会如何安排顺序，才能减少新手卡住的概率？

## 面试题

### 1. 你如何从零搭建一个云原生 Go 项目的开发环境？

参考答案：

一句话结论：先统一主力终端和工具版本，再初始化仓库结构，最后用脚本自动验证环境。

展开解释：本课程统一使用 Ubuntu 24.04，先确认 `/etc/os-release` 和 CPU 架构，再安装 Go、Git、Docker Engine、kubectl、kind、Helm。国内环境下还要配置可信 apt 源、Go proxy 和必要的制品库缓存。安装完成后，先确认每个工具能输出版本，再规划 `api/`、`cli/`、`deployments/`、`scripts/`、`operator/` 等目录。最后编写 `check-env.sh` 做自动化环境检查，并把版本记录到 `docs/environment.md` 或 README 中。

深入追问：如果团队成员环境不一致，你会怎么治理？可以回答：把版本基线写进 `scripts/versions.conf`、README、CI 和构建镜像中，并定期升级验证。

### 2. 为什么 Kubernetes 学习要重视 YAML？

参考答案：

一句话结论：YAML 是 Kubernetes 声明式配置的主要载体，写错缩进就可能写错资源意图。

展开解释：Kubernetes 资源大多通过 YAML 描述，例如 Deployment、Service、ConfigMap、Secret、Ingress、CRD。YAML 的缩进、列表、字典、多文档会直接影响资源是否能被正确解析。学会 YAML 不是为了背语法，而是为了能读懂、编写和排查声明式配置。

深入追问：如何降低 YAML 出错概率？可以回答：统一 2 空格缩进，使用编辑器 YAML 插件，提交前运行 `kubectl apply --dry-run=client --validate=false` 做基础检查，并在真实集群中做服务端验证。

### 3. `kubectl`、`kind` 和 kubeconfig 的关系是什么？

参考答案：

一句话结论：`kind` 负责创建本地集群，`kubectl` 负责访问集群，kubeconfig 负责告诉 `kubectl` 访问哪个集群。

展开解释：`kind` 用 Docker 或 Podman 在本机承载外层节点容器，节点容器内部运行 Kubernetes 组件和 containerd；Pod 仍由 kubelet 通过 CRI 调用 containerd 创建。`kubectl` 是 Kubernetes 客户端。kubeconfig 保存集群地址、用户凭据和当前 context。创建 kind 集群后，kind 会把连接信息写入 kubeconfig，kubectl 根据当前 context 访问对应集群。

深入追问：为什么执行危险命令前要看 context？可以回答：同一台机器可能同时保存本地、测试、生产多个 kubeconfig；误把删除命令发到生产集群，是非常典型的运维事故来源。

### 4. 为什么要做版本环境锁定？

参考答案：

一句话结论：版本锁定的目标是减少环境漂移，让问题可复现、可定位、可协作。

展开解释：Go、Docker、kubectl、Helm、Kubernetes 的版本差异可能导致构建结果、YAML 字段、命令行为和 API 兼容性不同。真实团队通常会在 README、CI、脚本、容器镜像和本地环境检查脚本中明确版本范围，并定期审查升级。

深入追问：版本锁定是不是永远不升级？可以回答：不是。锁定是为了稳定基线，升级应该通过分支验证、CI 测试和迁移说明完成，而不是每个人随意升级。
