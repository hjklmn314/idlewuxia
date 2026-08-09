# SAVE-001 完工记录与恢复/回滚手册 — 2026-08-09

## 1. 当前现状

旧实现只有单个 LocalStorage JSON、版本等值判断和无效存档忽略；没有校验和、迁移链、staging、backup、rollback 或中断写入验证。当前已升级为 `idlewuxia.runtime_save_envelope.v2`，读取 v1 并迁移到 v2，保留旧版原始 envelope 供部署回滚。

## 2. 已关闭问题

- JSON 可解析但内容被改写时无法发现。
- 主键写入失败或中断时没有独立 staging/backup。
- schemaVersion 不等于当前版本时一律丢弃，旧玩家存档无法升级。
- 损坏 primary 无法从完整副本恢复。
- 回滚旧构建前没有旧版本 envelope。
- 未来版本存档可能被错误降级读取并产生数据回退。

## 3. 数据与事务方案

写入顺序固定为：

```text
Runtime Save DTO
  -> 构造 v2 Envelope + stable checksum
  -> 写 staging
  -> 读回并验证 staging
  -> 旧 primary 写 backup
  -> 新 envelope 写 primary
  -> 读回并验证 primary
  -> 清理 staging（失败只留下可恢复副本）
```

恢复优先级：

```text
有效 current primary
  -> 使用 primary，忽略未提交 staging

损坏/畸形 primary
  -> 有效 staging
  -> 有效 backup
  -> 均无效则 ignored_invalid

future/incompatible primary
  -> fail closed，不静默退回旧 backup
```

## 4. Schema 与版本

- Persistence Contract：`idlewuxia.runtime_persistence_contract.v2`。
- Save Envelope：`idlewuxia.runtime_save_envelope.v2`。
- Runtime State DTO：继续使用 `idlewuxia.first_session_runtime_save.v1`；本次只升级 envelope 治理，不改变玩家领域字段含义。
- 当前版本：2；最低可读：1。
- Migration：`SAVE_MIGRATION_001_V1_TO_V2_ENVELOPE_INTEGRITY`。
- Migration 只保留原 state，增加 transaction metadata 与 checksum；可重复 restore，已经升级的 v2 不再次迁移。

## 5. Storage Keys

- Primary：`idlewuxia.first_session.save.v1`（保留旧主键以接续既有玩家）。
- Staging：`idlewuxia.first_session.save.v1.staging`。
- Backup：`idlewuxia.first_session.save.v1.backup`。
- Rollback：`idlewuxia.first_session.save.v1.rollback.v1`。

四键必须唯一。Clear Save 会同时清理四键；常规保存不会覆盖首次保留的旧版 rollback envelope。

## 6. 恢复操作

1. 先读取 `persistenceStatus()`，区分 `restored`、`restored_migrated`、`restored_recovered`、`ignored_invalid`、`ignored_incompatible` 和 `unavailable`。
2. `restored_recovered` 必须记录 `recoverySource=staging|backup`，但玩家可继续使用恢复的 state。
3. `ignored_invalid` 表示 primary、staging、backup 均不可用；不得授予补偿或猜测玩家进度，需保留现场并进入客服/事故流程。
4. `ignored_incompatible` 尤其包含未来版本存档；不得自动加载旧 backup，以免静默回退玩家进度。
5. Storage API 不可用时游戏命令仍可执行，但 status 为 `unavailable`，不能声称已经保存。

## 7. 版本回滚操作

1. 回滚旧包前，确认 `rollbackStorageKey` 存在且内容仍为 schemaVersion 1。
2. 调用 `createRuntimePersistence(...).prepareRollback(expectedRuntimeSchema)`；成功状态必须为 `rollback_prepared`。
3. 该操作先把当前 v2 primary 保存到 backup，再把 v1 rollback 原文复制回旧 primary key。
4. 验证 primary 的 schemaVersion=1、runtimeSchema 与目标旧包一致，然后才允许安装/推广旧包。
5. 回滚后禁止由新包再次启动并自动迁移；若需恢复新包，先用 backup 恢复 v2 primary。
6. 商业发布前必须在真机上做一次“升级 v1→v2→损坏恢复→准备回滚→旧包读取→恢复新包”的完整演练；当前浏览器证据不能替代该门。

## 8. 验收证据与风险

- 静态合同：`config/runtime_persistence_contract.json` 通过 Draft 2020-12 Schema 与连续 migration 检查。
- Unit：v2 checksum、事件裁剪、primary/backup/staging、畸形 JSON、checksum mismatch、future version、v1 migration idempotency、rollback、写入中断、无 storage、clear 全部通过。
- Browser：`outputs/save001_browser_acceptance_20260809_postreview/save001_browser_acceptance.json`；390×844 Edge，v1→v2 与 corrupt primary→backup 均 PASS，console=0。
- Fixture：`tests/fixtures/runtime_persistence/v1_representative_save.json`、`v3_future_save.json`。
- 风险：校验和不是安全签名；真机断电/容量/系统清理、云冲突和多端合并仍不在本地原型范围。

## 9. 结论与未完成项

- SAVE-001 合同、Runtime、migration、backup/recovery、rollback 文档和浏览器可见验收：**PASS**。
- Android 真机故障注入和 Release 回滚演练：归入 `REL-002/REL-003`，仍为 **BLOCKED**。
- 下一项：`OBS-001`，把 build/config/save version、错误码、恢复来源和 combat replay ID 接入可诊断事件链。
