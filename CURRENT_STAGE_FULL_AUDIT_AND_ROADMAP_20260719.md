# idlewuxia 当前阶段完整审计、施工说明与 Roadmap

生成日期：2026-07-19

项目源码：`H:\MyProjectBack\idlewuxia`

Codex 证据区：`G:\codex`

技术参考母版：`H:\MyProjectBack\CasualGame\idledotshoot\prototype-novalite`

产品证据：`H:\MyProjectBack\idlewuxia\fangzhijianghu`

审计起点：`a85c46c39742f017367e3afd8889871b9de33bc6`

> 本文是当前施工主报告。旧报告仍保留历史价值，但其中的“通过”“已实现”“可上线”不得替代当前代码、当前门禁和当前浏览器/APK 证据。

## 0. 结论先行

当前项目处于：

**FB01 Web 技术纵切已建立，T02-02 交互真实性完成收口，首局核心运行时完整性已修复；但 Choice UI、三个延后战斗结果、全动作浏览器验收、自有资源和全屏视觉验收仍阻断上线。**

本轮可以确认：

- 358 个配置动作已逐项执行：219 个当前可见且全部被运行时接受，139 个没有真实执行模块的动作被明确隐藏并拒绝，0 个“未实现却返回 accepted”。
- 421 个结果定义中有 213 个被当前 FB01 分支引用；316 次实际结果出现里有 311 次达到当前 P3 运行时分类，仍有 5 次 P1。
- 186 个条件定义中有 93 个被当前 FB01 分支引用；这 93 个没有未支持语义，未知条件保持 fail-closed。
- 新增 12 项运行时完整性回归全部通过；此前复现的 5 个 P0 和 2 个 P1 均不再复现。
- 540×960 全新浏览器来源完成真实 UI 首局路径、通用切磋、剧情切磋、DOM、溢出和控制台复验；新来源控制台 error 为 0。
- Android debug APK 构建和 APK/Web 字节追踪通过，但构建发生在脏工作树，正式 clean-revision 审计必须在最终提交后执行。
- `wuxia:check:fast` 通过且运行前后主流程配置 SHA-256 不变，证明快速检查不再偷偷改写源配置。
- `wuxia:release-gate` 按设计失败：它正确阻断仍存在的 5 条 P1，而不是把“审计脚本跑完”误报为“可上线”。

因此：

- **T02-02 可标记 done。**
- **T02-03 仍为 partial，不得标记 done。**
- **项目不得标记为 release ready。**
- 用户指定的 `COMBAT-002` 继续延后，本轮没有施工。

## 1. 当前现状

### 1.1 当前发布闭包

活动入口是 `src/wuxia-main.js`。当前 Web/APK 发布闭包为 10 个产品文件：

- `index.html`
- `src/styles.css`
- `src/dataClone.js`
- `src/runtimePersistence.js`
- `src/wuxia-main.js`
- `src/wuxiaFirstSessionFlow.js`
- `config/runtime_persistence_contract.json`
- `config/wuxia_first_session_flow.json`
- `config/wuxia_first_session_screen_contract.json`
- `public/wuxia-brand/icon.svg`

Capacitor 另生成 `cordova.js` 和 `cordova_plugins.js`。当前 APK 内 10 个产品文件、2 个平台生成文件全部与 Web manifest 字节一致，没有额外 Web 资产。

### 1.2 当前配置规模

| 项目 | 数量 |
|---|---:|
| 首局状态 | 11 |
| 首局 ActionRoute | 32 |
| 第一章节点 | 7 |
| 第一章房间 | 45 |
| NPC | 116 |
| 物件 | 23 |
| 配置实体动作 | 358 |
| resultLookup | 421 |
| conditionLookup | 186 |
| 门禁 | 12 |
| 奖励 | 7 |

### 1.3 完整阅读与检查边界

本轮不是关键词抽样。当前账本记录：

