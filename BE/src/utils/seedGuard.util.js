import { isIP } from "node:net";

const allowedQueryParameters = new Set([
  "authSource",
  "appName",
  "replicaSet",
  "retryWrites",
  "w",
  "wtimeoutMS",
  "readPreference",
]);

const parseHostPort = (hostPort) => {
  let hostname;
  let port;

  if (hostPort.startsWith("[")) {
    const match = hostPort.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (!match) throw new Error("Malformed IPv6 host.");
    hostname = match[1].toLowerCase();
    port = match[2];
    if (isIP(hostname) !== 6 || hostname !== "::1") {
      throw new Error("Only the IPv6 loopback address is allowed.");
    }
  } else {
    const match = hostPort.match(/^([^:]+)(?::(\d+))?$/);
    if (!match) throw new Error("Malformed host or port.");
    hostname = match[1].toLowerCase();
    port = match[2];
    if (hostname !== "localhost") {
      if (isIP(hostname) !== 4 || Number(hostname.split(".")[0]) !== 127) {
        throw new Error("Only localhost or a loopback IP address is allowed.");
      }
    }
  }

  if (port && (Number(port) < 1 || Number(port) > 65535)) {
    throw new Error("MongoDB port is outside the valid range.");
  }
  return hostname;
};

export const parseLocalTestMongoUri = (mongoUri) => {
  const uri = typeof mongoUri === "string" ? mongoUri.trim() : "";
  if (!uri) throw new Error("MONGO_URI is required.");
  if (uri.includes("#") || /[\s\u0000-\u001f]/.test(uri)) {
    throw new Error("MONGO_URI contains invalid characters.");
  }

  const scheme = uri.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
  if (scheme !== "mongodb") {
    throw new Error("Only mongodb:// URIs to a local test server are allowed; Atlas/SRV is refused.");
  }

  const remainder = uri.slice(uri.indexOf("://") + 3);
  const authorityEnd = remainder.search(/[/?]/);
  const authority = authorityEnd === -1 ? remainder : remainder.slice(0, authorityEnd);
  const suffix = authorityEnd === -1 ? "" : remainder.slice(authorityEnd);
  const at = authority.lastIndexOf("@");
  const hostList = at === -1 ? authority : authority.slice(at + 1);
  if (!hostList || hostList.includes("%") || hostList.includes("@")) {
    throw new Error("MONGO_URI must contain an unambiguous local host.");
  }
  if (at !== -1 && authority.slice(0, at).includes("@")) {
    throw new Error("MONGO_URI credentials must percent-encode reserved @ characters.");
  }

  const hosts = hostList.split(",");
  const hostnames = hosts.map(parseHostPort);

  const queryIndex = suffix.indexOf("?");
  const pathname = queryIndex === -1 ? suffix : suffix.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? "" : suffix.slice(queryIndex + 1);
  if (!pathname.startsWith("/") || pathname.length === 1) {
    throw new Error("MONGO_URI must include an explicit database name.");
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(pathname.slice(1));
  } catch {
    throw new Error("MONGO_URI database name is not valid URI encoding.");
  }
  if (!databaseName || /[\/\\?#\u0000-\u001f]/.test(databaseName)) {
    throw new Error("MONGO_URI must contain one valid database name.");
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error('Destructive seed/cleanup operations require a database name ending exactly in "_test".');
  }

  const parameters = new URLSearchParams(queryString);
  for (const [key] of parameters) {
    if (!allowedQueryParameters.has(key)) {
      throw new Error(`MONGO_URI option "${key}" is not allowed for destructive operations.`);
    }
    if (parameters.getAll(key).length !== 1) {
      throw new Error(`MONGO_URI option "${key}" must not be repeated.`);
    }
  }

  return {
    databaseName,
    hostnames,
    seedHosts: hosts,
    userInfo: at === -1 ? "" : authority.slice(0, at),
    queryString,
  };
};

export const verifyLocalTestDatabase = async (db, expectedDatabaseName = db?.databaseName) => {
  if (!db?.databaseName || !db.databaseName.endsWith("_test")) {
    throw new Error("Connected database name does not match the verified local _test target.");
  }
  if (expectedDatabaseName && db.databaseName !== expectedDatabaseName) {
    throw new Error("Connected database name does not match the verified local _test target.");
  }

  const hello = await db.admin().command({ hello: 1 });
  const advertisedHosts = [
    hello.me,
    hello.primary,
    ...(hello.hosts || []),
    ...(hello.passives || []),
    ...(hello.arbiters || []),
  ].filter(Boolean);
  const topologyHosts = [...(db.client?.topology?.description?.servers?.keys?.() || [])];
  advertisedHosts.push(...topologyHosts);
  if (advertisedHosts.length === 0) {
    throw new Error("MongoDB did not provide verifiable server host information.");
  }

  for (const host of advertisedHosts) {
    parseHostPort(host);
  }
  return { databaseName: db.databaseName, hosts: [...new Set(advertisedHosts)] };
};

export const verifyLocalTestConnection = async (mongooseInstance, expectedDatabaseName) => {
  const connection = mongooseInstance?.connection;
  if (!connection || connection.readyState !== 1 || !connection.db) {
    throw new Error("MongoDB connection is not established.");
  }
  if (connection.name !== expectedDatabaseName) {
    throw new Error("Connected database name does not match the verified local _test target.");
  }
  return verifyLocalTestDatabase(connection.db, expectedDatabaseName);
};

export const connectLocalTestMongo = async (
  mongooseInstance,
  mongoUri,
  { env = process.env, logger = console } = {},
) => {
  const target = parseLocalTestMongoUri(mongoUri);
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing destructive seed/cleanup while NODE_ENV=production.");
  }
  logger.log(
    `[seed-guard] verified local target DB="${target.databaseName}" hosts=${target.hostnames.join(",")}`,
  );

  try {
    const options = new URLSearchParams(target.queryString);
    options.delete("replicaSet");
    options.delete("readPreference");
    options.set("directConnection", "true");
    const credentials = target.userInfo ? `${target.userInfo}@` : "";
    const localDirectUri =
      `mongodb://${credentials}${target.seedHosts[0]}/` +
      `${encodeURIComponent(target.databaseName)}?${options.toString()}`;
    const probe = mongooseInstance.createConnection(localDirectUri, {
      serverSelectionTimeoutMS: 5000,
    });
    try {
      await probe.asPromise();
      await verifyLocalTestConnection({ connection: probe }, target.databaseName);
    } finally {
      if (probe.readyState) await probe.close();
    }

    await mongooseInstance.connect(localDirectUri, { serverSelectionTimeoutMS: 5000 });
    const connected = await verifyLocalTestConnection(
      mongooseInstance,
      target.databaseName,
    );
    logger.log(
      `[seed-guard] connected local target DB="${connected.databaseName}" hosts=${connected.hosts.join(",")}`,
    );
    return connected;
  } catch (error) {
    if (mongooseInstance.connection?.readyState) {
      await mongooseInstance.disconnect();
    }
    throw error;
  }
};

