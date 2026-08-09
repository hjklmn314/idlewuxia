import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const contract = JSON.parse(fs.readFileSync(new URL("../config/runtime_persistence_contract.json", import.meta.url), "utf8"));
const schema = JSON.parse(fs.readFileSync(new URL("../config/runtime_persistence_contract.schema.json", import.meta.url), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

if (!validate(contract)) {
  console.error(JSON.stringify({ status: "fail", errors: validate.errors }, null, 2));
  process.exit(1);
}

const keys = [contract.storageKey, contract.stagingStorageKey, contract.backupStorageKey, contract.rollbackStorageKey];
if (new Set(keys).size !== keys.length) throw new Error("runtime persistence storage keys must be unique");
const migrations = [...contract.migrations].sort((left, right) => left.fromVersion - right.fromVersion);
let version = contract.minimumReadableVersion;
for (const migration of migrations) {
  if (migration.fromVersion !== version || migration.toVersion !== version + 1) {
    throw new Error(`runtime persistence migration chain is not contiguous at version ${version}`);
  }
  version = migration.toVersion;
}
if (version !== contract.schemaVersion) throw new Error("runtime persistence migration chain does not reach schemaVersion");

console.log(JSON.stringify({
  status: "pass",
  schemaVersion: contract.schemaVersion,
  minimumReadableVersion: contract.minimumReadableVersion,
  migrationIds: migrations.map((migration) => migration.id),
  storageKeys: keys,
}, null, 2));
