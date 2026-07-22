# idlewuxia 当前阶段完整审计、施工说明与 Roadmap

生成日期：2026-07-19

项目源码：`H:\MyProjectBack\idlewuxia`

Codex 证据区：`G:\codex`

技术参考母版：`H:\MyProjectBack\CasualGame\idledotshoot\prototype-novalite`

产品证据：`H:\MyProjectBack\idlewuxia\fangzhijianghu`

审计起点：`a85c46c39742f017367e3afd8889871b9de33bc6`

> 本文是当前施工主报告。旧报告仍保留历史价值，但其中的“通过”“已实现”“可上线”不得替代当前代码、当前门禁和当前浏览器/APK 证据。

> 2026-07-19 生产 OS 重整补充：Codex Game Development OS 2.3.0 的项目级 HTML/Capacitor Active Overlay、生产 Schema、程序/配置/资产 G0-G7 Roadmap 和验证工具已接入。新的生产入口为 `docs/codex_game_development_os/README.md`，机器权威为 `config/production/production_stage_plan.json`。本报告继续保留 T02 的详细施工证据；若任务状态与生产配置冲突，以当前代码、实时门禁和生产配置为准。

## 0. 结论先行

当前项目处于：

**FB01 Web 技术纵切已建立，T02-02 交互真实性、T02-03A ChoiceResultExecutor 和 T02-04B 条件证据字段规范化已完成；但三个延后战斗结果、全动作浏览器验收、自有资源和全屏视觉验收仍阻断上线。**

本轮可以确认：

- 358 个配置动作已逐项执行：220 个当前可见且全部被运行时接受，138 个没有真实执行模块的动作被明确隐藏并拒绝，0 个“未实现却返回 accepted”。
- 421 个结果定义中有 213 个被当前 FB01 分支引用；316 次实际结果出现里有 313 次达到当前 P3 运行时分类，仍有 3 次 P1。
- 186 个条件定义中有 93 个被当前 FB01 分支引用；这 93 个没有未支持语义，未知条件保持 fail-closed。
- 16 项运行时完整性回归和 10 项 Choice/结果链专项回归全部通过；此前复现的 5 个 P0 和 2 个 P1 均不再复现。
- 540×960 全新浏览器来源完成真实 UI 首局路径、通用切磋、剧情切磋、DOM、溢出和控制台复验；新来源控制台 error 为 0。
- Android debug APK 构建、APK/Web 字节追踪和 clean-revision 审计均已通过；最终证据在文档收尾提交后重新生成并绑定。
- `wuxia:check:fast` 通过且运行前后主流程配置 SHA-256 不变，证明快速检查不再偷偷改写源配置。
- Choice 弹窗已在 360×800、390×844、540×960 三尺寸真实 Edge 中通过布局、焦点、交互、无溢出和控制台零错误验收。
- `wuxia:release-gate` 按设计失败：它正确阻断仍存在的 3 条延期 Combat P1，而不是把“审计脚本跑完”误报为“可上线”。

因此：

- **T02-02 可标记 done。**
- **T02-03A 可标记 done。**
- **T02-03 仍为 partial，不得标记 done。**
- **项目不得标记为 release ready。**
- 用户指定的 `COMBAT-002` 继续延后，本轮没有施工。

## 1. 当前现状

### 1.1 当前发布闭包

活动入口是 `src/wuxia-main.js`。ARCH-001 Slice 6 后 Web/APK 发布闭包为 20 个产品文件：

- `index.html`
- `src/styles.css`
- `src/browserAutomationAdapter.js`
- `src/chapterSession.js`
- `src/conditionEvaluator.js`
- `src/dataClone.js`
- `src/entityInteractionService.js`
- `src/evidenceContract.js`
- `src/navigationService.js`
- `src/resultEffectExecutor.js`
- `src/resultExecutionModules.js`
- `src/resultPreparation.js`
- `src/runtimePersistence.js`
- `src/uiFlowAdapter.js`
- `src/wuxia-main.js`
- `src/wuxiaFirstSessionFlow.js`
- `config/runtime_persistence_contract.json`
- `config/wuxia_first_session_flow.json`
- `config/wuxia_first_session_screen_contract.json`
- `public/wuxia-brand/icon.svg`

