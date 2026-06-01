# 阶段六验证命令附录

## 环境变量

```bash
export HTTP_PROXY=http://192.168.2.1:7890
export HTTPS_PROXY=http://192.168.2.1:7890
export ALL_PROXY=socks5://192.168.2.1:7890
export GOPROXY=https://goproxy.cn,direct
```

## 工具版本

```bash
go version
docker version
docker buildx version
kind version
kubectl version --client=true
helm version
kubebuilder version
```

## CRD 基线

```bash
kubectl apply --server-side -f operator/crds/base
kubectl wait --for=condition=Established \
  crd/todoapps.platform.todo.example.com \
  crd/tododatabases.platform.todo.example.com \
  crd/todocaches.platform.todo.example.com \
  --timeout=60s
kubectl api-resources --api-group=platform.todo.example.com
kubectl explain todoapp.spec
kubectl explain tododatabase.spec
kubectl explain todocache.spec
kubectl apply --dry-run=server -f operator/samples/todoapp.yaml
kubectl apply --dry-run=server -f operator/samples/tododatabase.yaml
kubectl apply --dry-run=server -f operator/samples/todocache.yaml
kubectl apply --dry-run=server -f operator/samples/invalid-todoapp.yaml
```

## Controller 模拟与手写 Controller

```bash
cd operator/controller-simulator
go run .

cd ../handwritten
go build ./...
```

## Kubebuilder 生成、测试和部署

```bash
cd operator/kubebuilder
make generate
make manifests
go test ./...
make setup-envtest
make test
KUBEBUILDER_ASSETS="$(pwd)/bin/k8s/1.35.0-linux-amd64" go test ./test/envtest -v
```

## Operator 镜像构建与 kind 加载

```bash
cd operator/kubebuilder
docker build \
  --build-arg HTTP_PROXY="${HTTP_PROXY}" \
  --build-arg HTTPS_PROXY="${HTTPS_PROXY}" \
  --build-arg ALL_PROXY="${ALL_PROXY}" \
  --build-arg GOPROXY="${GOPROXY}" \
  -t registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test .

kind load docker-image registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test \
  --name todo-gitops
```

## Kustomize 部署与 Watch 边界

```bash
cd operator/kubebuilder
make deploy IMG=registry.cn-guangzhou.aliyuncs.com/yleoer/todo-operator:v0.4.0-test
kubectl -n operator-system rollout status deploy/operator-controller-manager --timeout=180s
kubectl -n operator-system get deploy operator-controller-manager -o yaml
```

带接管标签的对象应被调谐：

```bash
cat <<'YAML' | kubectl apply -f -
apiVersion: platform.todo.example.com/v1alpha1
kind: TodoApp
metadata:
  name: todo-operator-managed
  namespace: todo-operator-smoke
  labels:
    platform.todo.example.com/managed: "true"
spec:
  image: registry.cn-guangzhou.aliyuncs.com/yleoer/hello:plain-text
  replicas: 1
  port: 80
YAML

kubectl -n todo-operator-smoke get todoapp,deploy,svc
```

未带接管标签的对象不应生成 Deployment/Service：

```bash
cat <<'YAML' | kubectl apply -f -
apiVersion: platform.todo.example.com/v1alpha1
kind: TodoApp
metadata:
  name: todo-operator-unmanaged
  namespace: todo-operator-smoke
spec:
  image: registry.cn-guangzhou.aliyuncs.com/yleoer/hello:plain-text
  replicas: 1
  port: 80
YAML

kubectl -n todo-operator-smoke get todoapp,deploy,svc
```

## kind e2e

```bash
cd operator/kubebuilder
chmod +x test/e2e/run-kind-e2e.sh
./test/e2e/run-kind-e2e.sh
```

## Helm 发布、升级和回滚

租户 namespace 需要先存在：

```bash
kubectl create namespace todo-team-a --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace todo-team-b --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace todo-team-a platform.todo.example.com/admission=enabled --overwrite
kubectl label namespace todo-team-b platform.todo.example.com/admission=enabled --overwrite
```

Helm 验证：

```bash
helm lint operator/helm/todo-operator
helm template todo-operator operator/helm/todo-operator \
  --namespace todo-operator-system \
  --include-crds >/tmp/todo-operator-stage06.yaml

helm install todo-operator operator/helm/todo-operator \
  -n todo-operator-system \
  --create-namespace
helm upgrade todo-operator operator/helm/todo-operator -n todo-operator-system
helm rollback todo-operator 1 -n todo-operator-system

kubectl -n todo-operator-system rollout status deploy/todo-operator-controller-manager --timeout=180s
helm history todo-operator -n todo-operator-system
```

如果首次安装因 namespace 缺失失败，需要清理失败 release 后重跑：

```bash
helm uninstall todo-operator -n todo-operator-system
```

## 生产基线

```bash
SA=system:serviceaccount:todo-operator-system:todo-operator
kubectl auth can-i create deployments.apps --as="${SA}" -n todo-team-a
kubectl auth can-i delete todoapps --as="${SA}" -n todo-team-a
kubectl auth can-i create deployments.apps --as="${SA}" -n kube-system

kubectl -n todo-operator-system get deploy,svc,pod,certificate,issuer,pdb
kubectl get mutatingwebhookconfiguration,validatingwebhookconfiguration | grep todo-operator
```

Metrics 验证：

```bash
kubectl -n todo-operator-system port-forward svc/todo-operator-metrics 18083:8080
curl -fsS http://127.0.0.1:18083/metrics | grep controller_runtime_reconcile
```

## 最终交付

```bash
test -f deployments/final/todoapp-local-smoke.yaml
test -f deployments/final/todoapp-full.yaml
test -f deployments/gitops/applications/todo-platform-final.yaml
test -f .github/workflows/final-integration.yml
test -x scripts/final-verify.sh

kubectl apply --dry-run=client --validate=false -f deployments/final/todoapp-local-smoke.yaml
kubectl apply --dry-run=client --validate=false -f deployments/final/todoapp-full.yaml
kubectl apply --dry-run=client --validate=false -f deployments/gitops/applications/todo-platform-final.yaml

kubectl apply --dry-run=server -f deployments/final/todoapp-local-smoke.yaml
kubectl apply --dry-run=server -f deployments/final/todoapp-full.yaml

kubectl apply -f deployments/final/todoapp-local-smoke.yaml
kubectl -n todo-team-a rollout status deploy/todo-platform-final --timeout=180s
kubectl -n todo-team-a get todoapp,deploy,svc,pod

scripts/final-verify.sh
MANIFEST=deployments/final/todoapp-full.yaml scripts/final-verify.sh
```

## 文档构建

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
mkdocs build --strict
```

当前仓库实测注意事项：

- 系统 Python 受 PEP 668 保护，直接 `pip install --user -r requirements.txt` 会失败，建议使用 `.venv`。
- `requirements.txt` 的 `mkdocs-material>=9.5.0` 会安装 9.7.6；strict 模式下会因供应商 warning 失败。临时复测可执行 `python -m pip install 'mkdocs-material<9.7'`。
- 即使 pin 到 9.6.23，当前仓库仍因全站 nav / git-revision warning 在 `--strict` 下失败，需要修复仓库级配置。