export const getDemoSeedError = ({ scriptName, env = process.env } = {}) =>
  env.SEED_DEMO_DATA === "true"
    ? null
    : `[seed-guard] "${scriptName}": demo seed is disabled. Set SEED_DEMO_DATA=true only for an isolated local _test database.`;

export const assertDemoSeedEnabled = (options = {}) => {
  const error = getDemoSeedError(options);
  if (error) {
    console.error(`\n⛔ ${error}\n`);
    process.exit(1);
  }
};

export const parseDbName = (mongoUri = "") => {
  try {
    return parseLocalTestMongoUri(mongoUri).databaseName;
  } catch {
    return "(unverified database)";
  }
};

export const getSeedTargetError = ({ mongoUri, env = process.env } = {}) => {
  if (!mongoUri || !String(mongoUri).trim()) return "MONGO_URI is required.";
  if (env.NODE_ENV === "production") {
    return "Refusing destructive seed/cleanup while NODE_ENV=production.";
  }
  try {
    parseLocalTestMongoUri(mongoUri);
    return null;
  } catch (error) {
    return error.message;
  }
};

export const assertSeedAllowed = ({
  scriptName,
  mongoUri,
  env = process.env,
  logger = console,
} = {}) => {
  const error = getSeedTargetError({ mongoUri, env });
  if (error) {
    logger.error(`\n⛔ [seed-guard] "${scriptName}": ${error}\n`);
    process.exit(1);
  }
  return parseLocalTestMongoUri(mongoUri).databaseName;
};
