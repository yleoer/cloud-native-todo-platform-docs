# AGENT.md

本文件用于约束本仓库中的人工协作者和自动化代理。所有代码、文档、配置变更都必须遵守以下规则。

## 1. main 分支保护规则

`main` 是受保护分支，禁止直接提交、直接推送或绕过 Pull Request 合并代码。

必须在 GitHub 仓库中启用以下保护规则：

- 规则类型优先使用 `Ruleset`，旧界面可使用 `Branch protection rule`。
- 规则名称建议为 `Protect main`。
- `Enforcement status` 必须设置为 `Active`。
- 目标分支必须包含 `main`，可以选择 `Include default branch`。
- 必须启用 `Require a pull request before merging`。
- 必须启用 `Require approvals`，建议至少 `1` 个审批。
- 必须启用 `Dismiss stale pull request approvals when new commits are pushed`。
- 必须启用 `Require conversation resolution before merging`。
- 如果仓库配置了 GitHub Actions 或其他 CI，必须启用 `Require status checks to pass`。
- 必须禁止 force push。
- 必须禁止删除 `main` 分支。
- 不允许普通开发者绕过保护规则。
- 如需严格保护，管理员也不应绕过保护规则。

## 2. 标准开发流程

所有变更必须按以下流程进入 `main`：

1. 从最新 `main` 创建独立分支。
2. 在分支中完成文档、代码或配置修改。
3. 本地执行必要验证。
4. 推送分支到远程仓库。
5. 在 GitHub 创建 Pull Request。
6. 等待 CI 通过。
7. 完成代码审查和问题讨论。
8. 所有会话均已 resolved 后合并 PR。
9. 合并后删除临时功能分支。

禁止直接执行：

```bash
git push origin main
```

## 3. 分支命名规则

分支名应清晰表达变更目的，并尽量关联 Issue。

推荐格式：

```text
codex/issue-<issue-number>-<short-topic>
feature/issue-<issue-number>-<short-topic>
fix/issue-<issue-number>-<short-topic>
docs/issue-<issue-number>-<short-topic>
```

示例：

```text
codex/issue-12-chapter-03-linux-process
docs/issue-15-update-readme
fix/issue-18-nav-scroll-behavior
```

如果当前分支名和 GitHub Issue 编号不一致，应在推送前改名：

```bash
git branch -m codex/issue-12-chapter-03-linux-process
git push -u origin codex/issue-12-chapter-03-linux-process
```

## 4. Issue 与 Pull Request 规则

每个较大的课程章节、功能修改或结构调整，应先创建 Issue，再创建对应分支和 PR。

Issue 应说明：

- 背景和目标。
- 修改范围。
- 验收标准。
- 相关页面、章节或文件。

Pull Request 应说明：

- 本次修改的核心内容。
- 已完成的验证命令。
- 是否影响导航、构建、样式或部署。
- 关联的 Issue，例如 `Closes #12`。

## 5. 提交规则

提交信息应简洁、明确，第一行概括修改，后续正文列出关键变更点。

推荐格式：

```text
完成第 3 篇课程内容

- 编写 Linux 进程、服务与软件管理完整教程
- 增加 Go HTTP 服务与 systemd 托管实验
- 补充常见错误、排障方法和生产环境注意事项
- 同步 README 章节目录
```

每次提交应尽量保持主题单一。不要把无关格式化、临时文件、构建产物混入课程内容提交。

完成 `git commit` 后，必须向用户提供一份可直接用于创建 Pull Request 的信息，至少包含：

- PR 标题。
- PR 描述。
- 主要修改点。
- 已执行的验证命令和结果。
- 关联 Issue，例如 `Closes #12`。
- 当前分支名和建议推送命令。

## 6. 本地验证规则

修改文档后，至少执行：

```bash
mkdocs build --strict
```

如果修改了示例代码，应在对应项目目录执行可运行性验证，例如：

```bash
go test ./...
go build ./...
```

如果修改了前端交互、导航、样式或页面布局，应在本地启动站点并进行浏览器验证。

## 7. 课程内容变更规则

新增或重写课程章节时，必须同步检查：

- `mkdocs.yml` 导航是否需要更新。
- `README.md` 文档结构是否需要更新。
- `docs/index.md` 首页内容是否需要更新。
- 章节是否符合 `docs/course-design/00-chapter-writing-standard.md`。
- 是否包含学习目标、真实场景、完整实验、常见错误、排障方法、生产注意事项、面试题和能力验收标准。
- 示例命令是否包含上下文。
- 示例代码和 YAML 是否完整、可复制、可运行。
- 跨 Windows、macOS、Linux 的差异是否使用标签页表达。

## 8. 禁止事项

禁止以下行为：

- 直接向 `main` 推送提交。
- 绕过 PR 审查合并代码。
- 在未确认的情况下删除、重置或覆盖他人修改。
- 使用 `git reset --hard`、`git checkout --` 等破坏性命令清理工作区，除非用户明确要求。
- 提交构建产物、临时文件、缓存目录或无关 IDE 配置。
- 在课程文档中留下不可执行的伪命令或缺少上下文的命令。
- 在生产环境相关内容中忽略安全、权限、备份、回滚和可观测性说明。

## 9. GitHub 仓库设置建议

推荐在 GitHub 中按以下路径配置：

```text
Settings -> Rules -> Rulesets -> New ruleset -> New branch ruleset
```

如果使用旧界面：

```text
Settings -> Branches -> Add branch protection rule
```

`Branch name pattern` 设置为：

```text
main
```

必须启用的核心能力：

- Pull Request 必须存在。
- 审批必须存在。
- 新提交后旧审批必须失效。
- 所有 Review conversation 必须解决。
- CI 状态检查必须通过。
- 禁止 force push。
- 禁止删除分支。
- 不允许绕过保护规则。
