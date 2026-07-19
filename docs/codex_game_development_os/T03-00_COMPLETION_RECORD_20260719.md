# T03-00 完工记录：FB01 实体与动作可达性

## 1. 当前现状

T03-00 已完成。可重复门禁当前给出：

- 139 个实体；
- 129 个可达实体；
- 10 个受控休眠实体；
- 334 个可达动作；
- 24 个受控休眠动作；
- 0 个未裁决不可达实体或动作。

旧报告的 13 个实体、27 个动作不是当前权威数字。旧脚本没有完整解释由配置声明的嵌套结果链，漏掉了 `bf2r06_1a`、`bf2r06_1b` 与 `tmnpc01e` 的真实入口。

## 2. 存在问题

1. 历史脚本位于临时目录，不能进入 CI。
2. 历史脚本只处理直接分支结果，不能遍历选项、结果集和技能转换结果。
3. 动态活动 NPC 与普通地图 NPC 混在同一角色定义表内，单凭房间种子会被误判为死数据。
4. 旧商人 `fb01r01_3` 只有角色与商品定义，没有房间、结果或外部注入证据。
5. 旧报告没有强制要求每个不可达对象具备处置决策、模块所有者与激活合同。

## 3. 修改方案

采用“运行时可达图 + 受控休眠模块”双层模型：

```text
room seeds
  -> entity branches
  -> configured nested result-list arguments
  -> 换人 / 添加人物
  -> fixed-point reachable set

remaining unreachable
  -> repair
  -> intentional_dormant + module contract
  -> remove-from-active-config
```

嵌套结果参数从 `chapterSystem.resultEffectPolicies` 读取，不在工具中硬编码具体 NPC、选项或技能结果 ID。

## 4. 修改范围

- `config/wuxia_fb01_entity_reachability_policy.json`
- `tools/audit-wuxia-fb01-entity-reachability.mjs`
- `tools/test-wuxia-fb01-entity-reachability.mjs`
- `config/project_scope.json`
- `config/production/production_stage_plan.json`
- `package.json`
- 当前阶段与 Production OS 相关 Markdown

未修改战斗逻辑、COMBAT-002、CombatSession 或任何参考项目文件。

## 5. 配置变化

新增 6 个休眠模块合同：

| 模块 | 实体 | 首局状态 |
|---|---|---|
| `legacy_vendor_quarantine` | `fb01r01_3` | 禁止启用，等待入口证据 |
| `spring_festival_cooking` | `fb01r18_1`、`fb01r18_2` | 关闭 |
| `timed_visit_task` | `fb01r36_1a`、`fb01r36_1b` | 关闭 |
| `shenshu_task` | `shenshunpc` | 关闭，动态实例专用 |
| `treasure_hunt` | `xunbaoren1/2/3` | 关闭，动态事件专用 |
| `mid_autumn_cooking` | `zhongqiuchuzi` | 关闭 |

每个模块均声明所有者、激活策略和来源证据。任何模块在普通首局启用都会触发门禁失败。

## 6. 代码变化

新审计工具：

- 从房间 `encounterIds` / `interactableIds` 建立种子；
- 从 `resultEffectPolicies` 发现结果列表参数；
- 递归展开选项、结果集与技能转换成功/失败结果；
- 传播 `换人` 与 `添加人物`，直到固定点；
- 检测未裁决、过期裁决、无效修复、未真正删除、未知模块、错误启用及不完整激活合同；
- 生成 JSON、CSV 与 Markdown 三种证据。

## 7. 测试方式

```powershell
npm run runtime:entity-reachability:test
npm run wuxia:audit:entity-reachability
npm run wuxia:check:fast
npm run check
node tools/run-wuxia-real-browser-flow.mjs --scenario baseline --out-dir outputs/t03_00_entity_reachability/browser
```

本轮结果：

- 可达性正向/负向测试：4/4；
- 可达性审计：PASS，0 findings；
- `production:test`、`production:validate`、`scope:validate`：PASS；
- `wuxia:check:fast` 与 `npm run check`：PASS；
- Android identity：`com.idlewuxia.app` / `com.idlewuxia.app.debug`，PASS；
- Edge 540×960 首局流程：12 步、0 failure、页面 console 0 error/0 warning，结束于 `STATE_FS_008_MAP_EXPLORE`。

负向测试覆盖：

1. 删除一个休眠裁决必须失败；
2. 启用寻宝休眠模块必须失败；
3. 删除技能转换结果遍历合同后，`tmnpc01e` 必须重新成为未裁决对象并失败。

## 8. 风险

- `fb01r01_3` 的真实上游入口仍未知，因此只能隔离，不能声称内容已恢复。
- 休眠定义仍保存在 FB01 数据中，但没有房间或启用模块时不会进入玩家可见集合。
- 本任务证明配置可达性与隐藏边界，不等于 358/358 动作状态断言完成。
- 本任务不提供 11 屏 × 3 尺寸视觉、真机或 Release 证据。
- Edge 进程输出包含浏览器自身 task-manager/QQBrowser importer 警告；页面控制台为 0 error/0 warning，不能把浏览器进程噪声隐瞒为不存在。

## 9. 未完成项

下一项为 `ARCH-001`：拆分 Condition、Result、Navigation、Entity、Persistence 与 UI Adapter 的可测试合同。其后执行 `T03-01`。

COMBAT-002 与 CombatSession 继续延期，直到用户解除限制。
