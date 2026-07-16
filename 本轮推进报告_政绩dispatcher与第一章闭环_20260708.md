# 本轮推进报告：政绩 dispatcher 与第一章闭环

生成时间：2026-07-08

## 结论

本轮完成的是第一章配置/执行器/验收门禁闭环，不宣称美术表现已达到上线品质。

已确认 `改变政绩` 的真实竞品 dispatcher：

- 来源：`fangzhijianghu/竞品资料/放置江湖apk/完整包内容归档/06_effective_lua/effective_plain_best/src/app/models/map/MapHandle/Modules/CommonModule/CommonResults.lua:1890`
- 逻辑：读取 `result.arg2`；为空时默认 `zhengji = 20`
- 门槛：`role:getAttr("officialType") ~= 0`
- 回写字段：`officialAchievement`

因此本轮没有隐藏 `改变政绩` 分支，而是接入 `player.meritLedger`：

- `officialType = 0`：记录 ledger，但不改变 `officialAchievement`
- `officialType != 0`：按 dispatcher 默认值 `+20` 写入 `officialAchievement`，并记录 ledger 证据

## 已改文件

- `config/wuxia_first_session_flow.json`
  - 新增 `chapterSystem` 配置框架
  - 新增 `resultEffectPolicies.officialMerit`
  - 新增 `resultEffectPolicies.seasonalActivity`
  - 新增章节/关卡配置驱动策略说明
  - `playerSeed` 补 `officialType / officialAchievement / meritLedger`

- `src/wuxiaFirstSessionFlow.js`
  - 新增 result-effect policy 读取
  - 新增 `player.meritLedger`
  - 实现 `改变政绩` -> `officialAchievement` / `meritLedger`
  - 季节活动 `bainian*` 在普通第一章流程中按模块作用域隐藏
  - NPC/物件分支选择会过滤首章禁用模块

- `tools/audit-wuxia-fb01-result-token-runtime-coverage.mjs`
  - `改变政绩` 标为 `implemented_official_merit_ledger`
  - `bainian*` 标为 `scoped_out_seasonal_activity_module_disabled`

- `tools/audit-wuxia-vs-fzjh-flow-parity.mjs`
  - 数据驱动导航桥接从 P2 改为 P3 非阻塞记录
  - 隐藏项目桥接节点从 P2 改为 P3 非阻塞记录

- `tools/test-wuxia-first-session-interactions.mjs`
  - 新增政绩 ledger 回归
  - 新增 officialType=1 时默认 +20 回归
  - 新增季节活动首章隐藏回归

- `tools/audit-wuxia-merit-dispatcher-evidence.mjs`
  - 新增可复跑的政绩 dispatcher 证据审计

- `package.json`
  - 新增 `npm run wuxia:audit:merit-dispatcher`
  - 接入 `npm run wuxia:check:fast`

## 自动验收结果

已执行：

```powershell
npm.cmd run wuxia:check:fast
```

结果：通过。

关键计数：

- `fb01 result-token rows`: 316
- `P0/P1/P2`: 0
- `P3`: 316
- `implemented_official_merit_ledger`: 4
- `scoped_out_seasonal_activity_module_disabled`: 5
- `P2 closure`: resultToken=0, flowParity=0, total=0

## 真实浏览器验收

已执行：

```powershell
node tools\run-wuxia-real-browser-flow.mjs --scenario chapter1-deep --out-dir outputs\skill_waterfall_acceptance_20260708_merit_chapter1_closure
```

结果：

- scenario: `chapter1-deep`
- steps: 46
- failures: 0
- bad visible legacy/debug tokens: 0
- final state: `STATE_FS_008_MAP_EXPLORE`

输出：

- `outputs/skill_waterfall_acceptance_20260708_merit_chapter1_closure/real_browser_flow_summary.md`
- `outputs/skill_waterfall_acceptance_20260708_merit_chapter1_closure/01_opening_story.png`
- `outputs/skill_waterfall_acceptance_20260708_merit_chapter1_closure/46_servant_talk.png`

## 第一章当前闭环口径

闭环范围：

- 启动叙事
- 出身选择
- 标题进入
- 状态页
- 挂机任务入口
- 池边打鱼奖励
- 第一章入口
- fb01 房间链路
- NPC 选择/交谈/切磋/送礼/自定义动作
- 物件选择/使用
- result token 执行器
- 政绩、季节活动作用域、技能经验、时间标记、定时标记、故事、物品、属性、地图标记、实体增删换

未在本轮宣称完成：

- 产品级美术/UI 品质
- 全章节
- 全竞品系统
- 服务端真实账号/购买校验

## 后续扩展规则

后续章节不能把章节名、门派名、NPC、奖励、Buff、系统效果写死在 UI 或执行器里。

新增章节应走：

1. 新增章节配置：rooms / nodes / npcs / interactables / gates / rewards / resultLookup / conditionLookup
2. 如果出现新系统效果，先新增 `chapterSystem.resultEffectPolicies.<moduleId>`
3. 执行器只扩展“通用模块能力”，不写具体章节内容
4. 审计必须证明：配置来源、执行器绑定、真实浏览器点击、无 P0/P1/P2 阻塞
