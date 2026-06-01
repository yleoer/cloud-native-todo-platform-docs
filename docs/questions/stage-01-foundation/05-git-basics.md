# 第 5 篇：Git 基础与团队协作：练习题与面试题

> 本页由 [第 5 篇：Git 基础与团队协作](../../chapters/stage-01-foundation/05-git-basics.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. 工作区、暂存区、本地仓库和远程仓库分别保存什么？
2. 为什么 `git fetch` 比直接 `git pull` 更适合排查分支分叉？
3. `merge` 和 `rebase` 的历史形态有什么区别？
4. 为什么不建议直接在 `main` 分支开发？
5. tag 和 branch 都是引用，它们的使用场景有什么不同？

### 实操题

1. 在临时仓库中创建两个分支，分别修改同一行文本，手动制造并解决一次冲突。当 `git log --oneline --graph --decorate --all` 能看到合并提交时，说明操作成功。
2. 创建一个功能分支，完成两次提交，然后用 `git rebase main` 同步最新主干。当 `git log --oneline --graph` 中功能分支提交位于最新 `main` 之后，说明操作成功。
3. 使用 `git stash` 保存未完成修改，切换分支后再恢复。当 `git stash list` 先出现记录、`git stash pop` 后记录消失且修改回到工作区时，说明操作成功。

### 思考题

1. 团队应该选择 squash merge、merge commit 还是 rebase merge？不同选择对排障、回滚和审计有什么影响？
2. 如果同事把生产 Token 提交到了远程仓库，只在下一次提交中删除文件够不够？你会怎么处理？

## 面试题

### 1. Git 的工作区、暂存区和本地仓库有什么区别？

**一句话结论**：工作区是当前文件，暂存区是下一次提交的准备快照，本地仓库保存已经形成的提交历史。

**展开解释**：`git add` 把工作区修改放入暂存区，`git commit` 把暂存区内容生成提交。这个设计允许开发者把一组文件拆成多个清晰提交，而不是把所有修改一次性塞进历史。

**深入追问**：排查“为什么文件没进 commit”时，优先看 `git status` 和 `git diff --staged`。如果文件只在工作区修改但没有 staged，就不会进入下一次提交。

### 2. `git merge` 和 `git rebase` 有什么区别？

**一句话结论**：`merge` 保留分叉历史，`rebase` 改写当前分支提交位置，让历史更线性。

**展开解释**：团队合并 PR/MR 时常用 merge 或 squash；个人功能分支同步最新主干时可以 rebase。rebase 会生成新的提交哈希，因此不适合已经被多人依赖的公共分支。

**深入追问**：如果个人分支 rebase 后已经推送过远程，需要用 `git push --force-with-lease` 更新远程分支。不要用 `--force` 覆盖别人可能已经推送的提交。

### 3. 发生冲突后你会怎么处理？

**一句话结论**：先用 `git status` 找冲突文件，再理解两边意图，编辑成正确结果，最后 `git add` 标记已解决。

**展开解释**：冲突标记中的 `HEAD` 通常代表当前分支一侧，另一侧代表被合并或 rebase 的提交。解决后要删除所有冲突标记，运行 `git diff --check` 检查，再继续 merge commit 或 `git rebase --continue`。

**深入追问**：冲突解决不是纯技术动作。如果涉及业务行为、配置策略或安全规则，应找对应作者确认，不要机械选择“保留当前”。

### 4. 为什么企业团队通常禁止直接 push 到 `main`？

**一句话结论**：因为 `main` 通常代表可构建、可发布的主线，直接 push 会绕过审查、测试和审计。

**展开解释**：PR/MR 可以触发 CI、收集 Review、记录讨论、关联 Issue，并提供回滚上下文。直接 push 到 `main` 会让错误更快进入主线，也让团队难以知道变更背景。

**深入追问**：成熟团队会使用 branch protection、CODEOWNERS、required checks、required approvals 和 signed commits 等机制保护关键分支。

### 5. `git pull` 为什么可能带来问题？

**一句话结论**：`git pull` 等于 fetch 加合并或变基，默认行为可能在你没看清历史时产生额外 merge commit。

**展开解释**：如果本地和远程分支已经分叉，直接 pull 可能制造混乱历史。更稳妥的方式是先 `git fetch origin`，再用 `git log --graph --all` 看清关系，然后选择 `pull --ff-only`、merge 或 rebase。

**深入追问**：项目内可以用 `git config --local pull.ff only` 固定当前仓库策略；团队也可以在开发规范中建议成员配置 `git config --global pull.ff only`，让不能快进的 pull 直接失败，迫使开发者先理解分叉原因。

### 6. 不小心提交了密钥怎么办？

**一句话结论**：立即视为密钥泄露，删除文件远远不够，必须轮换密钥并评估历史清理。

**展开解释**：Git 历史会保留旧提交中的内容。即使你后续删除密钥，已经推送到远程仓库的历史仍可能被别人拉取或缓存。正确流程是撤销或轮换密钥、通知负责人、清理历史、检查访问日志，并补充 `.gitignore` 和 secret scanning。

**深入追问**：如果密钥已经进入公开仓库，应假设它已经泄露。清理历史不能替代密钥轮换。

### 7. 如何让一次发布从 Git tag 追溯到镜像和 Helm Chart？

**一句话结论**：发布时使用不可变 tag，并把 Git SHA 写入镜像标签、镜像标签元数据、Chart 版本或 release note。

**展开解释**：CI 可以在 `v1.2.3` tag 上构建镜像，把镜像打上 `v1.2.3` 和 commit SHA 标签，同时生成 Helm Chart 版本。线上问题发生时，可以从运行镜像反查源码提交、PR/MR 和回滚目标。

**深入追问**：生产环境不要依赖 `latest`。最好记录镜像 digest，因为 tag 可能被误移动，而 digest 指向不可变内容。