Capacitor 另生成 `cordova.js` 和 `cordova_plugins.js`。每次发布提交后必须重新构建并执行 clean-revision APK 审计，证明 20 个产品文件、2 个平台生成文件与 Web manifest 字节一致且没有额外 Web 资产。

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
| P0 | 需要选项 UI 的结果被当作文本完成 | 配置驱动 ChoiceDefinition、pending choice 和 continuation executor |
| P1 | 通用切磋无 `comparewin` 分支时控制台报错并卡住战斗 | 对齐参考：战斗成功返回地图；只有匹配剧情分支时才执行副作用 |

通用切磋语义的参考依据：

- `FightResult.lua` 的“主动切磋”总是进入战斗；
- 胜利、失败、逃跑后调用条件结果解释器；
- 没有匹配条件结果时仍完成战斗，不应凭空授予剧情副作用，也不应把战斗判成失败；
- 有 `comparewin` 分支时才执行对应 narrative、marker、换人等结果。

### 2.2 当前仍开放的 P1

当前 316 次被使用的结果出现中仍有 3 次 P1：

| SourceId | ResultId | Action | 当前状态 |
|---|---|---|---|
| `fb01r16_3` | `compare` | 主动切磋 | 战斗占位，按用户要求延后 |
| `fb01r41_1` | `inattack201` | 传承战斗 | 战斗占位，按用户要求延后 |
| `fb01r42_1` | `inattack202` | 传承战斗 | 战斗占位，按用户要求延后 |

严格发布门禁将这 3 次聚合为 1 个 P1 `runtime_result_token` 问题并返回非零。

### 2.3 配置动作与可达性

358 个配置动作当前执行矩阵：

| 分类 | 数量 |
|---|---:|
| 可见 | 220 |
| 有意隐藏 | 138 |
| accepted | 220 |
| rejected | 138 |
| 只读反馈 | 93 |
| 配置驱动通用/剧情切磋 | 66 |
| 有状态副作用 | 61 |
| accepted 且含未实现状态 | 0 |

138 个隐藏动作不是“已完成”，而是防止伪执行的安全状态：

- 135 个没有真实运行时分支；
- 3 个等待战斗模块；

实体可达性已在 T03-00 按配置声明的嵌套结果链重新计算。旧脚本没有完整解释“选项框 → 结果集 → 技能转换成功结果”，因此旧 13/27 只能作为历史线索，不能继续作为当前事实：

| 项目 | 数量 |
|---|---:|
| 实体总数 | 139 |
| 可达实体 | 129 |
| 受控休眠实体 | 10 |
| 未裁决不可达实体 | 0 |
| 可达动作 | 334 |
| 受控休眠动作 | 24 |
| 未裁决不可达动作 | 0 |

裁决结果：

- `bf2r06_1a`、`bf2r06_1b` 经选项结果链可达，`tmnpc01e` 经技能转换成功结果链可达；
- 春节厨师、中秋厨师、神书 NPC、3 个寻宝 NPC、2 个定时拜访替换态均由关闭的专属模块持有；
- 无入口旧商人进入 `legacy_vendor_quarantine`，在补齐房间或运行时注入证据前禁止向玩家暴露；
- 所有休眠模块均声明激活所有者、激活来源和启用前置条件，普通首局保持关闭。

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\configured_action_runtime_audit.json`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\entity_reachability_audit.json`（历史 v1，已被 T03-00 纠偏）
- `config/wuxia_fb01_entity_reachability_policy.json`
- `tools/audit-wuxia-fb01-entity-reachability.mjs`
- `outputs/t03_00_entity_reachability/entity_reachability_audit.json`

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
- 313 次已进入当前 P3 分类，3 次 P1；
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

T02-03A 已在 `config/wuxia_first_session_flow.json` 增加三个版本化策略：

- `choiceResult`：定义标题参数位、两个选项的标签/结果参数位、分隔符、显示前缀和关闭策略；
- `resultSet`：定义通用结果集动作、结果参数位、分隔符和最大递归深度；
- `skillConversion`：定义源/目标武学、玩家等级经验曲线、招式经验映射、残页映射及成功/失败结果参数位。

具体 NPC、结果 ID、武学、招式和残页 ID 均只存在于配置和测试证据中；通用运行时代码不识别 `bf2tankuang1`、`tmchoice01`、`biyunxinfa` 等内容 ID。

## 6. 代码变化

### 6.1 Runtime

