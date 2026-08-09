# idlewuxia 全代码、配置、资源、近五日任务发布前重审计 — 2026-08-04

## 1. 最终结论

本轮结论：**工程修复已通过静态/运行时/浏览器自动化门，但产品人工视觉门失败，项目仍为 `RELEASE_BLOCKED`。**

不得把以下不同证据合并成一个“完成”：

1. 全文件存在并可解析；
2. Schema、单测、回归和构建通过；
3. 浏览器路线 33/33 可到达且零控制台错误；
4. 人工检查认为画面和交互达到可发行产品质量；
5. 签名、真机、性能、合规、商店和回滚完成。

本轮第 1–3 层已建立或修复；第 4 层明确失败；第 5 层尚未开始闭环。

## 2. 三道审计门

### Gate 1 — 完整读取与静态契约

- 326 个正式项目文件逐字节读取，3,542,347 bytes，89,690 文本行。
- 67 个配置文件全部 JSON 解析；全部 JS/MJS/CJS 执行语法检查。
- 4 个最近五日提交、30 个唯一变更文件全部纳入历史覆盖。
- 资源磁盘枚举由 74 降为 47；27 个非法 Android 本地 PNG 已隔离并留有哈希清单。
- `production:validate`：PASS，6 份生产配置、8 个 Gate、42 个任务、33 个 UI 尺寸案例，结构 findings 0。
- Gate 1 verdict：**PASS WITH 10 PRODUCT BLOCKERS**。10 个都是必需资产槽，不是解析错误。

### Gate 2 — Runtime、回归与构建

已通过的关键证据：

- 358/358 动作状态断言。
- T02-02 交互真实性正负例：无“只给反馈却 accepted=true”的伪执行。
- 首局 simulator：14 个动作，mismatches 0；旧 first-session lifecycle mismatch 继续单列为历史诊断，不混入 T02-02 或 UI verdict。
- 战斗 Schema 与语义校验：3 阵营、3 单位、26 技能、16 Buff、2 Encounter、13 种技能类型、8 种 effect、7 种目标、6 种伤害、4 种控制，配置与 runtime 能力无缺口。
- 战斗正负例覆盖公式、派生属性、暴击、格挡、闪避、抗性、穿透、吸血、真伤、多目标、治疗、护盾、资源、净化、持续伤害/治疗、叠层、反伤、免疫、root、silence、stun、taunt、冷却、回合持续期、玩家显式目标和快照恢复。
- `android:resources:validate`：PASS。
- `android:sync`：26 个 shipping files 三层逐字节一致。
- `:app:assembleDebug`：最终同步后 PASS；APK 3,733,102 bytes，SHA-256 `b6d5ebf9b9da5b46f1af77b1ef6eaebd9100a668ddb615590a27926d5000e5c6`。
- APK 仍含第三方库自带的 202 个 PNG 条目，但旧产品资源名对应的是受控 XML/vector；不再含本地旧 `splash.png`/`product_icon.png`/密度 launcher PNG。

Gate 2 verdict：**PASS FOR CURRENT AUTHORED RUNTIME AND DEBUG BUILD；NOT A RELEASE BUILD**。

### Gate 3 — 最严格的真实浏览器与人工视觉

自动化首次运行失败并促成两项修复：

- 360×800 冷启动 `Page.navigate` 10 秒超时，调整为仅导航使用 30 秒门限；其余 CDP 命令仍为 10 秒 fail-closed。
- 战斗页面在没有真实用户手势时创建 Web Audio，产生 AudioContext warning；现在没有用户激活就跳过播放，真实交互后才启用。

修复后又因旧全链门禁发现“章节节点直接跳战斗但未创建 CombatSession”的伪入口；现已把外门、大院和大厅节点统一改为先进入 NPC 交互，只有配置化 NPC 战斗动作才能创建真实 CombatSession，repair 生成器同步修复。最终复跑证据为 `outputs/wuxia_visual_matrix/20260804_post_truthful_node_fix/browser_surface_sweep_report.json`：

- 11 个 screen；360×800、390×844、412×915 三个 viewport；33/33 pair 实际观察。
- `UI_NpcInteraction`、`UI_ChapterLoop` 条件路线 6/6。
- modal 3/3。
- coverage gaps 0；blockers 0；console error/warning 0。

