import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectLocalTestMongo,
  getDemoSeedError,
  getSeedTargetError,
  parseDbName,
  parseLocalTestMongoUri,
  verifyLocalTestConnection,
} from "../seedGuard.util.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const directSeedScripts = [
  "scripts/auditSeedDataReadOnly.js",
  "scripts/backupDatabase.js",
  "src/seed.js",
  "src/seedAll.js",
  "src/seedBiomarkers.js",
  "src/seedEMR.js",
  "src/seedHospitals.js",
  "src/seedImaging.js",
  "seed_mock_data.js",
  "seed_drugs.js",
  "src/scripts/seed_rooms_and_beds.js",
  "src/scripts/renew_hospitals.js",
];

test("accepts only localhost and loopback MongoDB URIs with an exact _test database", () => {
  for (const uri of [
    "mongodb://localhost:27017/neuro_test",
    "mongodb://127.0.0.1:27017/neuro_test",
    "mongodb://127.25.0.10:27017/neuro_test",
    "mongodb://[::1]:27017/neuro_test",
    "mongodb://user:secret@localhost:27017/neuro_test?authSource=admin",
    "mongodb://127.0.0.1:27017,127.0.0.2:27018/neuro_test?replicaSet=rs0",
  ]) {
    assert.equal(getSeedTargetError({ mongoUri: uri, env: { NODE_ENV: "test" } }), null, uri);
    assert.equal(parseLocalTestMongoUri(uri).databaseName, "neuro_test");
  }
});

test("rejects missing, malformed, remote, Atlas, ambiguous, or non-test URIs", () => {
  for (const mongoUri of [
    undefined,
    "",
    "not-a-mongodb-uri",
    "mongodb://localhost:27017",
    "mongodb://localhost:27017/neuro",
    "mongodb://localhost:27017/neuro_test_extra",
    "mongodb://remote.example.invalid:27017/neuro_test",
    "mongodb://localhost:27017,remote.example.invalid:27018/neuro_test",
    "mongodb+srv://cluster.example.mongodb.net/neuro_test",
    "mongodb://localhost:27017/neuro_test?proxyHost=remote.example.invalid",
    "mongodb://localhost:70000/neuro_test",
  ]) {
    assert.notEqual(
      getSeedTargetError({ mongoUri, env: { NODE_ENV: "test" } }),
      null,
      String(mongoUri),
    );
  }
  assert.equal(parseDbName("mongodb+srv://cluster.example.mongodb.net/neuro_test"), "(unverified database)");
});

test("a URI option cannot bypass local-only validation or be repeated", () => {
  assert.throws(
    () => parseLocalTestMongoUri("mongodb://localhost/neuro_test?directConnection=false"),
    /not allowed/,
  );
  assert.throws(
    () => parseLocalTestMongoUri("mongodb://localhost/neuro_test?replicaSet=a&replicaSet=b"),
    /must not be repeated/,
  );
});

test("production mode is rejected even for a correctly named local test database", () => {
  assert.match(
    getSeedTargetError({
      mongoUri: "mongodb://localhost/neuro_test",
      env: { NODE_ENV: "production", SEED_CONFIRM_DB: "neuro_test", ALLOW_SEED: "true" },
    }),
    /NODE_ENV=production/,
  );
});

test("demo seed opt-in is separate and cannot authorize a remote URI", () => {
  assert.match(getDemoSeedError({ scriptName: "seedAll.js", env: {} }), /disabled/);
  assert.equal(
    getDemoSeedError({ scriptName: "seedAll.js", env: { SEED_DEMO_DATA: "true" } }),
    null,
  );
  assert.match(
    getSeedTargetError({
      mongoUri: "mongodb+srv://cluster.example.mongodb.net/neuro_test",
      env: { NODE_ENV: "development", SEED_DEMO_DATA: "true", SEED_CONFIRM_DB: "neuro_test" },
    }),
    /Only mongodb:\/\/ URIs to a local test server/,
  );
});

test("connection guard refuses remote targets before calling mongoose.connect", async () => {
  let connectCalled = false;
  const fakeMongoose = {
    connect: async () => {
      connectCalled = true;
    },
  };
  await assert.rejects(
    connectLocalTestMongo(fakeMongoose, "mongodb+srv://cluster.example.mongodb.net/neuro_test", {
      env: { NODE_ENV: "test" },
      logger: { log() {} },
    }),
    /Only mongodb:\/\/ URIs/,
  );
  assert.equal(connectCalled, false);
});

