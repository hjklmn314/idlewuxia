# HYGIENE-001 完工记录与回滚说明 — 2026-08-09

## 1. 当前现状

`HYGIENE-001` 已通过“清单分层、零物理移动”完成。活动武侠 shipping authority、休眠 Idle Dot Shooter/Nova Lite 材料、参考证据和共享治理文件现在由同一版本化合同逐文件分类。项目整体仍为 `RELEASE_BLOCKED_ACTIVE_REMEDIATION`；本任务只关闭 G4 的权威边界，不关闭 G5 生产视觉或 G7 发行门。

## 2. 发现的问题

- `AUDIT-003` 原来依赖仍被生产视觉阻断的 `COMBAT-002`，同时 `HYGIENE-001` 又依赖 `AUDIT-003`，导致 G5 的视觉/Android 门反向阻塞 G4 文件治理。
- `project_scope.json` 已能隔离 shipping 文件，但没有对所有 tracked files 给出活动、休眠、参考和治理四类互斥说明。
- 任务说明仍写成旧的 26-file closure；OBS-001 后当前权威 closure 已是 29 个文件。
- 直接移动历史源代码/配置会造成大量工具和证据路径级联，不符合当前收益与风险比例。

## 3. 依赖裁决

- `AUDIT-003` 改为只依赖 `AUDIT-001`，但状态保持 `blocked`：完整发布重审计可以审计未完成系统，却不能在生产视觉和 Android 人工门未通过时标记完成。
- `HYGIENE-001` 改为依赖 `AUDIT-001` 与 `OBS-001`。两项均已完成，因此文件治理可以独立施工并关闭 G4。
- 该裁决没有降低 `AUDIT-003` 的三道验收标准，也没有把浏览器功能 PASS 当成 Android/生产视觉 PASS。

## 4. 分层合同

权威合同：`config/production/workspace_hygiene_manifest.json`。

四个互斥分类：

1. `active_authority`：完全由 `config/project_scope.json#shippingFiles` 决定，当前 29 个文件。
2. `dormant_legacy`：50 个旧射击代码、配置和专用诊断工具；保留在 Git 供历史复核，但不得被活动 Runtime 引用或进入 shipping。
3. `reference_only`：15 个竞品/原项目证据、开发 overlay 和专用工具；只供开发验证，字节不得进入 shipping。
4. `shared_governance`：其余 Android、构建、Schema、测试、文档和项目治理文件。

分类使用 exact file list 和 shipping authority，不按文件名猜测运行时身份。新增 tracked file 默认归 shared governance；若属于 legacy/reference，必须在同一提交更新清单。

## 5. 工具与门禁

- `tools/lib/workspace-hygiene.mjs`：路径规范化、分类、活动模块可达图、SHA-256 与 closure 比较。
- `tools/audit-workspace-hygiene.mjs`：Schema 实际校验、`git ls-files` 全量分类、active→legacy import 检查、HTML 入口检查、逐文件 hash 报告。
- `tools/test-workspace-hygiene.mjs`：互斥分类和 shipping closure 正负例。
- `npm run workspace:hygiene:test` 与 `npm run workspace:hygiene:audit` 已接入 `task:preflight` 和 `wuxia:check:fast`。

最终报告写入 `outputs/workspace_hygiene/hygiene_report.json`。

## 6. 验证结果

- tracked files：407（包含本完工记录）。
- active authority：29。
- dormant legacy：50。
- reference only：15。
- shared governance：313。
- 活动模块可达文件：20。
- active→legacy import：0。
- 分类重叠：0。
- 缺失清单文件：0。
- shipping closure：29。
- 施工前后 shipping SHA-256/bytes 变化：0。
- Schema、生产配置验证和 scope 验证：PASS。
- 接入 Hygiene Gate 后完整 `npm run task:preflight` 最终退出码 0，358 动作、存档、观测、战斗、UI sweep、29-file scope、Android identity、证据和首局运行时均未发生级联回归。

本任务没有修改任何 shipping byte，因此没有新 UI/动画/音频表现可做视觉验收；此前 19 张当前构建手工视觉结论保持有效，生产视觉仍为 FAIL/BLOCKED。

## 7. 安全与回滚

- 没有移动、删除、复制或重命名旧源代码、配置或参考证据。
- 没有触碰 `fangzhijianghu/`、`outputs/` 历史证据、`.git`、Codex session、SQLite 或 G 盘资料。
- 临时 before snapshot 位于 `.codex-os/temp/hygiene001/`，只用于同批次 closure 对比，不提交。
- 回滚方式是 revert 本任务提交；由于没有物理迁移，不需要文件恢复操作。
- 未来若要物理移动，必须另建 batch：记录源/目标绝对路径、bytes、SHA-256、回滚路径，并使用回收站而非永久删除。

## 8. 风险与未完成项

- 旧射击文件仍物理存在于 `src/`、`config/` 和 `tools/`；当前通过入口、shipping allowlist、模块图和 CI Gate 隔离，而不是靠目录隐藏。
- 未来新增 dynamic import 时，需要扩展模块图解析器；当前活动 Runtime 使用静态 ESM import。
- `AUDIT-003` 继续 blocked，直到严格生产视觉和 Android 手工验收满足其 acceptance。
- 下一非资产任务为 `SEC-001`，之后是 `REL-001`～`REL-003`。

## 9. 判定

`HYGIENE-001`：**PASS**。G4：**PASS**。项目整体：**RELEASE_BLOCKED_ACTIVE_REMEDIATION**。