- snapshot、事件、ActionRoute 输出改为深复制；
- dispatch 奖励和结果在写状态前统一验证；
- 非法数值条件默认拒绝；
- 玩家普通标记补齐读取、比较、设置和增量语义；
- 合成和库存变化使用 projected inventory 预检；
- NPC/物件交互先验证结果效果，再提交选择态和副作用；
- 无真实执行分支的动作返回 `visible:false`、`accepted:false`；
- Choice 结果生成版本化 pending choice，只允许配置声明的 optionId；
- 选项 continuation 先递归展开结果集、检测缺失引用/循环并完成 projected-state 预检，再一次性提交；
- 数据驱动武学转换按玩家等级经验上限复制武学经验、招式经验和残页，源记录不删除；
- pending choice 未解决时，其他 dispatch、导航和交互命令统一拒绝；
- 无策略战斗结果继续 postponed，不再伪执行；
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
- pending choice 结构，且兼容没有该字段的旧存档；
- player/taskState 基本对象形状。

不完整存档会被忽略并回到安全初始状态，不再进入 Runtime 后崩溃。

### 6.3 UI

- `roomBlocked` 进入可见日志；
- `visible:false` 的 NPC/物件动作不再渲染；
- 条件不足但有真实运行时能力的动作仍可显示为 disabled；
- Choice 弹窗从配置渲染标题和按钮，背景内容设为 `inert`，焦点锁定在弹窗内，Escape 不绕过显式选择策略；
- 选项完成后弹窗关闭并展示配置 continuation 的真实反馈；
- 通用切磋结束后返回地图，不显示 `missing combat outcome branch`；
- 剧情切磋仍在命中 `comparewin` 后显示配置叙事并提交 marker/换人。

### 6.4 Audit/Gates

- 交互审计不再把全局文案动作当作语义已实现；
- 结果审计将两条已具备 Definition、UI 和 continuation 的 Choice 标为 P3，战斗占位仍保持 P1；
- 交互审计将两条 Choice 标为 `configured_choice_result_executor`，不再误报为隐藏延期；
- `wuxia:check:fast` 改为只读；
- `wuxia:release-gate` 对 P0 或 P1 返回非零；
- 默认 `npm check` 指向当前武侠活动入口，不再默认执行旧 Nova 参考门禁；
- 旧门禁保留为 `check:legacy-novalite`。

## 7. 测试方式与结果

### 7.1 自动测试

| 门禁 | 结果 |
|---|---|
| `runtime:integrity:test` | 13/13 pass |
| `runtime:choice-result:test` | 10/10 pass，含两条 Choice、四个选项、缺失 continuation、存档、重复提交、循环拒绝和技能转换 |
| `runtime:condition-negative` | 6/6 pass，negativeMutationCount=0 |
| `runtime:persistence:test` | pass |
| `runtime:first-session-simulator:test` | pass |
| `wuxia:test:first-session-interactions` | pass，54 events |
| `wuxia:check:fast` | pass |
| `wuxia:check:fast` 配置前后 SHA | unchanged |
| `wuxia:release-gate` | expected fail，剩余 3 条延期 Combat P1 |
| 358 动作执行矩阵 | 220 visible/accepted，138 hidden/rejected，0 fake accepted |
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

T02-03A 另使用真实 Edge 对 Choice 弹窗完成三尺寸验收：

- 360×800、390×844、540×960 均无横向溢出或弹窗裁切；
- 标题与“是/否”按钮来自配置；
- 首个选项自动获得焦点，背景 screen 为 `inert` + `aria-hidden`；
- 选择“否”后 pending choice 清空，事件为 `choiceResolved`，显示真实配置反馈；
- 三个尺寸控制台 error 均为 0。

证据：

