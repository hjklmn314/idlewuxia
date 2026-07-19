# 参考项目采用与资产来源

参考项目：`H:\MyProjectBack\CasualGame\idledotshoot\prototype-novalite`

## 审计范围

本轮完整解析或读取了与本项目直接相关的：

- `visual_style_manifest.json`：828,314 bytes、21,620 行；全量 JSON 解析，遍历 18,804 个键和全部值。
- Visual Style Schema、Contract、Asset Replication、Slice、Reference Acceptance 配置。
- UI Shell、UI Progression、Original UI Unlock、Paused Build 配置。
- Visual manifest compiler/validator、asset budget、web build 工具全文。
- Browser Surface、Browser Modal、Release Surface 大型工具全文加载并审计其入口、声明、viewport、console、screenshot、DOM/state、失败和退出码链路。
- `public/` 资产目录按文件路径、大小和 hash 盘点；字体与许可证文件单独核对。

## Adopt / Adapt / Reject

| 能力 | 决策 | Idlewuxia 落点 |
|---|---|---|
| 配置 → 生成 Registry → drift check | Adopt | 后续 AssetRegistry、UI Definitions 生成链 |
| required asset slots | Adopt | `asset_registry.requiredSlots` |
| package/asset budget | Adopt | T05-02、ASSET-002..006 |
| 3 类移动纵横比 | Adopt | 360×800、390×844、412×915 |
| Browser surface observation | Adapt | `QA-UI-001`，改为 11 个武侠屏 |
| Modal open/close acceptance | Adapt | 用于选择、奖励、NPC 等武侠 overlay |
| failure screenshot + DOM + state | Adopt | QA 失败证据包 |
| release gate aggregation | Adapt | G7 release matrix |
| 射击 bottom tabs/rails | Reject | 不符合武侠首局目标 |
| 射击 progression/economy/IAP copy | Reject | 不是本项目内容 |
| fixed shooting canvas semantics | Reject | 不进入武侠 UI |
| original-game APK pixels/binaries | Reject for shipping | 仅研究 |
| reference smoke simulator as balance proof | Reject | 不替代真实模型和仿真 |

## 资产处理

### 已批准运输

| Asset ID | 文件 | 来源 | 状态 |
|---|---|---|---|
| `brand-icon-primary` | `public/wuxia-brand/icon.svg` | project-owned | ship |

文件大小 616 bytes，SHA-256 为 `8f565a0bbcef1c2d58e69df534534374c595555d6da95247ef1275950fb99146`。

### 候选但未复制

| 参考资产 | 当前判断 | 前置条件 |
|---|---|---|
| Patrick Hand | OFL 文件存在；拉丁手写风 | 中文产品不适合作主字体 |
| ZCOOL XiaoWei | OFL 文件存在；中文展示候选 | 许可证通知、字符覆盖、子集、包体、三尺寸可读性 |
| NovaInkLishu | 未找到可确认的再分发许可 | 保持 reference-only |
| style-atlases | 混合生成/参考来源 | 逐文件 provenance 与商用权 |
| generated-ui | 生成链可借鉴，像素来源需确认 | 生成输入、模型条款、人工验收 |
| original-game | 竞品 APK 来源 | 永不运输 |

## 资产完整链路

```text
Asset Requirement
  -> Source / License Evidence
  -> Logical Asset ID
  -> Import / Generate Recipe
  -> Format + Size + Dimension Validation
  -> Registry Approval
  -> Runtime Resolver
  -> Web Bundle Manifest
  -> APK/AAB Byte Audit
  -> UI Visual Acceptance
```

缺少任一节点时，资产状态只能是 `open`、`evaluate-not-copied`、`workflow-only` 或 `reference-only`，不能是 `ship`。

## 需要生产的自有资产

- Android adaptive icon、round icon 和 launch screen；
- 中文武侠 display/body 字体与 fallback；
- 章节地图材质；
- available/locked/selected/completed 节点状态；
- NPC 肖像定义与 fallback；
- 交互、奖励、锁定、失败、继续图标族。

具体任务为 ASSET-002..006。T05-02 负责把逻辑 ID 接入 Runtime 和 Build Gate。

## 版权与产品边界

- 功能链、交互节奏、尺寸和工具方法可以用于工程分析。
- 竞品文案、数值、图像、字体、声音、二进制和混淆代码不得因为“参考”自动获得运输资格。
- 任何物理资源进入 `public/` 前，必须先新增 Registry 条目、来源证据、许可状态、hash、预算和消费者。
- 未批准的参考资产不得进入 Web Bundle、Android assets、APK/AAB、远程 Bundle 或商店素材。