| 范围 | 数量 | 方法 |
|---|---:|---|
| Git 跟踪文件 | 191 | 逐文件路径、字节、行数、SHA-256 和检查方法登记 |
| Markdown | 26 | 全文阅读 |
| JSON | 42 | 全文件解析并遍历叶节点；2 个 BOM 文件按 BOM 兼容读取 |
| JS/MJS | 87 | 全量语法解析和源码结构清单；活动 `src` 与本轮关键工具再做全文语义阅读 |
| JS/MJS 总行数 | 20,518 | `node --check` 与源码清单 |
| Android 关键配置/Java/XML | 23 | 全文阅读并结合构建链验证 |
| 二进制 | 按账本 | 只做元数据、SHA-256 或视觉检查，不伪称“逐行阅读” |

机器账本：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\read_ledger_current.json`
- `G:\codex\temp_idlewuxia_full_audit\code_inventory.json`

证据边界：

- “全文阅读”只用于真实文本文件。
- “解析/清单”表示完整机器处理，不等同于人工证明每行语义正确。
- 历史报告只作为历史声明；只有当前代码、可重跑门禁和本轮浏览器/APK 结果可以证明当前状态。
- 旧浏览器证据缺少当前提交绑定，且至少一份旧 `real_browser_flow_summary.json` 已损坏，不能继续作为当前通过证据。
- PowerShell 初次显示的 CSS 中文乱码已撤回：Node UTF-8 读取证明源文件中文正确，属于终端解码误判，不是源码缺陷。

### 1.4 当前项目与技术母版逐文件/逐行对比

本轮重新生成当前项目与 `prototype-novalite` 的技术对比：

| 指标 | 数量 |
|---|---:|
| 文件并集 | 1,888 |
| 完全相同 | 117 |
| 同路径但已修改 | 50 |
| 当前项目独有 | 102 |
| 技术母版独有 | 1,619 |
| 逐行对比记录 | 378,303 |

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\technical_diff_summary_current.json`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\technical_file_diff_current.csv`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\technical_line_diff_current.csv`

逐行差异只能证明字节/文本关系，不能自动证明产品语义一致。产品语义仍以放置江湖 Lua、配置、录屏和当前运行时验证交叉判断。

### 1.5 产品证据链

当前活动配置共登记 1,014 个证据引用，归一后得到 23 个来源字符串：

