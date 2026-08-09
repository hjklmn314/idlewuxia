# 最新变更集严格审计报告 — 2026-08-09

## 1. 当前现状

- 审计固定点：`e04dfd3ca8bcb6ca7c3532803df07cd099d5a9d9`。
- 被审计提交：`cc0ab085e3aa9a96c3884290fea0e5350ce968b7`，共 34 个代码、配置、工具和 Markdown 文件，原始差异为 `+1626/-107`。
- 审计方法：完整读取项目规则、战斗生产规范、Roadmap、生产阶段计划和全部变更；随后分别执行 Standards 轴与 Spec 轴复核、focused 回归、全链门禁以及全新浏览器人工视觉复核。
- 本报告不是对旧截图或旧 PASS 的转述。配置基数修复后的最终当前视觉证据重新生成于 `outputs/combat_result_visual/audit_20260809_final_current/`。
- 项目正式状态仍为 `RELEASE_BLOCKED_ACTIVE_REMEDIATION`。本次只确认章节战斗结果路由、竖屏功能可用性和 SAVE-001；不确认生产美术、Android 真机或发行。

## 2. 审计发现的问题

1. **P0：战斗终局可静默空结算。** policy 只要配置了 `successConditionToken`，即使 NPC 中不存在对应终局分支，Runtime 也会清空 pending combat 并返回成功。
2. **P0：同一终局可同时配置 condition branch 与 result tokens。** 旧实现会静默优先 condition branch，另一组配置被忽略，形成不可见歧义。
3. **P1：缺少 combat content 时仍可建立空 pending combat。** 这会让 `accepted=true` 与真实 CombatSession 不一致。
4. **P1：战斗启动状态跳转失败后 active CombatSession 未清空。** 会留下不可见的会话对象。
5. **P1：启动失败事件仍携带 `pending_combat` side effect 和启动文案。** 与真实拒绝语义不一致。
6. **P1：开发服务器使用弃用的 `url.parse`，且基于字符串前缀的根目录判定允许“同前缀兄弟目录”绕过。** 人工运行时出现 Node 弃用/安全警告。
7. **P1：战斗真值收紧后，358 动作审计夹具仍未注入真实 combat content。** 全预检因此正确暴露 66 条 `AVAILABILITY_DISPATCH_MISMATCH`；这是审计工具与现行 Runtime 合同脱节，不是可以忽略的旧失败。
8. **P0：全局 `compete` policy 的胜负条件是可选 NPC 分支，不是每个 NPC 都必须拥有的必填分支。** 首轮严格规则把它误当成 `required_exactly_one`，全预检随即在真实 Chapter/Combat 集成终局拒绝；如果不修会让多数普通切磋完成后无法退出战斗。
9. **生产阻断：** 三尺寸战斗画面仍显示 CSS 几何角色、深色占位舞台、缺失正式 VFX/Buff/OGG；功能可用不等于视觉上线。

## 3. 修改方案

- 战斗终局改为严格互斥的两种配置路径：一个 condition branch，或一组 outcome result tokens；两者同时存在立即拒绝。
- 配置了 condition token 时，Runtime 必须找到且只能找到一个当前条件满足的终局分支，否则保留 pending combat 并 fail closed。
- 验证器在启动前静态检查 source/action、Encounter、模拟场景、动作 ID、终局 branch 唯一性和终局分发互斥性。
- 没有 combat content 时禁止接受战斗；启动/跳转失败清空 active session，拒绝事件不再伪报 pending side effect。
- 开发服务器使用 WHATWG URL 和 `path.relative` 根边界策略，并增加正常、编码穿越、同前缀兄弟目录、畸形编码负例。
- 358 动作审计夹具与浏览器/Runtime 一样注入 `wuxia_combat_content.json`，禁止测试继续依赖“没有战斗内容也能建立 pending combat”的旧伪语义。
- 终局条件基数由配置显式声明：三个 Result policy 使用 `required_exactly_one`；面向 66 个 NPC 的通用 `compete` 使用 `optional_zero_or_one_satisfied`。Runtime 仍拒绝同一时刻命中多个分支，但允许没有该 NPC 专属后续的合法切磋以空副作用完成。
- SAVE-001 使用 v2 SaveEnvelope、校验和、staging/backup/rollback 四键事务、v1→v2 有序迁移、损坏回退和未来版本 fail closed。

## 4. 修改范围

- 战斗：`src/chapterSession.js`、`config/wuxia_first_session_flow.json`、同步生成器、语义验证器和 focused routing tests。
- 开发服务器：`tools/dev-server.mjs`、路径策略模块和 focused tests。
- 回归审计：`tools/audit-wuxia-fb01-action-state-assertions.mjs` 的 CombatSession 夹具接线。
- 存档：`src/runtimePersistence.js`、两个 Schema、持久化合同、版本 fixture、验证/单元/浏览器验收工具。
- 治理：生产阶段计划、Subsystem Registry、Roadmap、审计报告和回滚说明。
- 未修改：G 盘历史资料、参考项目源文件、Rest/Repair、Android 签名/商店设置、生产资产二进制。

## 5. 配置变化