但是我随后逐张检查了开场、标题、角色状态、挂机任务、地图、NPC、章节循环、弹窗和战斗三尺寸截图。人工 verdict：**FAIL**。理由：

- 标题页和多数系统页大面积空白，信息层级和武侠氛围不足。
- 地图仍是网格加矩形按钮，不是可发行章节地图表现。
- NPC 页只有四个大灰按钮和反馈文字，没有场景、角色身份、动作状态与情境层级。
- 角色页为粗糙文本/方块徽章，字体、图标、人物与布局未形成产品语言。
- 战斗虽已是真实 CombatSession 和玩家选招，但场景是黑灰轮廓、人物是 CSS 几何占位，技能列表密集且需要滚动；没有批准的侧视三头身角色、干净场景、动画、打击 VFX、Buff 图标或真实音频。
- 当前视觉与用户确认的“侧视、约三头身像素武侠、场景与角色分层、竖屏手游体验”标准不一致。

因此历史 `QA-UI-001_T05-01_*_20260725.md` 已加 superseded 声明：QA 工具可标记 done，T05-01 必须保持 blocked。

## 3. 本轮发现与修复清单

| ID | 严重度 | 问题 | 修复/状态 |
|---|---|---|---|
| COMBAT-FORMULA-001 | P0 | 未知 ref、非法 op、除零和派生循环可能静默产生错误结果 | fail-closed 校验与运行时异常；Schema/负例通过。 |
| COMBAT-DERIVED-002 | P0 | 修改基础属性后派生 initiative 等未重算 | 先修改基础上下文再计算派生属性。 |
| COMBAT-ROOT-003 | P0 | root 被当成 stun，错误跳过整个回合 | root 只禁止逃跑/位移语义，不禁止招式。 |
| COMBAT-TAUNT-004 | P0 | 显式目标可能绕过 taunt；正面自我 taunt 可能被控制免疫抵消 | 目标候选与显式目标统一过滤；正面 taunt 不走负面免疫。 |
| COMBAT-STACK-005 | P0 | 周期 Buff 叠层不放大 tick | `stackScaling` 显式配置并按 stacks 计算。 |
| COMBAT-DURATION-006 | P0 | 自施 Buff/Modifier 当回合立即减时长 | 使用 actionCount skip 标记；完整持续 N 个未来回合。 |
| COMBAT-COOLDOWN-007 | P0 | 冷却显示与“未来 N 个自身回合”语义不一致 | 内部 N+1、当回合结算后暴露 N。 |
| COMBAT-SNAPSHOT-008 | P0 | 恶意/损坏快照可注入未知 Buff/Skill、非法数值、重复单位或错误 RNG/队列 | 增加 roster、范围、引用、重复、队列、event、scene、rng 全量校验和负例。 |
| COMBAT-PRESENT-009 | P1 | 事件偏移和默认场景存在 runtime 魔数 | eventOffsetsMs 与 sceneId 配置驱动；护盾条不再永远 100%。 |
| QA-MATRIX-010 | P0 | 旧 UI sweep 用全局 screen 集合，某尺寸出现过即可替代其他尺寸 | 改为 `(screenId, viewportId)` pair 级闭合，增加 2×2 缺口负例。 |
| QA-COMBAT-011 | P0 | 浏览器 runner 名为 auto-resolve，可能再次伪造固定胜利语义 | 按当前 CombatControl 逐次提交配置技能/目标，等待真实 outcome。 |
| QA-AUDIO-012 | P1 | 无用户手势创建 AudioContext，控制台 warning | 用户未激活时不创建；真实交互后播放。 |
| BUILD-WRAPPER-013 | P0 | wrapper JAR 被全局 ignore，clean checkout CI 无法 Gradle 构建 | 精确 unignore 并纳入 Git；CI 新增 clean checkout assemble。 |
| ANDROID-RES-014 | P0 | 27 个旧射击/Capacitor PNG 污染本地 APK，原 Gradle exclude 实际无效 | SHA-256 隔离；新增资源来源 gate；添加 pre-26 vector launcher；重新构建并检查 APK。 |
| REPORT-TRUTH-015 | P1 | 报告仍写 COMBAT-002 延期，和当前用户优先级/代码不一致 | 报告由任务注册表动态生成；Rest/Repair 单独保持 postponed。 |
| VISUAL-016 | P0 | 自动路线 PASS 被误当成人工视觉完成 | T05-01 降为 blocked；10 个资产槽和人工失败写入权威 Roadmap。 |
| FLOW-COMBAT-017 | P0 | 外门、大院和大厅节点按钮直接进入战斗屏，但没有创建 pending CombatSession | 三个节点改为进入 NPC 交互；真实战斗只由配置化 NPC 动作建立；修复 repair 生成器和旧全链交互测试。 |
| RELEASE-AUDIT-018 | P0 | 旧 online-standard 工具只检查代码引用，未把必需资产槽和人工视觉失败纳入发布失败 | 接入生产 AssetRegistry 与 T05-01 状态；2026-08-04 正确报告 11 个 P0 和 1 个 P1。该 P1 的 3 条未授权战斗结果已于 2026-08-09 由 COMBAT-005 关闭，P0 资产/人工视觉阻断保持。 |
| CI-ANDROID-019 | P0 | 首次 clean-checkout Actions 的 `./gradlew` 因 Git 模式为 `100644` 返回 126 | 将 `android/gradlew` 以 `100755` 纳入 Git；不在 CI 内临时 chmod，确保仓库本身可复现。 |