- `G:\codex\outputs\idlewuxia_full_audit_20260718\browser_acceptance_current.json`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\browser_540x960_generic_compete.png`
- `G:\codex\outputs\idlewuxia_full_audit_20260718\browser_540x960_story_compete_resolved.png`
- `H:\MyProjectBack\idlewuxia\outputs\t02_03a_choice_result\browser_acceptance.json`
- `H:\MyProjectBack\idlewuxia\outputs\t02_03a_choice_result\choice_360x800.png`
- `H:\MyProjectBack\idlewuxia\outputs\t02_03a_choice_result\choice_390x844.png`
- `H:\MyProjectBack\idlewuxia\outputs\t02_03a_choice_result\choice_540x960.png`

### 7.3 APK

上一已提交 clean revision 的历史 debug APK 基线（不代表尚未提交的 Slice 4）：

- package：`com.idlewuxia.app.debug`
- versionName：`0.1.0-p0-debug`
- launchable：`com.idlewuxia.app.MainActivity`
- bytes：4,458,704
- SHA-256：`cbf6cc92e6b492315eca9d594353409ffff711054b8e456fa1722a958f166503`
- audit status：pass
- historical formalReady：true；仅说明该历史构建与当时 clean revision 绑定。

Slice 4 必须在最终提交后重新构建并执行 clean-revision APK 审计；新 APK 的字节、哈希和提交绑定只能以该次审计报告为准，不能沿用本节历史值。

## 8. 风险

### 8.1 上线阻断

- 3 个战斗结果按用户要求延后；
- 135 个没有执行模块的动作当前只能安全隐藏；
- T03-00 已关闭，但 10 个受控休眠实体与 24 个动作尚未实现对应活动/任务模块；它们不会进入普通首局；
- 已完成 Slice 4 的 540×960 与 390×844 当前关键路径，但不是 11 屏 × 3 尺寸完整视觉验收；
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
| T02-03 结果执行器 | partial | 313/316 当前结果出现达到 P3，剩余 3 条均为延期 Combat |
| T02-03A ChoiceResultExecutor | done | 两条 Choice、四个选项、递归结果集、武学转换、存档和三尺寸浏览器验收通过 |
| T02-04 条件执行器 | done | 93/93 当前使用条件有运行时语义；T02-04B 证据字段规范化、Schema、验证和回滚链完成 |
| ARCH-001 Runtime/UI 模块拆分 | done | 六个切片完成；ChapterSession 唯一状态权威，DOM/自动化经统一 UI Intent Adapter |
| T03-01 全交互验收 | open | 尚未完成 358 动作浏览器逐项状态断言 |
| T04-01 CombatSession | open | 固定 preview 尚未替换 |
| T05-01 11 屏三尺寸 | open | Choice 已验三尺寸，但尚未覆盖 11 屏 × 3 尺寸 |
| T05-02 自有美术 | open | AssetRegistry 与 owned 资源未完成 |
| COMBAT-002 | postponed | 用户明确要求延后 |

### 9.2 已完成施工项：T02-03A ChoiceResultExecutor

完成日期：2026-07-19。两个 Choice P1 已归零，未进入用户延期的 Combat 工作。

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

- `resultExecutionModules.js`：纯函数生成 ChoiceDefinition 和数据驱动技能转换计划；
- `wuxiaFirstSessionFlow.js`：保存 pending choice、递归展开结果集、循环检测、预检和一次性提交；
- `wuxia-main.js`：配置驱动 ChoiceRenderer、焦点锁定和自动化接口；
- `runtimePersistence.js`：校验并恢复 pending choice，兼容旧档缺失字段；
- Audit：ChoiceDefinition 引用解析，未知 option/result 和循环默认拒绝。

自动门禁：

- `runtime:choice-result:test`
- `runtime:integrity:test`
- `wuxia:audit:fb01-interactions`
- `wuxia:audit:fb01-result-tokens`
- `wuxia:audit:choice-result-browser`
- `wuxia:release-gate`

上线级验收：

- 两个 Choice 结果都能从真实前置状态到达，四个选项均有状态断言；
- pending choice 可保存/恢复，解决后重复提交被拒绝；
- 选择前后 skillExp、skillMoveExp、inventory、marker、entity replacement、政绩和经验 delta 精确；
- 未知 option、缺失 result 和递归循环统一 fail-closed；
- 选项内容及具体武学/招式/残页映射全部来自配置；
- 360×800、390×844、540×960 无裁切和横向溢出；
- 三尺寸控制台 0 error；
- 结果审计 Choice P1=0。

### 9.3 已完成施工项：T02-04B 条件证据字段规范化

完成日期：2026-07-19。第一轮审计确认旧报告中的“3 个歧义 source”实际是 3 种唯一歧义值：两种 `|` 拼接的多文件主来源共出现在 8 个 Action 证据对象中，另一种是 `playerSeed.source=recording_observed` 把来源种类伪装成文件。独立 Standards/Spec 复审随后发现，旧 `sourceEvidence` 字段还存在 142 个复合字符串实例，生成器也会重新用 `|` 压平多引用；本项在关闭前已把这些二次缺口一并纳入修复。

完成内容：

- 新增 `idlewuxia.evidence.v2` 和 `config/wuxia_evidence_contract.schema.json`；
- 每个规范来源引用只包含一个 `sourceFile`、一个 `sourceRecord` 和一个 `sourceKind`；
- 8 个复合主证据对象迁移为 16 条独立引用，142 个复合 `sourceEvidence` 迁移为 308 条逐文件 supplemental 引用；
- playerSeed 改为引用开发态证据登记 Schema；登记项再定位录屏资产和 `FS_003_CHARACTER_STATUS`，不再让来源种类伪装成文件；
- 新增 `evidenceContract.js` 深模块，统一旧单来源兼容、规范引用、展示、校验和迁移；
- 新增双向迁移工具，`up -> down` 可无损恢复旧结构；
- 修复证据地图把 `playerSeed.level=1` 误当证据等级的问题；
- 实际使用 Ajv 执行 Draft 2020-12 Schema，而不是只比对 `$id`、版本和枚举；
- Schema 与运行时验证器同时拒绝复合 legacy `source`、复合字符串 `sourceEvidence`、空引用集和混合新旧形状，但暂时兼容读取 258 个无歧义旧单来源对象；
- repair 工具已改为输出 typed references，并通过隔离临时目录实跑回归；
- 证据地图和验收登记改为“一条来源一行”，生成阶段会主动拒绝再次出现 pipe-packed source/record；
- Web/APK 发布变换会成组移除 `evidenceSchema` 与全部开发态 provenance 字段；验证器同时检查源配置 Schema 有效、发布配置不存在半清洗契约或证据泄漏。
- GitHub clean checkout 不包含项目明确禁止提交的 `fangzhijianghu/` 开发证据根；验证器仅对这个显式外部根允许 unresolved，并继续对本机存在的文件做逐记录核验，其他未知缺失路径仍 hard fail。

自动门禁：

- `runtime:evidence-contract:test`：14/14 pass；
- `wuxia:validate:evidence`：0 findings；
- 151 个规范来源拥有者、325 条规范来源引用；其中 17 条项目内文件引用全部存在，308 条上游逻辑引用保留为逐文件地址；
- 17 个项目内文本记录检查全部定位成功；
- 复合 legacy source 与复合字符串 sourceEvidence 数量均为 0；
- 源配置 Draft 2020-12 Schema 有效，发布配置 evidence/provenance 泄漏数为 0；
- 证据地图生成 1,879 条逐来源记录，首局验收登记生成 81 条逐来源记录，pipe-packed source/record 为 0；
- `build:web`：12 个发布文件完成确定性物化；
- 浏览器实跑：`src/wuxia-main.js` 正常加载，`#wuxiaShell` 存在，页面可见且控制台 0 error/0 warning。
- `npm run check` 与 `wuxia:check:fast`：整体 pass；358 动作 highRisk=0，结果 P2=0，数据驱动边界 high=0。

