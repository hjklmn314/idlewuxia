# idlewuxia Android 身份合同

## 唯一身份

| 字段 | 值 |
| --- | --- |
| 正式 applicationId | `com.idlewuxia.app` |
| Debug applicationId | `com.idlewuxia.app.debug` |
| namespace / Java package | `com.idlewuxia.app` |
| Launcher | `com.idlewuxia.app.MainActivity` |
| 应用名 | `Idle Wuxia` |
| versionName / versionCode | `0.1.0` / `1` |

机器可读来源是 `config/android_identity_contract.json`。其他文件都是该合同的消费适配器，不得自行定义第二套身份。

## 消费链

| 消费者 | 责任 |
| --- | --- |
| `capacitor.config.json` | Capacitor appId、appName |
| `android/app/build.gradle` | namespace、applicationId、Debug 后缀、版本 |
| `android/app/src/main/java/com/idlewuxia/app/MainActivity.java` | Launcher Java package |
| Android unit/instrumented tests | 测试 package 与 Debug 目标包断言 |
| `android/app/src/main/res/values/strings.xml` | 应用名、包名资源、URL scheme |
| `AndroidManifest.xml` | 相对 Launcher 与 `${applicationId}` FileProvider authority |
| `tools/validate-mobile-shell.mjs` | 从合同解析 MainActivity 路径 |
| `tools/audit-android-debug.mjs` | 从身份合同和 R0 shippingFiles 审计实际 APK |

`config/iap_product_catalog.json` 中的 `com.infinitygames.dotcollect` 是旧产品研究证据，不是当前应用身份。它被明确列为 evidence-only，不得复制到 Gradle、Java、Manifest、资源、APK 审计或活动运行时。

## 深模块与门禁

`tools/lib/android-identity.mjs` 对外提供一个评估接口，内部集中处理合同不变量、各格式消费者、旧路径、旧品牌标记和测试目标包校验。磁盘/Git 读取与报告写入位于 `tools/validate-android-identity.mjs` 适配层；测试通过同一接口使用内存文件集合。

```bash
npm run android:identity:test
npm run android:identity
npm run task:preflight
npm run android:sync
```

审计报告写入忽略目录：

```text
outputs/android_identity/android_identity_audit.json
outputs/android_identity/android_identity_audit.md
```

## T01-01 完成标准

- 身份合同测试全通过；
- Capacitor、Gradle、Java、测试、资源、Manifest、审计脚本零漂移；
- 三个旧 Java/test 路径不再被 Git 跟踪；
- Android 运行时文件中不存在旧射击包名、模板包名和旧产品名；
- `cap sync android` 后身份门禁仍通过；
- Debug Java/Gradle 构建通过，并能从 APK 解析出 `com.idlewuxia.app.debug`；
- GitHub Actions 通过。

T01-01 不覆盖正式商店签名、版本升级策略、权限最小化和真机完整首局验收；它们分别属于 T01-02、T01-03 和 T01-04。