## 4. 当前仍未关闭的上线阻断

1. ASSET-002～010：Android 图标/启动页、字体、地图、NPC、交互图标、战斗角色/场景/VFX/音频。
2. COMBAT-002：逻辑核心已显著收口，但产品表现和真实设备反馈未闭环。
3. T05-01：33/33 自动证据通过，人工视觉失败。
4. SAVE-001 与 OBS-001 已于 2026-08-09 完成浏览器侧治理：版本化存档、迁移、事务、损坏恢复，以及 7 类可观测事件、状态 delta、错误/性能字段和首分歧 replay。Android 真机断电/容量故障注入、远端运维接入及商业回滚演练继续由 REL-002/REL-003 阻断。
5. SEC-001：权限、隐私、secret、供应链与支付边界未完成。
6. REL-001～003：release 签名、AAB/APK、真机、性能、兼容、商店、灰度监控和回滚演练未完成。
7. 旧 idledotshoot 源/配置仍在仓库但被 shipping whitelist 隔离；需完成 HYGIENE-001，减少误用风险。

## 5. 最终九项施工报告

1. 当前现状：HTML/Capacitor 武侠纵切有真实配置驱动 runtime 和 debug 构建，尚无产品资产闭环。
2. 存在问题：人工视觉、资产、发布治理、真机与 Release Gate 阻断。
3. 修改方案：先修真值/配置/回归/构建污染，再把不可由代码假造的资产和发布证据保留为 fail-closed 任务。
4. 修改范围：CombatSession、战斗配置/Schema/测试、浏览器矩阵、Android 资源与 CI、生产配置、审计工具与 Markdown。
5. 配置变化：战斗 AI fallback、eventOffsets、严格 Schema、UI 11 屏全 active、10 个未满足的必需资产槽、42 项生产任务。
6. 代码变化：公式/控制/Buff/冷却/快照、真实玩家回合 runner、pair 覆盖、AudioContext、Android provenance gate。
7. 测试方式：完整读取、preflight、33/33 Edge、Android sync/assemble、APK 条目、人工逐图。
8. 风险：没有产品资产、没有真实音频、没有 release signing/device/store 证据；debug PASS 不可用于上线声明。
9. 未完成项：见 `ROADMAP_20260804_TO_RELEASE.md`，按 Gate 与依赖排序执行。

## 6. 本轮最终门禁状态

- `task:preflight`：PASS。
- `wuxia:check:fast`：PASS；旧固定时间轴断言已被真实玩家回合断言替代。
- `wuxia:qa:ui-sweep`：PASS，最终链路 33/33、modal 3/3、blocker 0、console error/warning 0。
- 人工逐图复验：FAIL；开场、角色、地图、NPC、章节循环和战斗仍是灰黑原型视觉，战斗角色为 CSS 几何占位，不能达到用户确认的侧视三头身像素武侠标准。
- `wuxia:audit:online-standard`：按设计返回非零；2026-08-09 最新实跑为 11 个 P0、3 个 P1。此失败全部来自资产、资产合同和人工视觉，是正确上线阻断，不应被消除或包装成 PASS。
- `AUDIT-003`：审计执行和修复已完成；COMBAT-005 已关闭未授权战斗结果，但最严格人工 Gate、生产资产、真机与 Release 证据仍未关闭，因此机器状态保持 `blocked`。