### 9.4 后续顺序

1. **T03-01 全动作状态断言**：358/358 记录前置、可见性、可用性、实际 delta、截图和结果。
2. **SAVE-001 / OBS-001**：完成版本化存档恢复、回滚、事件和回放语义，关闭 G4。
3. **T05-01 11 屏三尺寸视觉验收**：建立当前提交绑定的 33 组合截图矩阵。
4. **T05-02 AssetRegistry**：替换 generated placeholder，建立授权、来源、用途和打包门禁。
5. **T04-01 CombatSession**：仅在用户解除延后后施工确定性胜负、失败、逃跑和真实战斗状态。
6. **Android clean audit + 真机回归**：对最终提交 APK 做正式审计和设备证据。
7. **Release Gate**：必须 P0=0、P1=0、正式 APK/设备/视觉/资源门禁全绿后才允许宣称上线。

## 10. 事实、推断与未知

### 已确认事实

- 当前代码、配置、测试、构建和浏览器结果如本文所列；
- 两条 Choice 已达到 P3，3 条延期 Combat P1 被严格门禁真实阻断；
- 358 动作没有 fake accepted；
- 当前使用的 93 个条件没有 unsupported；
- 当前 APK/Web 字节一致；
- 当前不具备上线条件。

### 设计推断

- T03-00 与 ARCH-001 已关闭；当前不触碰延期 Combat 的最小下一施工项是 T03-01；
- 10 个受控休眠实体必须通过各自模块合同激活，不能直接补进普通房间；
- 135 个隐藏动作应按独立能力模块逐类开放，而不是恢复通用反馈 fallback。

