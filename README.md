# 从 Go、Docker、Kubernetes 到 Operator 文档站

这是教程 **《从 Go 后端开发、Docker 容器化、Kubernetes 到 Operator 开发与生产实践》** 的 MkDocs Material 文档站。

站点主线项目是 **Cloud Native Todo Platform**。教程会从 Linux、Git、Shell 基础开始，逐步覆盖 Go 后端、Docker、Kubernetes、Helm、CI/CD、GitOps、监控日志、生产排障、CRD、Controller 和 Operator 开发。

## 项目介绍

本仓库用于维护教程文档，技术栈为：

- MkDocs
- MkDocs Material
- GitHub Actions
- GitHub Pages

站点访问域名规划：

```text
https://docs.yxuefeng.com
```

## 本地预览方式

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve
```

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
mkdocs serve
```

启动后访问：

```text
http://127.0.0.1:8000
```

## 安装依赖方式

依赖记录在 `requirements.txt` 中：

```bash
pip install -r requirements.txt
```

当前至少包含：

```text
mkdocs-material
```

## 构建方式

本地严格构建：

```bash
mkdocs build --strict
```

构建产物会生成到：

```text
site/
```

`site/` 已加入 `.gitignore`，不需要提交到仓库。

## GitHub Pages 自动部署说明

已创建 workflow：

```text
.github/workflows/deploy-docs.yml
```

当代码 push 到 `main` 分支时，会自动执行：

1. Checkout 仓库。
2. 安装 Python。
3. 安装 `requirements.txt`。
4. 执行 `mkdocs build --strict`。
5. 上传 `site/` 为 GitHub Pages artifact。
6. 部署到 GitHub Pages。

GitHub 仓库后台需要设置：

1. 进入 `Settings -> Pages`。
2. 在 `Build and deployment` 中选择 `GitHub Actions`。
3. 等待 workflow 成功执行。

## 自定义域名 docs.yxuefeng.com 配置说明

仓库中已创建：

```text
docs/CNAME
```

内容为：

```text
docs.yxuefeng.com
```

DNS 需要配置：

```text
类型: CNAME
主机记录: docs
记录值: <我的 GitHub 用户名>.github.io
```

请注意：

- `<我的 GitHub 用户名>.github.io` 需要替换为实际 GitHub Pages 默认域名。
- 如果 GitHub 用户名是 `yuanxuefeng`，记录值通常是 `yuanxuefeng.github.io`。
- 在 GitHub 仓库 `Settings -> Pages` 中选择 GitHub Actions 作为 Build and deployment source。
- 部署后在 Pages 中设置 Custom domain 为 `docs.yxuefeng.com`。
- 等待 DNS 生效。
- DNS 生效后启用 `Enforce HTTPS`。

最终访问地址：

```text
https://docs.yxuefeng.com
```

## 新增章节方法

推荐每章使用独立目录：

```text
docs/chapters/<chapter-slug>/index.md
```

例如：

```text
docs/chapters/02-go-basic/index.md
```

新增章节后，需要更新 `mkdocs.yml` 的 `nav`：

```yaml
nav:
  - 第一篇：Linux、Git 与 Shell 基础:
      - 第一章: chapters/01-linux-git-shell/index.md
```

提交前请执行：

```bash
mkdocs build --strict
```

## 当前章节

第一章已移动到：

```text
docs/chapters/01-linux-git-shell/index.md
```

原始路径：

```text
docs/04-part-01-linux-git-shell-basics.md
```

移动时保留了正文内容。

## 常见问题

### 1. `mkdocs` 命令不存在

先确认是否安装依赖：

```bash
pip install -r requirements.txt
```

如果使用虚拟环境，请确认已经激活 `.venv`。

### 2. `mkdocs build --strict` 失败

常见原因：

- `mkdocs.yml` 的 `nav` 引用了不存在的 Markdown 文件。
- Markdown 中存在无效链接。
- YAML 缩进错误。

处理方式：

```bash
mkdocs build --strict
```

根据终端错误修复对应文件。

### 3. GitHub Pages 没有更新

检查：

- 是否 push 到 `main` 分支。
- Actions 是否成功执行。
- `Settings -> Pages` 是否选择 GitHub Actions。
- 自定义域名 DNS 是否生效。

### 4. 自定义域名无法访问

检查 DNS：

```text
类型: CNAME
主机记录: docs
记录值: <你的 GitHub 用户名>.github.io
```

然后在 GitHub Pages 中设置：

```text
Custom domain: docs.yxuefeng.com
Enforce HTTPS: enabled
```

