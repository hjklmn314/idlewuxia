# Idlewuxia 当前项目完整重审计

审计日期：2026-07-19

审计对象：`H:\MyProjectBack\idlewuxia`

外部证据工作区：`G:\codex`

## 审计方法与证据边界

本轮不把旧报告当作当前事实，采用四层证据：

1. Git 与范围：拉取 `origin/main`，确认起点 `542844fcea7f2c1208d35f0f782efd66d87e14da`，运行项目基线。
2. 逐文件完整读取：201 个起点已跟踪文件全部读到 EOF、计算 SHA-256；已知文本全部完整解码，43 个 JSON 全量解析。
3. 运行门禁：重跑 `task:preflight`、`baseline:build`、`wuxia:check:fast`、预开发分析和 Skill 瀑布。
4. 外部材料：ZIP 225 条目逐字节读取与结构验证；合并报告、T00 文本、旧施工包和当前阶段报告全文读取；参考项目的大型 JSON 全量解析并遍历所有值，相关工具全文加载、语法与能力结构审计。

不纳入当前产品事实：

- `AGENTS.md` 中已被 HTML 项目覆盖的历史 UE5 施工段；
- dormant Nova/射击配置通过旧 `validate` 得到的数量；
- 旧 `outputs/` 的 pass 作为当前浏览器或发行证据；
- 参考项目素材的视觉相似度作为授权证明；
- debug APK 作为商业 Release。

## 已确认事实

### 项目和运输闭包

- 活跃产品是原生 ES Module + DOM/CSS 的 HTML 运行时，由 Capacitor 6.2.1 打包 Android。
- `config/project_scope.json` 声明 12 个运输文件。
- 活跃配置只有持久化、首局流程、首局屏幕合同三项；开发证据在 Web 构建清洗。
- Android 正式包名 `com.idlewuxia.app`，debug 包名 `com.idlewuxia.app.debug`。
- 起点基线为 201 个 Git 跟踪文件，baseline digest 为 `e5122b5706ae9499b063e2a5d1c2bc8df4e6b1bf66feff731832841c417b4407`。

### Runtime 与配置

- 首局配置：11 个状态、32 个流程动作、7 个章节节点、45 个房间、116 个 NPC、23 个物件、66 个敌人、12 个门槛、7 个奖励。
- FB01 交互：358 个动作；当前 high-risk 为 0。
- 421 个结果定义中，当前使用发生 316 次：313 次已归类为 P3，3 个战斗结果仍是延期 P1。
- 186 个条件定义；已使用条件没有 unsupported 高风险。
- 条件拒绝路径具备 fail-closed、零 mutation、UI 可见拒绝原因的回归证据。
- 结果执行器对选择、物品、属性、政绩、地图、标记、配方和文本反馈已有通用解释。
- 兼容层仍读取 258 个无歧义旧单来源对象；复合 legacy 字符串为 0。

### 当前结构问题

| 区域 | 当前事实 | 风险 |
|---|---|---|
| `src/wuxiaFirstSessionFlow.js` | 约 1938 行 | 状态、规则、实体、结果、存档和战斗占位耦合，后续章节扩展成本高 |
| `src/wuxia-main.js` | 约 1229 行 | DOM、路由、自动化、持久化、战斗回放和反馈耦合 |
| `src/styles.css` | 约 3852 行，武侠层约从 2215 行后开始 | dormant 射击样式仍进入运输闭包，预算和选择器碰撞风险 |
| 不可达内容 | 13 个实体、27 个动作 | 配置可能存在死内容或路由缺口 |
| 隐藏非战斗动作 | 135 个 | 能力未实现，不能称为完整玩法 |
| 视觉验收 | 不是 11×3 完整矩阵 | 无法证明移动端 UI 达上线标准 |
| 资产 | 仅品牌 SVG 明确登记为可运输 | 缺字体、地图、肖像、交互图标和 Android 完整品牌集 |

### 实时门禁

本轮重跑结果：

| 门禁 | 结果 | 限定 |
|---|---|---|
| `npm run task:preflight` | PASS | 证明当前静态/单元/运行时/范围合同，不证明视觉和 Release |
| `npm run baseline:build` | PASS | 真实 Git 环境下 201 files |
| `npm run wuxia:check:fast` | PASS | 0 P2、content boundary high=0 |
| `npm run wuxia:predev:analysis` | PASS | 生成物是分析证据 |
| `npm run wuxia:tasks:skill-waterfall` | PASS command / product gates still fail | 5 个 gate pass、3 个 fail，strictOnlineReady=false |
| `npm run production:validate` | PASS | 6 个生产配置、8 gates、31 tasks、0 findings |

`wuxia:check:fast` 仍运行 dormant Nova `validate`，输出的 skins/enemies/waves 数量不是当前武侠运输配置；真正的 active-entry 和 project-scope Gate 隔离了运输闭包。后续应把 legacy validation 从快速门禁中拆为明确的 `legacy-reference` 检查。

## 推断

- 当前最接近“可上线”缺口的不是继续堆内容，而是先清理不可达配置、建立全动作断言和拆分可测试模块。
- 参考项目最有价值的是资产槽/预算、浏览器 surface/modal 扫描、失败证据包和发行聚合方法，而不是射击玩法或像素资源。
- 在第二章节 Feature Package 能完全复用通用解释器前，当前“配置驱动”只能判定为纵切成立，不能判定为规模化生产成立。
- 资产 Registry 只完成了治理种子；在 Runtime 使用逻辑 ID 且 Build 拒绝未批准资产前，T05-02 仍未完成。

## 未知与待验证

- 13 个实体和 27 个动作究竟是设计上 dormant、数据错误还是路由遗漏，必须逐项审计后裁决。
- 135 个隐藏非战斗动作中哪些属于当前版本范围，哪些应降级为未来内容，尚未有产品裁决。
- 参考项目的生成 UI 图逐文件生成来源、模型条款和商用权不完整。
- ZCOOL XiaoWei 是否适合作为产品字体，需同时验证许可证、字符覆盖、子集、包体和 3 尺寸可读性。
- 真实低端 Android 性能、WebView 兼容、后台恢复、安装升级和商店策略未完成。

## 当前正式判定

`PASS WITH KNOWN LIMITATIONS / NOT RELEASE READY`

下一个执行任务是 `T03-00`。`COMBAT-002` 与 `CombatSession` 保持延期。