### 当前未知

- 无入口旧商人的真实上游激活来源仍未知，因此保持隔离、禁止暴露；
- 春节、中秋、神书、寻宝和定时拜访模块何时进入本项目生产范围仍未知；
- 208 个未被当前 FB01 分支引用的结果在未来模块中的真实需求；
- 全 11 屏在三种目标尺寸的视觉质量；
- 当前最终提交 APK 在真机上的冷启动、生命周期和返回键表现；
- 自有美术、音频、商业化和正式签名发布链完成时间。

## 2026-07-19 ARCH-001 续施工补充

- 已完整阅读当前 1,938 行 Runtime、1,229 行 UI 控制器、现有辅助模块和 1,455 行直接相关测试。
- `src/conditionEvaluator.js` 已作为 ARCH-001 切片 1 提取，显式接收定义和 Runtime 状态，保持无 mutation。
- 旧 `createFirstSessionRuntime` facade、快照、事件和存档 DTO 未改变。
- 新合同测试已按红灯到绿灯执行，并接入 `task:preflight` 与 `wuxia:check:fast`。
- 条件负路径仍为 6/6、`negativeMutationCount=0`；Runtime integrity 15/15；Choice/Result 10/10；首局完整交互 PASS。
- 真实 Edge `interaction-contract` 在 dev-server 就绪后完成 20 步、0 failures；首次未启动服务器的 `ERR_CONNECTION_REFUSED` 作为环境诊断保留，不冒充产品失败。
- 本段历史执行时 Android sync 与 Web bundle freshness 按旧白名单报告 12 文件；Slice 2B 完整运输链复核已确认该白名单漏模块，最终结论以随后修正的 15 文件闭包复验为准。
- 该历史切片结束时 ARCH-001 仍为 `open`：Entity、ChapterSession 和 UI adapter 尚未拆分；当前状态以文末 UI Flow Adapter 切片为准。
- `T03-01` 继续等待 ARCH-001 完成；COMBAT-002 与 CombatSession 继续延期。

## 2026-07-19 ARCH-001 Result preparation 续施工

- `src/resultPreparation.js` 已完成 ARCH-001 切片 2A；
- ResultSet 展开、防循环、Choice/SkillConversion 准备、库存与合成预检均在纯模块内完成；
- 库存类别、动作、参数位与配方分隔符由 `inventoryMutation` 配置策略驱动；
- 调用方玩家状态不被 preparation 修改，失败在 Effect commit 前关闭；
- Runtime facade、快照、事件和存档 DTO 保持兼容；
- `wuxia:check:fast` PASS，真实 Edge 20 步/0 failures，Android freshness 0 findings；
- Runtime 当前为 1,676 行，Result preparation 模块为 265 行；
- 该历史切片结束时 transactional Effect commit 已在 Slice 2B 提取，NavigationService 已在 Slice 3 提取；ARCH-001 当时因 Entity、ChapterSession 与 UI adapter 尚未完成而保持 `open`；当前状态以文末为准；
- COMBAT-002 与 CombatSession 继续延期。

## 2026-07-19 ARCH-001 Transactional EffectExecutor 续施工

