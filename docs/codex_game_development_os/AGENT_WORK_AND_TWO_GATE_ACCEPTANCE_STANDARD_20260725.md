# 智能体施工、两道审计门与主控验收规范

版本：1.0.0

适用项目：`H:\MyProjectBack\idlewuxia`

## 一、角色和责任

| 角色 | 责任 | 不得做的事 |
|---|---|---|
| 主控 / Orchestrator | 定义范围、分派任务、处理冲突、运行 Gate 2、最终手动验收、决定提交 | 不得把子智能体自报结果直接当完成 |
| 施工智能体 | 在批准范围内修改代码、配置、资源和测试，并提交完整交接 | 不得扩大范围、复制参考资产、修改未授权共享契约 |
| Gate 1 独立审计智能体 | 审计静态、Schema、运行时、构建、回归、scope 和回滚证据 | 不得验收自己实现的内容 |
| Gate 2 主控严格验收 | 复核完整功能链、关联系统、视觉/设备证据、无级联影响 | 不得用单元测试替代人工和平台验收 |

## 二、任务生命周期

```text
规划
 -> 基线与影响面审计
 -> 任务契约
 -> 智能体施工
 -> 标准交接
 -> Gate 1 工程证据门
 -> Gate 2 独立严格验收门
 -> 主控手动验收全部相关系统/配置/资源
 -> 更新阶段状态
 -> 仅提交项目代码、配置和 Markdown
```

任何一步失败都不能进入下一步。任务状态必须使用机器可读状态，不得只在聊天中宣布“完成”。

## 三、Gate 1：工程证据门

Gate 1 检查实现是否正确、可复现、可回滚：

1. 有任务 ID、玩家/系统目标、范围和非范围。
2. 有基线 revision、影响面、消费者清单和回滚点。
3. 权威配置、Schema、Runtime 消费者和资源来源明确。
4. 静态检查、Schema、单元、集成、负向和构建检查通过。
5. shipping scope、禁运内容、哈希、大小和依赖检查通过。
6. 相关系统回归通过，没有新 P0/P1。
7. 交接文件完整，明确失败项、风险和未完成项。

Gate 1 只输出：`PASS`、`REVISE`、`BLOCKED` 或 `ROLLBACK`。

## 四、Gate 2：独立严格验收门

Gate 2 必须在 Gate 1 通过后执行，由主控独立复核：

1. 重新读取任务涉及的代码、配置、资源和工具链，不信任智能体摘要。
2. 复核完整玩家链路：输入、状态变化、反馈、奖励、保存和恢复。
3. 复核所有关联系统，而不只检查修改文件。
4. 按目标 viewport、设备或明确的等效环境完成手动视觉验收。
5. 检查截图、DOM/state、控制台、日志、资源加载和溢出。
6. 复核前后 diff，确认没有级联反应或无关行为变化。
7. 实际演练回滚或证明上一版本可恢复。

Gate 2 只负责严格审计和证据复核，不等于最终人工签字。

以下任一项存在，Gate 2 必须失败：

- 仍有未解释的 P0/P1；
- 只有单一路径或单尺寸证据；
- 相关资源、配置、Runtime 或 Build 链路未验收；
- 出现新增控制台错误、资源 404、布局溢出或状态不一致；
- 智能体自己完成自验收；
- 把原型/Debug 证据写成商业发行结论。

## 五、主控最终人工验收

Gate 1 和 Gate 2 都通过后，主控必须单独执行最终人工验收：

- 逐张打开所有受影响截图，记录尺寸、裁切、可读性、状态和资源结论；
- 重新检查相关代码、配置、Runtime、资源、Web/APK 构建和未修改回归路线；
- 确认 console、404、overflow、资源漂移和状态不一致为零；
- 记录 no-cascade 结论、回滚结果和最终签字。

只有 `Gate 1 PASS + Gate 2 PASS + finalManualAcceptance PASS` 才能把任务更新为 `accepted`。`PASS_WITH_KNOWN_LIMITATIONS` 不能关闭任务，也不能作为发行结论。

## 六、无级联变更规则

施工前必须登记：

- 基线 revision 和工作树状态；
- 影响文件与消费者；
- 共享契约、Schema、资源和生成物；
- 回滚点。

施工后必须执行：

- changed-file diff review；
- 关联系统回归；
- Web/APK scope 和禁运内容检查；
- 视觉/设备复核；
- 生成物不进 Git 的检查。

一旦发现共享契约意外变化、无关行为改变、竞品资源泄漏或生成物被暂存，立即停止并回滚，不允许边修边扩大任务范围。

## 七、智能体强制交接格式

```yaml
task_id:
from_role:
to_role:
stage:
known_facts:
assumptions:
approved_decisions:
changed_files:
config_version:
interfaces:
data_contracts:
tests_run:
test_results:
known_failures:
risks:
next_action:
acceptance_owner:
```

## 八、当前任务分派

机器权威记录：[agent_work_policy.json](H:/MyProjectBack/idlewuxia/config/production/agent_work_policy.json)

- `GOV-001`：主控建立本规范和机器规则。
- `AUDIT-AGENT-001`：治理文件与双门缺口审计。
- `ASSET-002-AUDIT`：Android 图标/启动页当前实现和构建阻断审计。
- `QA-GATE-001`：QA 证据矩阵与严格 Gate 设计审计。
- `ASSET-002`：等待上述审计和政策完成后，当前仍因 Android 资源、清洁构建、API22 fallback、设备/模拟器证据和 stale PNG 排除问题保持 `blocked`，才允许进入施工。

## 九、正式状态定义

- `accepted`：两道门和主控手动验收全部通过。
- `gate_1_revise`：工程证据不足，需要智能体修订。
- `gate_2_revise`：工程通过但严格验收失败，需要修订或回滚。
- `blocked`：缺少权威数据、设备、许可或外部条件。
- `deferred`：产品负责人明确延期。
- `rolled_back`：级联影响或不可接受回归，恢复到已知良好版本。

本规范不代表当前项目已经达到发行标准；它只是后续施工的准入和验收制度。