- 20 个可以直接解析到当前证据文件；
- 3 个是被多种用途复用的 `source` 字段，属于字段语义歧义，不能直接定性为文件缺失；
- 没有证据证明当前存在“引用文件真实缺失”。

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\active_evidence_link_audit.json`

## 2. 存在问题

### 2.1 本轮已复现并修复

| 级别 | 问题 | 修复结果 |
|---|---|---|
| P0 | ActionRoute 拒绝后 flags/profile 已被提前修改 | 改为先校验、后提交，拒绝保持原子性 |
| P0 | 非法数值条件 fail-open | 非有限数值统一 fail-closed |
| P0 | snapshot 的 action/state 可从外部反向修改 | snapshot 深复制 |
| P1 | event snapshot 可从外部反向修改 | event 深复制 |
| P0 | 合成材料为 0 仍成功并产生负库存 | ResultEffect 统一预检，库存不可小于 0 |
| P0 | 结构不完整但版本兼容的存档通过恢复，随后 Runtime 崩溃 | 存档形状深校验 |
| P1 | `roomBlocked` 文案不进入房间日志 | 房间日志接入 `roomBlocked` |
| P0 | present/sale/kill/apprentice/pickup 等只有反馈文案却返回 accepted | 无真实分支动作隐藏且拒绝 |
| P0 | 无 CombatPolicy 的 combat 结果被伪执行 | 隐藏并明确 postponed |
| P0 | 需要选项 UI 的结果被当作文本完成 | 隐藏并明确 postponed |
| P1 | 通用切磋无 `comparewin` 分支时控制台报错并卡住战斗 | 对齐参考：战斗成功返回地图；只有匹配剧情分支时才执行副作用 |

通用切磋语义的参考依据：

- `FightResult.lua` 的“主动切磋”总是进入战斗；
- 胜利、失败、逃跑后调用条件结果解释器；
- 没有匹配条件结果时仍完成战斗，不应凭空授予剧情副作用，也不应把战斗判成失败；
- 有 `comparewin` 分支时才执行对应 narrative、marker、换人等结果。

### 2.2 当前仍开放的 P1

当前 316 次被使用的结果出现中仍有 5 次 P1：

| SourceId | ResultId | Action | 当前状态 |
|---|---|---|---|
| `bf2r06_1` | `bf2tankuang1` | 弹出选项框 | Choice UI 未实现 |
| `tmnpc01d` | `tmchoice01` | 弹出选项框 | Choice UI 未实现 |
| `fb01r16_3` | `compare` | 主动切磋 | 战斗占位，按用户要求延后 |
| `fb01r41_1` | `inattack201` | 传承战斗 | 战斗占位，按用户要求延后 |
| `fb01r42_1` | `inattack202` | 传承战斗 | 战斗占位，按用户要求延后 |

严格发布门禁将这 5 次聚合为 1 个 P1 `runtime_result_token` 问题并返回非零。

### 2.3 配置动作与可达性

358 个配置动作当前执行矩阵：

| 分类 | 数量 |
|---|---:|
| 可见 | 219 |
| 有意隐藏 | 139 |
| accepted | 219 |
| rejected | 139 |
| talk/只读反馈 | 106 |
| 配置驱动通用/剧情切磋 | 66 |
| 有状态副作用 | 47 |
| accepted 且含未实现状态 | 0 |

139 个隐藏动作不是“已完成”，而是防止伪执行的安全状态：

- 135 个没有真实运行时分支；
- 2 个等待 Choice UI；
- 3 个等待战斗模块；
- 配置分类存在交叉，以上分项以审计工具的最终状态表为准。

实体可达性：

| 项目 | 数量 |
|---|---:|
| 实体总数 | 139 |
| 可达实体 | 126 |
| 不可达实体 | 13 |
| 可达动作 | 331 |
| 不可达动作 | 27 |

13 个不可达实体不能简单删除：其中包含替换态、活动态、寻宝态和配置孤儿，需要逐个确认生成入口、活动范围或真实死配置。

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\configured_action_runtime_audit.json`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\entity_reachability_audit.json`

### 2.4 条件与结果解释器剩余边界

条件：

- 186 个条件定义；
- 93 个被当前分支引用，93 个暂未引用；
- 57 个由上下文路由，126 个由通用解释器处理，3 个语义暂不支持但均未被当前分支使用；
- 当前引用里没有 missing token，也没有 used unsupported；
- 玩家标记等于/大于/小于与设置/变化已补齐；
- unknown 继续默认拒绝。

结果：

- 421 个结果定义；
- 213 个被当前分支引用，208 个未引用；
- 当前分支出现 316 次；
- 311 次已进入当前 P3 分类，5 次 P1；
- 9 个合成结果已接入统一库存预检；
- 不能把“未引用的 208 个结果”说成运行时已验收。

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\condition_runtime_semantics_audit.json`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\result_runtime_semantics_audit.json`

## 3. 修改方案

本轮采用“能力在代码、内容在配置、未知默认拒绝、提交前统一预检”的模块化方案：

```text
InteractionDefinition
        |
        v
ActionAvailability --------> visible / available / reason
        |
        v
BranchDecision ------------> condition tokens
        |
        v
ResultEffectPreflight -----> projected state, no mutation
        |
        v
RuntimeCommit -------------> state/event/pending combat
        |
        v
Snapshot ------------------> deep detached output
```

战斗结果按参考语义拆为两层：

```text
CombatSession outcome
        |
        +--> no matching condition branch
        |       -> combat resolved
        |       -> no story side effect
        |
        +--> matching comparewin/comparelose/comparerunaway branch
                -> preflight result effects
                -> commit configured narrative/state/entity effects