- `src/resultEffectExecutor.js` 已完成 ARCH-001 切片 2B；旧 Runtime facade 仍是唯一状态权威，Executor 只拥有单次调用的隔离草稿；
- 完整运输链复核发现旧 12 文件白名单漏掉已被 Runtime 导入的 `conditionEvaluator.js` 与 `resultPreparation.js`，并会继续漏掉新 Executor；`config/project_scope.json` 已改为 15 文件闭包，三者都进入 Web/APK，而 Runtime policy Schema 明确保持开发期、不运输；
- 新增 `idlewuxia.runtime_mutation_policy.v1` 及 Draft 2020-12 Schema，类别、动作、参数位、默认值、列表分隔符、既有 Combat follow-up 与失败策略全部由配置定义并由 Ajv 实际校验；
- 任一未知、缺参、非法数值或执行异常会拒绝整条 branch、丢弃草稿并返回空 `sideEffects`；房间阻挡失败也产生结构化 rejection，不再伪装成普通阻挡；
- Runtime integrity 15/15，模块合同、Choice/Result、Persistence、条件负路径、首局交互与快速总门禁均通过；
- 真实 Edge `interaction_condition_qa` 为 20 步、0 failures，最终状态 `STATE_FS_008_MAP_EXPLORE`；
- 540×960 人工视觉验收已检查房间首屏、NPC 长文本反馈、状态页与移动结果：无横向溢出、无原始 ID/调试文案，反馈可读可滚动，控制台 0 error/0 warning；
- 修正白名单后 `android:sync` 重新物化 15 个产品文件并复制到 Android，2 个平台生成文件保留，`wwwUnexpectedFiles=0`、`androidUnexpectedFiles=0`、`findings=0`；重新打开 `/www/` 人工复验仍通过；
- 暂存态项目基线 PASS：`trackedFileCount=238`、`shippingFileCount=15`、0 findings；
- 本切片为 `PASS WITH KNOWN LIMITATIONS`，不等于 ARCH-001、11 屏×3 尺寸、正式 APK、真机或项目上线完成；
- Slice 2B 的后继 NavigationService 已在 Slice 3 完成；当前下一施工项为 EntityInteractionService，`COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

## 2026-07-20 ARCH-001 NavigationService 续施工

- `src/navigationService.js` 已完成 ARCH-001 切片 3：以无状态服务解释节点、房间路线、配置化房间进入条件、活动 NPC 移动阻断和出口可用性；
- `chapterSystem.navigationPolicy` 与 `config/wuxia_navigation_policy.schema.json` 已取代 Runtime 内的房间 ID 正则和固定 `stop` Result ID；Schema 由 Ajv Draft 2020-12 实际执行；
- 节点/房间事件和存档 DTO 保持兼容，路线新增 `routeKind/navigationOnly` 观测字段；项目导航桥仍按既有产品策略保留，但显式限制为 navigation-only；
- 45 个房间连接均存在、方向唯一且互反；真实 FB01 移动阻断、事务失败、首局 54 事件、15/15 Runtime integrity、358 动作 `highRisk=0` 和内容边界 `high=0` 通过；
- Web/Android 发布闭包为 16 个产品文件，`www` 与 Android 运输文件 0 unexpected、0 freshness findings；
- 人工视觉首轮发现紧凑断点隐藏/截断阻断原因，修复后在 540×960 与 390×844 复验：阻断原因完整、出口 disabled、往返移动正确、无横向溢出、无原始 ID、控制台 0 error/0 warning；
- 本切片判定 `PASS WITH KNOWN LIMITATIONS`，不等于 ARCH-001、T05-01、正式 APK、真机或项目上线完成；
- 上一段为 Slice 3 历史结论；其后的 EntityInteractionService 已由下节完成。`COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

## 2026-07-21 ARCH-001 EntityInteractionService 续施工

