# idlewuxia R0 项目基线与范围门禁

## 目的

R0 把 HTML/Capacitor 武侠项目的“项目范围”从口头约定变成可执行合同。它解决四个问题：

1. 唯一活动入口必须是 `index.html -> src/wuxia-main.js`。
2. 运行时配置与竞品研究证据必须隔离。
3. Web/APK 资产必须来自显式白名单，禁止整目录复制。
4. 研发 JSON 可保留证据字段，但 Web/APK 发布副本必须剥离本机和竞品证据路径。
5. 每次任务结束必须能产生可复核、可重复的 Git 文件基线。

## 数据合同

- `config/project_scope.json`：活动入口、活动运行时、活动配置、开发证据、发布文件、发布 JSON 清洗规则、禁止跟踪目录和文件分类。
- `config/project_baseline_contract.json`：摘要算法、清单列、文件大小上限、阻断代码和发布 Git 条件。

运行时内容保持数据驱动：具体章节、房间、NPC、动作、条件、结果、文案和资源引用属于 JSON；代码只负责合同解释、状态转换、校验、路由和渲染。项目范围同样采用这个规则，CI、构建脚本和本地门禁都消费同一份 `project_scope.json`，不维护第二套硬编码清单。

## 深模块边界

`tools/lib/project-baseline.mjs` 对外只暴露基线评估接口和测试用内存文件系统。模块内部负责：

- 路径归一化与范围分类；
- SHA-256 文件清单和确定性基线摘要；
- HTML 唯一入口校验；
- 活动配置引用闭包校验；
- 竞品证据与发布闭包隔离；
- 禁止目录、未知路径、超大文件和未跟踪文件阻断；
- 发布时工作树和上游提交一致性检查。

Git/磁盘读取、控制台输出和报告写入位于 `tools/project-baseline.mjs` 适配层，领域判断不依赖 shell，因而可以用内存文件系统做快速回归测试。

## 执行命令

任务开始：

```bash
git status -sb
git pull --ff-only origin main
npm run task:preflight
```

`task:preflight` 使用可移植的 `wuxia:validate:first-session:runtime`，校验运行时结构和证据字段，但不要求 CI 机器持有被 Git 排除的竞品证据文件。研发机仍使用 `wuxia:validate:first-session` 执行完整本地证据存在性门禁；两者不能相互冒充。

开发中：

```bash
npm run baseline:test
npm run scope:validate
npm run baseline:build
npm run build:web
```

提交前：

```bash
npm run task:preflight
npm run build:web
git diff --check
```

提交后、推送前，在干净工作树上执行：

```bash
npm run baseline:verify
```

推送后校验远端提交一致性：

```bash
npm run baseline:verify:remote
```

## 产物

`baseline:build` 与 `baseline:verify` 在忽略目录 `outputs/project_baseline/<commit>/` 生成：

- `baseline_manifest.csv`：每个跟踪文件的路径、分类、字节数和 SHA-256；
- `baseline_summary.json`：机器可读结论与 Git 状态；
- `scope_gate.json`：范围阻断项；
- `baseline_report.md`：人工复核摘要。

生成时间不参与摘要。摘要只由按路径排序的文件路径、分类、规范化字节数和文件哈希组成。UTF-8 文本在哈希前统一为 LF，二进制保持原始字节，因此相同提交在 Windows 与 Linux 检出后得到相同 `baselineDigest`。

## R0 上线级完成定义

以下条件必须同时满足：

- 基线单元测试全部通过；
- 范围门禁零 P0；
- 活动入口门禁零 P0；
- 首局配置验证通过；
- 构建目录与 `shippingFiles` 完全一致；
- `www` 不含竞品参考配置、本机/竞品证据路径、旧射击模板配置或未声明资源；
- Git 工作树干净，HEAD 与已配置上游一致；
- CI 在 Node 24 上重复通过。

R0 通过只证明“项目身份、范围和构建闭包可控”，不等于 APK 已达到产品上线标准。Android 包名、签名、权限、版本策略、真实战斗、完整动作解释器、视觉资源与真机验收分别在后续 P0/R1-R9 门禁关闭。