```

这避免：

- UI 自己决定奖励；
- 文案存在就算执行成功；
- 无剧情分支的通用切磋被误判为错误；
- 有剧情分支时提前泄漏 `comparewin`；
- 执行到一半才发现库存、奖励或存档结构无效。

## 4. 修改范围

本轮只修改项目代码、测试、审计工具和相关 Markdown，不修改 `fangzhijianghu` 参考资料，不修改 `idledotshoot` 技术母版，不进入 UE5 项目。

代码范围：

- `package.json`
- `src/runtimePersistence.js`
- `src/wuxia-main.js`
- `src/wuxiaFirstSessionFlow.js`
- `tools/audit-wuxia-fb01-interaction-coverage.mjs`
- `tools/audit-wuxia-fb01-result-token-runtime-coverage.mjs`
- `tools/audit-wuxia-stage-online-standard.mjs`
- `tools/test-wuxia-first-session-interactions.mjs`
- `tools/test-wuxia-runtime-integrity.mjs`

文档范围：

- `CURRENT_STAGE_FULL_AUDIT_AND_ROADMAP_20260719.md`

## 5. 配置变化

本轮没有直接修改 `config/wuxia_first_session_flow.json` 的内容。

`wuxia:check:fast` 运行前后 SHA-256：

`61B3CD3FBF5F679BD0BCC6C55571E135AF94FBA9A952EE07B348C49F329F4EFF`

前后一致，证明检查链是只读的。所有会改写配置的同步命令已集中到 `wuxia:sync:all`，不再混入快速检查。

后续 Choice UI 施工必须新增或正式化 ChoiceDefinition/OptionDefinition，而不是在 JS 中硬编码 `bf2tankuang1` 或 `tmchoice01`。

## 6. 代码变化

### 6.1 Runtime

- snapshot、事件、ActionRoute 输出改为深复制；
- dispatch 奖励和结果在写状态前统一验证；
- 非法数值条件默认拒绝；
- 玩家普通标记补齐读取、比较、设置和增量语义；
- 合成和库存变化使用 projected inventory 预检；
- NPC/物件交互先验证结果效果，再提交选择态和副作用；
- 无真实执行分支的动作返回 `visible:false`、`accepted:false`；
- Choice UI 与无策略战斗结果明确 postponed，不再伪执行；
- 通用切磋与剧情切磋共享 CombatPolicy，但只有命中结果分支时才执行剧情副作用；
- 战斗结果效果验证失败时保留 pending combat，不产生半提交状态。

### 6.2 Persistence

兼容存档现在验证：

- runtime schema、chapterId、currentState；
- flags、events；
- selected node/room/NPC/interactable；
- hidden/add/replacement entity maps；
- map markers；
- pending combat 结构；
- player/taskState 基本对象形状。

不完整存档会被忽略并回到安全初始状态，不再进入 Runtime 后崩溃。

### 6.3 UI

- `roomBlocked` 进入可见日志；
- `visible:false` 的 NPC/物件动作不再渲染；
- 条件不足但有真实运行时能力的动作仍可显示为 disabled；
- 通用切磋结束后返回地图，不显示 `missing combat outcome branch`；
- 剧情切磋仍在命中 `comparewin` 后显示配置叙事并提交 marker/换人。

### 6.4 Audit/Gates

- 交互审计不再把全局文案动作当作语义已实现；
- 结果审计不再把战斗占位和 Choice UI 误标为 P3；
- `wuxia:check:fast` 改为只读；
- `wuxia:release-gate` 对 P0 或 P1 返回非零；
- 默认 `npm check` 指向当前武侠活动入口，不再默认执行旧 Nova 参考门禁；
- 旧门禁保留为 `check:legacy-novalite`。

## 7. 测试方式与结果

### 7.1 自动测试

| 门禁 | 结果 |
|---|---|
| `runtime:integrity:test` | 12/12 pass |
| `runtime:condition-negative` | 6/6 pass，negativeMutationCount=0 |
| `runtime:persistence:test` | pass |
| `runtime:first-session-simulator:test` | pass |
| `wuxia:test:first-session-interactions` | pass，54 events |
| `wuxia:check:fast` | pass |
| `wuxia:check:fast` 配置前后 SHA | unchanged |
| `wuxia:release-gate` | expected fail，剩余 5 条 P1 |
| 358 动作执行矩阵 | 219 visible/accepted，139 hidden/rejected，0 fake accepted |
| Android debug build | BUILD SUCCESSFUL |
| APK/Web 逐文件追踪 | 10/10 product、2/2 platform、unexpected=0 |

对抗性复现脚本在修复后：

- checks=8；
- reproduced=0；
- P0=0；
- P1=0。

证据：

- `G:\codex\temp_idlewuxia_full_audit\adversarial_runtime_audit.json`

### 7.2 浏览器实机

本轮使用全新浏览器来源和 540×960 视口，从出生选择开始，通过真实 UI 依次完成：

1. 出身选择；
2. 标题开始；
3. 状态页；
4. 零工任务；
5. 5 次池边打鱼；
6. 第一章入口；
7. 石路到大门；
8. 原始老管家通用切磋；
9. 通用切磋无剧情副作用返回地图；
10. 交谈执行 `change1`；
11. 替换态老管家剧情切磋；
12. `comparewin` 结果回到地图并显示“厉害厉害”。

结果：

- 通用切磋可启动；
- 通用切磋没有伪造剧情副作用；
- 没有 `missing combat outcome branch`；
- 剧情切磋命中配置分支；
- document/body scrollWidth=clientWidth=540；
- 新来源控制台 error=0。

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\browser_acceptance_current.json`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\browser_540x960_generic_compete.png`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\browser_540x960_story_compete_resolved.png`

