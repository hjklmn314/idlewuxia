# 工具删除与执行安全审计

## 结论

项目 Active Overlay 的结论为 `PASS`：

- 新增工具不包含永久删除命令。
- 新增工具只读项目配置/跟踪文件，只写入 `.gitignore` 已排除的 `outputs/production_os/`。
- 不从参考项目复制文件。
- 不修改 `config/wuxia_first_session_flow.json`、玩家存档或 Android 构建目录。

## 上游包已确认限制

| 项目 | 结论 | 项目处理 |
|---|---|---|
| `.codex-os/temp/` | v2.3.0 的规范临时根 | 项目沿用 |
| `Temp_Workspace` | 旧兼容命名 | 不作为新工具根 |
| `safe_delete.py` | 上游允许的范围比项目需要更广 | 不激活；项目工具不执行删除 |
| Python Schema 工具 | 依赖 `jsonschema>=4.0.0` | 本项目使用已锁定的 Ajv 8.17.1 |
| 单项 validator CLI | 部分示例使用 `--root`，实际脚本接受位置参数 | 使用统一入口或位置参数；记录为上游文档偏差 |
| Python test execution | 默认可生成 `__pycache__` | 上游审计目录位于仓库外；使用 `PYTHONDONTWRITEBYTECODE=1` |
| Adapter contract tests | 只验证结构 | 不作为 HTML Runtime 或发行证明 |
| smoke simulator | 只验证接口可运行 | 不作为战斗、平衡或产品证明 |

## 沙箱差异

两项本地门禁在受限沙箱内出现过假失败：

- Node `spawnSync` 子进程返回 `status=null`，使首局模拟器封装失败；模拟器直接运行正常，在真实本地环境重跑整套 preflight 后通过。
- Git 子进程不可用时，基线工具把 tracked files 误报为 0；在真实本地环境重跑得到 201 个文件并通过。

处理原则：记录环境限制、在真实项目执行环境重跑；不得通过删除 Git 证据或弱化断言让门禁变绿。

## 禁止事项

- 禁止对项目、参考项目或 Codex 证据目录执行递归永久删除。
- 禁止把上游 vendor、ZIP 解压目录、参考 APK 或 `outputs/` 提交到仓库。
- 禁止通过生成器覆盖手工权威配置。
- 禁止在未确认逐项来源前复制 `original-game`、`style-atlases` 或字体到运输闭包。
