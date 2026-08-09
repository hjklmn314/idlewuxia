# OBS-001 完工记录与诊断回放手册 — 2026-08-09

## 1. 当前现状

`OBS-001` 在浏览器运行时范围内完成，判定为 `PASS WITH KNOWN LIMITATIONS`。它不改变游戏规则和 UI 内容，只在唯一 UI Intent 边界之后建立可诊断事件链。项目整体仍为 `RELEASE_BLOCKED_ACTIVE_REMEDIATION`，原因是生产资产、完整视觉、真机、性能、签名和发布门槛仍未关闭。

权威链路：

```text
config/analytics_events.json
  -> runtimeObservability.js
  -> uiFlowAdapter.js single intent boundary
  -> typed event ledger + state projection hash + diagnostic replay
  -> browserAutomationAdapter.js diagnostics/export seam
```

## 2. 事件合同

当前合同定义 7 类稳定事件：

| Event | 语义 | 关键字段 |
|---|---|---|
| `runtime.session_started` | Runtime 获得初始权威快照 | persistence status、initial state/hash |
| `runtime.intent` | UI/玩家 Intent 进入单一命令边界 | sanitized intent、before hash、state、combat replay ID |
| `runtime.result` | 权威接受/拒绝结果 | accepted、execution status、error code、before/after hash |
| `runtime.rejection` | 拒绝及原子性证明 | stable error code、stateUnchanged |
| `runtime.state_delta` | 配置白名单状态变化 | changed path、before/after value/hash |
| `runtime.error` | 去敏后的 Runtime 错误分类 | configured error code、source、state、combat replay ID |
| `runtime.performance_sample` | 配置定义的技术性能样本 | metric、value/unit/budget、screen/state |

所有事件携带：build version/ID、config version/hash、save version、module、session/run、experiment/variant/seed、privacy class、sequence、timestamp。

## 3. 配置与隐私

- `config/analytics_events.json` 已从旧射击事件列表替换为武侠 Runtime v1 权威合同。
- 36 条显式 state paths 决定可进入 state delta/replay hash 的字段；Runtime 不会自动序列化完整玩家快照。
- Intent 仅允许合同列出的逻辑 ID 字段。
- `name`、`playerName`、email、phone、address、device/advertising ID、raw text、feedback 等字段禁止进入事件。
- 当前 retention 为内存 512 条，upload 明确为 `disabled`；没有把遥测发送到外部服务。
- `fnv1a32` 仅用于一致性/分歧定位，不是安全哈希或防篡改机制。

## 4. 诊断回放

`exportRuntimeReplay()` 输出：

- 已清洗 Intent 序列；
- 每步 expected accepted；
- 每步 before/after state projection hash；
- stable error code；
- CombatSession replay ID（存在时）。

`diagnoseObservedReplay()` 在全新 Runtime 上逐步比较 before hash、acceptance 和 after hash，并在第一处分歧返回：sequence、category、expected、actual。测试已证明同配置 3/3 命令完全匹配；把出生动作的经验增量篡改为 999 后，在第 2 条命令产生 `after_state_hash_mismatch`，因此“能诊断分歧”不是只验证 replay 文件存在。

## 5. 错误、性能与故障隔离

- Window error、unhandled rejection 和 init failure 只记录配置化错误码，不采集 message/stack。
- 当前首个性能指标为 `ui.render.duration_ms`，携带 16.7ms 开发预算；这是诊断字段，不是 Android 真机性能通过声明。
- UI Flow Adapter 对观测器失败采用 fail-open：遥测异常不能改变权威命令的 accepted/rejected 语义。独立回归已注入抛错观测器并证明合法命令仍执行。

## 6. 验证证据

自动验证：

- `npm run runtime:observability:validate`：7 类事件、36 tracked paths、3 error codes、1 performance metric，Schema PASS。
- `npm run runtime:observability:test`：12 个事件、3 条 replay 命令、同配置 match、配置漂移 divergence、0 missing field、0 privacy violation、0 sequence violation、16 条 retention cap PASS。
- `npm run runtime:ui-flow-adapter:test`：含 observability failure fail-open 正例。
- `npm run scope:validate`：29 个 shipping files，范围闭包 PASS。

真实浏览器：

- 证据：`outputs/obs001_browser_acceptance_20260809_final_current/obs001_browser_acceptance.json`。
- Edge 390×844；初始、拒绝、两条接受 Intent 共 3 条 replay 命令。
- 14 条事件：session 1、intent 3、result 3、rejection 1、delta 2、render performance 4。
- build/config/save/replay tags 完整，session/run ID 不同，console error/warning 0，data quality 0 finding。
- 当前截图 `01_observability_wired_title_screen.png` 已人工检查：没有配置失败、白屏、溢出或交互消失；同时仍明确判定为占位 UI，美术上线门不通过。
- OBS 接入后的完整 `npm run task:preflight` 最终退出码为 0；运行时、358 动作、存档、战斗、UI sweep、范围、Android identity、证据与首局链路均未发生级联回归。
- 随后 `npm run wuxia:audit:online-standard` 按设计退出 1：P0=11、P1=3，全部来自 asset、asset_contract 和 manual_visual；OBS 没有掩盖既有上线阻断。

## 7. 恢复与回滚

OBS 层不拥有游戏状态，也不写入 SaveEnvelope。若观测实现产生问题，可按以下顺序回滚：

1. 从 `createUiFlowAdapter` 移除可选 observability 注入；权威 ChapterSession/Persistence 不受影响。
2. 从浏览器自动化移除 diagnostics/export seam。
3. 从 shipping scope 移除 `runtimeObservability.js` 与 `analytics_events.json`。
4. 恢复先前提交；不得改写存档数据来“修复”观测问题。

事件合同升级必须增加 contract/event schema version，不得静默改变既有字段语义。

## 8. 已知限制

- 当前 buildId 是 `development-local`；正式 Release 必须由 `REL-001` 注入可追踪构建 ID/commit/artifact manifest。
- 当前 ledger 仅在内存中，不含远端 ingestion、dashboard、告警或崩溃平台；上线前由 `REL-003` 接入时仍须遵守 privacy/upload 开关。
- 浏览器 render 样本不能替代 Android 真机 CPU/GPU、内存、帧稳定和输入/音频延迟证据。
- Combat replay ID 已穿透事件，但完整 CombatSession 的长期存储/外部故障重建仍受发行隐私和容量策略约束。

## 9. 判定与下一项

- `OBS-001`：`PASS WITH KNOWN LIMITATIONS`，机器任务状态更新为 `done`。
- G4 仍由 `HYGIENE-001` 阻断，不因 OBS 完成自动开放发行。
- 下一非资产施工项：`HYGIENE-001`；之后为 `SEC-001` 和 `REL-001`～`REL-003`。
- `REST-REPAIR-001` 继续保持 postponed，未被本任务擅自恢复。