### 7.3 APK

当前 debug APK：

- package：`com.idlewuxia.app.debug`
- versionName：`0.1.0-p0-debug`
- launchable：`com.idlewuxia.app.MainActivity`
- bytes：4,451,108
- SHA-256：`a4b5e10636bd678ee60a2719643b7711c70c7414ee0b6be1989b17f894b76d10`
- audit status：pass
- formalReady：false，因为构建时工作树尚未提交

最终 Git 提交后必须再次执行 clean-revision APK 审计，才能形成正式提交绑定证据。

## 8. 风险

### 8.1 上线阻断

- 2 个 Choice UI 结果未实现；
- 3 个战斗结果按用户要求延后；
- 135 个没有执行模块的动作当前只能安全隐藏；
- 13 个实体和 27 个动作不可达，尚未逐项定性；
- 仅完成 540×960 当前关键路径，不是 11 屏 × 3 尺寸完整视觉验收；
- 当前资源仍包含 generated placeholder，未完成自有 AssetRegistry；
- 没有本轮真机安装、冷启动、前后台、Back、锁屏、强停恢复的新提交绑定证据；
- 当前战斗仍以固定 preview/timeline 为主，不能称为完整产品战斗模型；
- 商业化仍为 DEVELOPMENT_DEBUG，真实广告、支付和回执校验未建立。

### 8.2 误报风险

- `highRisk=0` 只说明交互审计没有“已标高风险”的行，不等于 358 个动作全部产品完成；
- `P2 closure=pass` 只说明当前 P2 分类闭合，不等于 P1、隐藏模块或未引用数据完成；
- Android debug build pass 不等于正式签名包、商店包或真机回归通过；
- 逐行差异 CSV 不等于参考项目功能已复制；
- 历史 `validation_report.json=pass` 不能覆盖当前严格门禁的 P1。

## 9. 未完成项与施工 Roadmap

### 9.1 当前任务状态

| 任务 | 状态 | 说明 |
|---|---|---|
| T02-01 物件条件分支拒绝 | done | 条件失败不改状态 |
| T02-02 交互真实性 | done | 0 fake accepted；无模块动作隐藏拒绝 |
| T02-03 结果执行器 | partial | 311/316 当前结果出现达到 P3，5 条 P1 |
| T02-04 条件执行器 | runtime in-scope done / metadata partial | 93/93 当前使用条件有运行时语义；证据字段仍需规范化 |
| T03-01 全交互验收 | open | 尚未完成 358 动作浏览器逐项状态断言 |
| T04-01 CombatSession | open | 固定 preview 尚未替换 |
| T05-01 11 屏三尺寸 | open | 本轮只验 540×960 关键路径 |
| T05-02 自有美术 | open | AssetRegistry 与 owned 资源未完成 |
| COMBAT-002 | postponed | 用户明确要求延后 |

### 9.2 下一施工项：T02-03A ChoiceResultExecutor