## 7. 2026-08-09 COMBAT-005 审计补充

- 原 1 个 P1“3 条未授权 Combat Result”已关闭：`compare`、`inattack201`、`inattack202` 现在由 Result policy 唯一映射真实 Encounter 和 `CombatSession`。
- 旧 Result-token/interaction 审计已同步到配置权威：316/316 Result rows 为 P3，3 条动作状态为 `configured_combat_result_policy`；最新 online-standard 不再产生 `runtime_result_token` issue。
- 最新 online-standard 仍正确失败：11 个 P0、3 个 P1 全在资产、资产合同和人工视觉域，不能因战斗路由完成而消除。
- 终局事务覆盖胜利、失败、逃跑、缺 policy、错误来源、缺后续 Result 与存档恢复；失败不写胜利状态，后续执行失败保留 pending combat。
- 新增配置文本插值合同，人工浏览器复核确认没有 `$IN`、`$S`、`$N` 泄漏。
- 全量战斗模拟 6×200 局通过；梦魇最终胜率 0.845，处于配置阈值 0.75～1.0。
- 三 Result × 三尺寸真实 Edge 功能验收通过，但生产美术 Gate C 仍失败：CSS 角色、开发场景、缺生产 VFX/OGG，不能据此解除 `COMBAT-002B`、`T05-01` 或项目 `RELEASE_BLOCKED`。
- 已知首局模拟 mismatch 在 focused 报告中明确标记 `scope=separate`，不参与本项通过。

## 8. 2026-08-09 最新变更严格复审与 SAVE-001 补充

- 固定点 `e04dfd3ca8bcb6ca7c3532803df07cd099d5a9d9` 到被审计提交 `cc0ab085e3aa9a96c3884290fea0e5350ce968b7` 的 34 个文件已重新完整阅读；审计过程和修复见 `LATEST_CHANGESET_STRICT_AUDIT_20260809.md`。
- 战斗终局现要求 condition branch 与 result-token dispatch 二选一；配置 condition 时必须且只能命中一个真实分支。零分支、多分支、双分发、缺 combat content 和启动失败均原子拒绝并保留/清理正确状态。
- `runtime:combat-result-routing:test` 扩展为 4 条正例、8 条负例；已知 `FIRST_SESSION_SIMULATION_MISMATCH` 继续以 `scope=separate` 保留，不参与本 focused verdict。
- 开发服务器已从弃用 `url.parse` 和字符串根前缀判定迁移到 WHATWG URL + `path.relative` 边界策略；编码穿越、同前缀兄弟目录和畸形编码全部 fail closed。
- 全预检首次运行发现 358 动作审计仍以空 combat fixture 验证真实战斗动作，产生 66 条 availability/dispatch mismatch；夹具已改为注入同一 `wuxia_combat_content.json`，修复后 358/358 PASS。该级联失败未被排除或包装成旧问题。
- 全预检第二次运行发现通用 `compete` 的结果条件并非每个 NPC 必填；将 Result 路由的严格一分支规则无差别套用会让普通切磋终局卡死。现由配置声明 `optional_zero_or_one_satisfied`（通用切磋）或 `required_exactly_one`（来源专属 Result），Runtime 对多匹配继续 fail closed，Chapter/Combat 集成恢复通过。
- SAVE-001 已关闭：v2 SaveEnvelope、v1→v2 连续迁移、staging/backup/rollback 四键事务、稳定校验和、损坏恢复、未来版本拒绝、写入中断与浏览器可见恢复均通过。Android 真机故障注入仍是发行门，不回写为 SAVE-001 未完成。
- OBS-001 已关闭浏览器 Runtime 范围：7 类事件、36 条状态投影、build/config/save tags、稳定 error code、Combat replay ID、去敏 error、render performance 和 replay divergence 诊断均通过；upload 仍关闭，正式 build ID、真机性能、远端 dashboard/alert 归发行门。
- 最新人工战斗复验仍得出双结论：三尺寸功能/交互 `PASS`，生产像素角色、场景、VFX/Buff/OGG `FAIL / BLOCKED`。项目总判定保持 `RELEASE_BLOCKED`。