- `src/entityInteractionService.js` 已完成 ARCH-001 切片 4：以无状态服务解释实体生命周期、房间归属、可见性、选择、动作唯一分支、Choice 预检、Combat 路由和配置反馈；
- `chapterSystem.entityInteractionPolicy` 与 `config/wuxia_entity_interaction_policy.schema.json` 已取代 Runtime 内的具体对话 actionType、`gorome` 排除规则、默认叙事 token、可见性字段和中文 fallback 文案；Schema 由 Ajv Draft 2020-12 实际执行；
- Runtime 继续独占状态、事件、存档和 ResultEffect 事务提交；公共 facade、快照、事件名称和存档 DTO 保持兼容；
- 修复 availability 与 execution 分支可能不一致的隐患：一次服务裁决返回唯一深拷贝分支，精确分支条件失败时不允许退回默认叙事；
- 服务合同、Runtime integrity 16/16、条件负路径 6/6、存档、Choice 10/10、首局 54 事件、358 动作 `highRisk=0` 和内容边界 `high=0` 通过；
- Web/Android 发布闭包为 17 个产品文件；浏览器工具新增页面 console/error、未捕获异常、Browser Log、横向溢出及顶部导航换行/截断硬门禁；
- 人工视觉首轮发现标题页“放置江湖”换行，修复后在 540×960 与 390×844 各执行 20 步：0 failures、0 page console problems、0 横向溢出、0 导航换行/截断；
- 最终 UI 同步修复后重新生成 40 张截图；36 张与上一轮 SHA-256 一致，4 张 Combat 时间敏感截图以原始分辨率单独复核通过；
- 本切片判定 `PASS WITH KNOWN LIMITATIONS`，不等于 ARCH-001、T05-01、正式 APK、真机或项目上线完成；
- 下一切片为 ChapterSession；`COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

## 2026-07-22 ARCH-001 ChapterSession 续施工

- `src/chapterSession.js` 已完成 ARCH-001 切片 5，成为章节会话唯一可写状态权威；`src/wuxiaFirstSessionFlow.js` 缩减为 19 行兼容 facade，不再持有或解释状态；
- ChapterSession 创建时隔离完整定义、可选初始章节和玩家种子；快照、命令结果、事件与存档 DTO 均脱离内部可变引用，调用方不能通过返回对象反向污染运行中会话；
- 首局默认旗标从源码迁移到 `sessionDefaults.initialFlags`，由 `config/wuxia_chapter_session_defaults.schema.json` 使用 Ajv Draft 2020-12 实际校验，并与旧屏幕启动兼容字段做一致性门禁；
- 独立 Standards/Spec 复审发现并推动关闭了章节快照 Definition、`options.initialChapter` 和返回 event 三类引用泄漏；公共命令对约 745 KB 快照的重复深拷贝也已消除；
- ChapterSession 合同测试覆盖公共接口白名单、状态与节点行为、定义隔离、返回值隔离、存档往返、配置默认旗标及旧 facade 逐命令等价；Runtime integrity 16/16、Choice 10/10、Persistence 和首局 54 事件保持兼容；
- 该历史切片把 Web/Android 发布闭包扩大为 18 个产品文件；Slice 6 再扩大为当前 20 个产品文件。开发期 Schema 不进入产品包；
- 真实 Edge 在 540×960 与 390×844 各完成 20 步交互，均为 0 failures、0 console problems；人工逐图检查全部 40 张首轮截图，并对 390×844 瞬时过渡帧完整重跑 20 步及复核关键原图；
- 该历史切片判定 `PASS WITH KNOWN LIMITATIONS`，其结束时 ARCH-001 为 `open`、进度为 Slice 5/6；UI view-model / intent mapper / browser automation seam 已在随后 Slice 6 完成；
- 本结论不等于 358/358、SAVE-001、OBS-001、11 屏×3 尺寸、AssetRegistry、Android 真机、签名 Release 或项目上线完成；
- `COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。

## 2026-07-22 ARCH-001 UI Flow Adapter 续施工

- `src/uiFlowAdapter.js` 与 `src/browserAutomationAdapter.js` 已完成 ARCH-001 切片 6；ChapterSession 继续是唯一可写状态权威，DOM 与浏览器自动化均经统一 Intent Mapper 调用；
- 支持 `dispatchAction`、节点/房间/NPC/物件选择与交互、Choice 解析共 8 类严格 Intent；未知、缺字段、空 ID 或额外字段全部 fail-closed 且零 mutation；
- `config/wuxia_ui_intent_contract.schema.json` 由 Ajv Draft 2020-12 实际编译，Schema 类型集合、非空白 ID 规则与 Runtime 语义交叉校验；具体章节、NPC、房间、动作和文案仍全部来自配置；
- `src/wuxia-main.js` 的 `state.runtime` 旁路为 0，发布闭包扩大为 20 个产品文件；开发 Schema 不进入 Web/APK；
- `wuxia:check:fast` 通过：Runtime integrity 16/16、Choice 10/10、首局 54 事件、358 动作 `highRisk=0`、内容边界 `high=0`；
- 人工验收先发现并关闭 390×844 状态属性折行与 Chromium 截图分块两项问题；最终真实 Edge 540×960 与 390×844 各完成 20 步，0 failures、0 console problems，全部 40 张最终截图逐图检查；浏览器工具已增加顶部垂直裁切、状态行折行和截图预热门禁；
- ARCH-001 更新为 `done`，但 G4 仍被 T03-01、SAVE-001、OBS-001 阻断；下一 P0 为 T03-01；
- `COMBAT-002`、Rest/Repair 与真实 CombatSession 继续延期。