优先级：P1，当前建议的下一项。

玩家目标：

- 遇到配置的“弹出选项框”结果时，看到明确选项；
- 选择后只执行被选中的配置 continuation；
- 返回、取消、重复点击和存档恢复都不产生重复奖励。

配置设计：

```text
ChoiceDefinition
  choiceId
  title
  body
  options[]
    optionId
    label
    conditionTokens[]
    resultTokens[]
    continuationActionId
  cancelPolicy
  evidence
```

程序模块：

- `ChoiceResultInterpreter`：把 ResultEffect IR 转成 pending choice；
- `ChoiceSession`：唯一保存当前 choiceId、sourceId、可用 optionId 和版本；
- `ChoiceValidator`：校验 option 唯一性、结果引用和 continuation；
- `ChoiceCommitter`：对选中分支先 preflight，再一次性提交；
- `ChoiceRenderer`：只渲染配置，不识别 `bf2tankuang1`、`tmchoice01` 等具体 ID；
- `Persistence`：版本化保存 pending choice，兼容旧档；
- `Audit`：ChoiceDefinition 100% 引用解析，未知 option/result 默认拒绝。

自动门禁：

- `runtime:choice-schema`
- `runtime:choice-preflight`
- `runtime:choice-persistence`
- `runtime:choice-no-double-commit`
- `browser:choice-540x960`
- `wuxia:release-gate`

上线级验收：

- 两个当前 P1 Choice 结果都能从真实前置状态到达；
- 每个选项有 true/false 条件用例；
- 取消、返回、刷新、恢复、连点不会重复提交；
- 选择前后 state delta 精确；
- 未知选项和缺失 continuation 统一 fail-closed；
- 选项内容全部来自配置；
- 360×640、540×960、720×1280 无裁切；
- 控制台 0 error；
- 结果审计的 Choice P1 归零。

### 9.3 后续顺序

1. **T02-03A ChoiceResultExecutor**：收掉 2 条 Choice P1。
2. **T02-04B 条件证据字段规范化**：把 3 个歧义 `source` 字段拆成 `sourceFile/sourceRecord/sourceKind`，加 Schema 校验。
3. **T03-00 可达性清理**：逐个定性 13 个不可达实体、27 个不可达动作；补入口、明确活动 scoped-out 或删除死配置。
4. **T03-01 全动作状态断言**：358/358 记录前置、可见性、可用性、实际 delta、截图和结果。
5. **T05-01 11 屏三尺寸视觉验收**：建立当前提交绑定的 33 组合截图矩阵。
6. **T05-02 AssetRegistry**：替换 generated placeholder，建立授权、来源、用途和打包门禁。
7. **T04-01 CombatSession**：在用户解除延后后施工确定性胜负、失败、逃跑和真实战斗状态。
8. **Android clean audit + 真机回归**：对最终提交 APK 做正式审计和设备证据。
9. **Release Gate**：必须 P0=0、P1=0、正式 APK/设备/视觉/资源门禁全绿后才允许宣称上线。

## 10. 事实、推断与未知

### 已确认事实

- 当前代码、配置、测试、构建和浏览器结果如本文所列；
- 5 条 P1 被严格门禁真实阻断；
- 358 动作没有 fake accepted；
- 当前使用的 93 个条件没有 unsupported；
- 当前 APK/Web 字节一致；
- 当前不具备上线条件。

### 设计推断

- Choice UI 是在不进入延后战斗工作的前提下，最能减少当前发布 P1 的下一施工项；
- 13 个不可达实体中一部分可能是活动态或替换态，不能在没有入口证据前直接删除；
- 135 个隐藏动作应按独立能力模块逐类开放，而不是恢复通用反馈 fallback。

### 当前未知

- 13 个不可达实体每个是否应补入口、保留为活动配置或删除；
- 208 个未被当前 FB01 分支引用的结果在未来模块中的真实需求；
- 全 11 屏在三种目标尺寸的视觉质量；
- 当前最终提交 APK 在真机上的冷启动、生命周期和返回键表现；
- 自有美术、音频、商业化和正式签名发布链完成时间。
