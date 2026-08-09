# G 盘旧武侠工作区清理与 H 盘迁移记录（2026-08-09）

## 1. 结论

本批次只处理四个经过精确盘点、与当前 `H:\MyProjectBack\idlewuxia` 权威工程不再承担运行时职责的 G 盘目录。删除方式限定为 Windows 回收站，不执行永久删除，也不清空回收站。

当前 HTML/Capacitor 正式工程、配置、文档和后续生产资料的唯一权威根为：

`H:\MyProjectBack\idlewuxia`

必要的旧 G 盘开发证据已按原 `outputs` 下相对路径迁移到：

`H:\MyProjectBack\idlewuxia\development_evidence\legacy_g_workspace`

该证据目录为本机开发证据，不进入 Git，不进入 Web/Android shipping 集合。

## 2. 清理范围基线

| 精确目录 | 文件数 | 字节数 | 分类 | 处置 |
| --- | ---: | ---: | --- | --- |
| `G:\codex\武侠掌门放置挂机` | 76,363 | 8,049,608,385 | 旧混合 UE/证据工作区；无 `.uproject`，不是当前正式工程 | 送入回收站 |
| `G:\codex\idlewuxia_asset002_worktree` | 76,826 | 3,812,170,125 | 已放弃的 Git worktree 与生成资产/依赖/构建输出 | 送入回收站并清理失效 worktree 元数据 |
| `G:\codex\idlewuxia_patch_20260703` | 33 | 614,553 | 旧 HTML 临时补丁 | 送入回收站 |
| `G:\codex\姝︿緺鎺岄棬鏀剧疆鎸傛満` | 26 | 21,496,764 | 乱码命名的旧生成输出 | 送入回收站 |
| **合计** | **153,248** | **11,883,889,827** | 约 11.88 GB（十进制） | 可恢复清理 |

四个目录在清理前均为普通目录，不是 reparse point。没有把 `G:\codex`、`G:\UE5 Project` 或任何其他项目列入本批次。

## 3. Git worktree 保护

待移除 worktree 的登记状态：

- worktree：`G:\codex\idlewuxia_asset002_worktree`
- 分支：`asset003-production`
- HEAD：`1e46d21c190f972bd3f5144b05abf697a2f9fc63`
- 清理前 dirty status 行数：109
- 该分支不是当前 `main` 的祖先；因此只回收工作目录并执行 `git worktree prune`，不删除分支引用和提交对象。

## 4. H 盘证据迁移

- 迁移文件：13 个。
- 迁移字节：4,725,273。
- 源/目标 SHA-256 逐文件比对：13/13 相同，0 个缺失，0 个 hash mismatch。
- 活动 `config/`、`src/`、`tools/` 与 `package.json` 中旧 G 盘绝对来源前缀：0。
- `config/wuxia_competitor_first_session_reference.json` 和 `config/wuxia_first_session_flow.json` 已改为 H 盘证据路径。
- `config/production/codex_os_project_profile.json` 及其 Schema 已把 `evidenceWorkspace` 约束到 H 盘。
- `.gitignore` 已排除 `/development_evidence/`，避免参考帧、证据 CSV/JSON 误提交或误打包。

## 5. 删除前门禁

以下门禁均在 H 盘权威工程中通过：

- `npm run production:validate`：PASS，0 findings，P0=0。
- `npm run wuxia:validate:evidence`：PASS，0 findings，17/17 实体文件匹配。
- `npm run scope:validate`：PASS，shipping 文件 29 个，0 findings。
- `npm run runtime:first-session-simulator:test`：PASS，14 个动作，0 mismatch。
- `npm run task:preflight`：PASS；策略、基线、工作区卫生、安全、生产合同、Web 新鲜度、APK 追踪、运行时、358 动作、战斗、UI sweep、Android identity、证据和首局门禁全部完成。

## 6. 安全边界

本次明确不处理：

- `G:\codex\.agents`、`G:\codex\.codex` 或其他 Codex 状态目录。
- Codex session JSONL、索引、SQLite、历史记录、用户附件或记忆文件。
- `G:\UE5 Project` 下的任何独立项目。
- `G:\codex` 下未列入表格的其他项目。
- H 盘正式工程、H 盘验证 worktree 或用户未提交内容。

## 7. 恢复与空间说明

四个目录进入回收站后仍可由 Windows 恢复。由于不清空回收站，G 盘可用空间可能不会立刻增加；永久释放这约 11.88 GB 需要用户另行明确授权清空对应回收站内容。

## 8. 执行后验收

执行后必须同时满足：

- 四个精确 G 盘源目录均不存在于原路径。
- `asset003-production` 分支仍指向原 HEAD。
- `git worktree list` 不再登记 G 盘 worktree。
- H 盘 13 个证据文件仍完整，配置 JSON 可解析。
- H 盘工作树只包含本任务明确的配置、忽略规则和本报告修改。
- 最终提交只包含项目配置和相关 Markdown，不包含迁移的参考二进制/证据文件。

执行结果：**PASS**。

- 四个精确目录已全部通过 `SendToRecycleBin` 完成，原路径 `Test-Path=False`。
- 已执行 `git worktree prune`；G 盘旧 worktree 登记已消失。
- `asset003-production` 分支仍保留，HEAD 仍为 `1e46d21c190f972bd3f5144b05abf697a2f9fc63`。
- H 盘开发证据仍为 13 个文件、4,725,273 字节，两个引用配置均可重新解析。
- 未执行回收站清空或任何永久删除命令。