- `compare` Result policy 删除没有实际终局分支的 `comparelose/comparerunaway` token；失败和逃跑现在按“无胜利副作用”显式空结果处理。
- 通用 `compete` policy 新增 `outcomeConditionCardinality=optional_zero_or_one_satisfied`；三个 Result policy 与 Schema 固定为 `required_exactly_one`，避免把两种不同内容语义重新混在代码判断里。
- `runtime_persistence_contract` 升级到 v2：当前版本 2、最低可读版本 1、四个唯一 storage key、FNV-1a 32 完整性校验、连续迁移链及回滚保留策略。
- `production_stage_plan` 将 SAVE-001 更新为 done，并登记 Schema、Runtime、fixtures、tests、浏览器证据和回滚文档。

## 6. 代码变化

- `resolvePendingCombat` 在歧义、零匹配、多匹配和未知 Result 上全部原子拒绝，并保留 pending combat 供修复/恢复。
- `beginPendingCombat` 没有内容定义时拒绝；跳转失败同步释放 active session。
- `runtimePersistence` 新增稳定序列化校验和、v1→v2 migration、staging 写入与校验、前一主存档 backup、首个旧版 rollback 保留、损坏 primary 的 staging/backup 恢复，以及显式 rollback preparation。
- 开发服务器路径解析与 HTTP 文件读取分离，拒绝根目录逃逸和畸形 URL。
- 358 动作审计改为显式读取并传入生产战斗内容；因此 action availability 与真实 dispatch 使用同一依赖，不再由空 combat fixture 产生假失败或假通过。

## 7. 测试与人工验收

- 战斗 Result focused：4 个正例、8 个负例；包括失败/逃跑不写胜利、缺 policy、错 source、缺 Result、缺终局 branch、双分发歧义、缺 combat content。
- 章节配置：11 states、32 actions、45 rooms，0 error / 0 warning。
- 358 动作审计：highRisk=0；316 Result rows 全部 P3，P0=0、P1=0。
- 全预检首次运行在动作断言门发现空 combat fixture 级联；修复后 `runtime:action-state-assertions:test` 为 358/358 PASS。该失败与修复均保留在审计结论中。
- 全预检第二次运行在 `runtime:combat-chapter-integration:test` 发现普通 `compete` 终局被过严基数拒绝；加入显式 cardinality 合同后，普通胜利与逃跑、三条 Result 路由和首局语义验证均通过。
- 视觉重新执行：3 Result × 3 尺寸 × 14 步，共 126 步；failure=0、console problem=0、bad match=0、横向溢出帧=0。
- 人工逐图检查 9 张战斗启动帧和 9 张终局帧：功能布局、技能滚动、角色信息、目标、终局文本与返回地图均可用；没有 `$IN/$S/$N` 泄漏。
- 人工视觉生产结论：`FAIL / BLOCKED`。CSS 几何人物和占位战斗舞台不满足三头身侧视像素武侠生产标准。
- SAVE-001：Schema/迁移/校验和/中断/backup/staging/rollback/future-version tests 通过；真实 Edge 390×844 中 v1→v2 和损坏 primary→backup 两条可见恢复路径通过，console=0，两张恢复前后画面人工一致。
- OBS-001 接入后重新完整执行 `npm run task:preflight`，全链路最终退出码为 0；其中 358/358 动作、存档、观测、战斗内容/属性/回放/模拟/表现合同、33 屏 UI sweep、29 文件 shipping scope、Android identity、证据合同与首局运行时均通过。

## 8. 风险

- FNV-1a 校验用于偶发损坏检测，不是反作弊或密码学签名；服务端权威和安全存档不在当前本地首局原型范围。
- LocalStorage 的单次 `setItem` 是原子写入基础，但设备断电、WebView 存储清理和容量耗尽仍需 Android 真机故障注入。
- v1 rollback envelope 已保留且具备 preparation API；正式分阶段发布仍需要 Release 流程调用和真实回滚演练。
- 战斗功能通过仍不能解除 COMBAT-002B、T05-01、REL-* 和生产资产阻断。

## 9. 未完成项与结论

- `OBS-001` 已在同一严格审计批次内继续完成：7 类事件、36 条状态投影、build/config/save tags、稳定错误码、Combat replay ID、去敏错误、render performance 和首分歧诊断 replay 已接入。真实 Edge 390×844 为 14 条事件、3 条 replay commands、0 console/data-quality 问题。
- 完整预检通过不替代上线门：`wuxia:audit:online-standard` 必须继续以生产资产、资产合同和人工视觉缺口返回非零，不能用功能回归结果覆盖视觉阻断。
- 最终复跑 `wuxia:audit:online-standard` 按预期退出 1：14 项阻断（P0=11、P1=3；asset=3、asset_contract=10、manual_visual=1），同时交互 highRisk=0、316 个 Result token 全为 P3。该非零结果是正确的 release fail-closed 证据。
- 下一治理项：先裁决 `AUDIT-003` 严格依赖，再推进 `HYGIENE-001`；生产资产和 Release 门不因 OBS 完成而转绿。
- 随后：`HYGIENE-001`、`SEC-001`、`REL-001`～`REL-003`。
- 资产阻断继续按需求表管理；开发期可用原项目绑定，但严禁进入 shipping。
- 本轮审计结论：**PASS WITH KNOWN LIMITATIONS**。最新战斗结果变更经修复后通过 Standards/Spec/Runtime/人工竖屏功能门；生产视觉与项目发行仍为 **BLOCKED**。