test("connection guard refuses a local URI with the wrong database before connecting", async () => {
  let connectCalled = false;
  await assert.rejects(
    connectLocalTestMongo(
      { connect: async () => { connectCalled = true; } },
      "mongodb://127.0.0.1:27017/neuro",
      { env: { NODE_ENV: "test" }, logger: { log() {} } },
    ),
    /ending exactly in "_test"/,
  );
  assert.equal(connectCalled, false);
});

test("connection uses one verified local host in direct mode instead of following replica topology", async () => {
  const connectionUris = [];
  const makeConnection = () => ({
    name: "isolated_test",
    readyState: 1,
    db: {
      databaseName: "isolated_test",
      client: { topology: { description: { servers: new Map() } } },
      admin: () => ({
        command: async () => ({
          setName: "local-rs",
          me: "127.0.0.1:27017",
          hosts: ["127.0.0.1:27017"],
        }),
      }),
    },
  });
  const fakeMongoose = {
    connection: { readyState: 0 },
    createConnection(uri) {
      connectionUris.push(uri);
      return {
        ...makeConnection(),
        async asPromise() {},
        async close() { this.readyState = 0; },
      };
    },
    async connect(uri) {
      connectionUris.push(uri);
      this.connection = makeConnection();
    },
  };

  await connectLocalTestMongo(
    fakeMongoose,
    "mongodb://127.0.0.1:27017,localhost:27018/isolated_test?replicaSet=local-rs&readPreference=nearest&appName=seed-test",
    { env: { NODE_ENV: "test" }, logger: { log() {} } },
  );

  assert.equal(connectionUris.length, 2);
  for (const uri of connectionUris) {
    const parsed = new URL(uri);
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.equal(parsed.pathname, "/isolated_test");
    assert.equal(parsed.searchParams.get("directConnection"), "true");
    assert.equal(parsed.searchParams.has("replicaSet"), false);
    assert.equal(parsed.searchParams.has("readPreference"), false);
  }
});

test("post-connect guard rejects wrong database and remotely advertised replica members", async () => {
  const fakeConnection = (name, hosts) => ({
    name,
    readyState: 1,
    host: "127.0.0.1",
    db: {
      databaseName: name,
      admin: () => ({
        command: async () => ({ setName: "rs", me: "127.0.0.1:27017", hosts }),
      }),
    },
  });

  await assert.rejects(
    verifyLocalTestConnection({ connection: fakeConnection("neuro", ["127.0.0.1:27017"]) }, "neuro_test"),
    /Connected database name/,
  );
  await assert.rejects(
    verifyLocalTestConnection(
      { connection: fakeConnection("neuro_test", ["127.0.0.1:27017", "remote.example.invalid:27018"]) },
      "neuro_test",
    ),
    /Only localhost or a loopback IP/,
  );
  const verified = await verifyLocalTestConnection(
    { connection: fakeConnection("neuro_test", ["127.0.0.1:27017"]) },
    "neuro_test",
  );
  assert.equal(verified.databaseName, "neuro_test");
});

test("seed, audit, and backup entrypoints refuse remote and missing-URI cases before connecting", () => {
  for (const mongoUri of [
    "mongodb://remote.example.invalid/neuro_test",
    "mongodb+srv://cluster.example.mongodb.net/neuro_test",
    "mongodb://127.0.0.1:27017/neuro",
    "",
  ]) {
    for (const script of directSeedScripts) {
      const result = spawnSync(process.execPath, [script], {
        cwd: backendDir,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          MONGO_URI: mongoUri,
          SEED_DEMO_DATA: "true",
          ALLOW_SEED: "true",
          SEED_CONFIRM_DB: "neuro_test",
          FILE_ENCRYPTION_KEY: "a".repeat(64),
        },
        timeout: 15000,
      });
      assert.notEqual(result.status, 0, `${script} accepted ${mongoUri || "missing MONGO_URI"}`);
      assert.match(result.stderr + result.stdout, /Only localhost|Only mongodb|MONGO_URI|database name/);
      assert.doesNotMatch(result.stderr + result.stdout, /cluster\.example\.mongodb\.net|remote\.example\.invalid/);
    }
  }
});

test("legacy documents are not modified or inferred by the isTestAccount schema default", async () => {
  const { User } = await import("../../modules/auth/models/user.model.js");
  const legacy = new User({
    email: "patient@neuroscan.com",
    passwordHash: "not-a-real-hash",
  });
  assert.equal(legacy.isTestAccount, false);
  assert.equal(legacy.isModified("isTestAccount"), false);
});
