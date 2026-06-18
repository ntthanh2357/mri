// Feature: admin-backoffice, Property 3: Lock is idempotent — state and audit trail

/**
 * Property 3: lockUserById is idempotent — state and audit trail
 *
 * Validates: Requirements 4.2, 4.3, 4.6
 *
 * - Req 4.2: Locking an unlocked user sets isLocked=true
 * - Req 4.3: Locking an already-locked user returns current user WITHOUT creating a new AuditLog
 * - Req 4.6: Locking false→true creates exactly ONE AuditLog with correct fields
 */

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as fc from "fast-check";
import { User } from "../../models/user.model";
import { AuditLog } from "../../models/auditLog.model";
import { Dataset } from "../../models/dataset.model";
import { lockUserById, unlockUserById, verifyDoctorById, getSystemStats } from "../user.service";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AuditLog.deleteMany({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal valid user in the DB.
 * `passwordHash` is required by the schema, so we provide a dummy value.
 */
async function createUser(email, isLocked) {
  return User.create({
    email,
    passwordHash: "hash_placeholder",
    role: "patient",
    isVerified: false,
    isLocked,
    tokenVersion: 0,
    profile: { name: "Test User" },
  });
}

/**
 * Create a minimal valid doctor in the DB.
 */
async function createDoctor(email, isVerified) {
  return User.create({
    email,
    passwordHash: "hash_placeholder",
    role: "doctor",
    isVerified,
    isLocked: false,
    tokenVersion: 0,
    profile: { name: "Test Doctor" },
  });
}

/** Generate a valid ObjectId-like string to use as adminId */
const adminIdArbitrary = fc.constant(new mongoose.Types.ObjectId().toString());

/** Generate a unique-ish email for each run */
const emailArbitrary = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    fc.nat({ max: 9999 })
  )
  .map(([prefix, suffix]) => `${prefix}${suffix}@test.com`);

// ---------------------------------------------------------------------------
// Property 3a — Req 4.2: Locking an unlocked user sets isLocked=true
// ---------------------------------------------------------------------------

describe("Property 3a — lockUserById sets isLocked=true on unlocked user (Req 4.2)", () => {
  /**
   * **Validates: Requirements 4.2**
   */
  it("property: returned user always has isLocked=true after locking an unlocked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange: fresh unlocked user each run
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, false);
        const userId = user._id.toString();

        // Act
        const result = await lockUserById(userId, adminId);

        // Assert: returned document reflects isLocked=true
        expect(result).not.toBeNull();
        expect(result.isLocked).toBe(true);

        // Confirm the DB was also updated
        const dbUser = await User.findById(userId).lean();
        expect(dbUser.isLocked).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3b — Req 4.3: Locking an already-locked user creates NO new AuditLog
// ---------------------------------------------------------------------------

describe("Property 3b — lockUserById on already-locked user is idempotent (Req 4.3)", () => {
  /**
   * **Validates: Requirements 4.3**
   */
  it("property: AuditLog count unchanged when locking an already-locked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange: fresh already-locked user
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, true);
        const userId = user._id.toString();

        const countBefore = await AuditLog.countDocuments();

        // Act
        await lockUserById(userId, adminId);

        // Assert: no new AuditLog entries were created
        const countAfter = await AuditLog.countDocuments();
        expect(countAfter).toBe(countBefore);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3c — Req 4.6: Locking false→true creates exactly ONE correct AuditLog
// ---------------------------------------------------------------------------

describe("Property 3c — lockUserById creates exactly one correct AuditLog on false→true (Req 4.6)", () => {
  /**
   * **Validates: Requirements 4.6**
   */
  it("property: exactly one AuditLog with correct fields after locking an unlocked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, false);
        const userId = user._id.toString();

        // Act
        await lockUserById(userId, adminId);

        // Assert: exactly one audit log for this entity
        const logs = await AuditLog.find({ entityId: userId }).lean();
        expect(logs).toHaveLength(1);

        const log = logs[0];
        expect(log.action).toBe("lock-user");
        expect(log.entity).toBe("User");
        expect(log.entityId).toBe(userId);
        expect(log.performedBy).toBe(adminId);
        expect(log.details).toContain(email);
        expect(log.details).toContain("locked by admin");
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3d — Compound idempotence: calling lockUserById twice yields exactly 1 AuditLog
// ---------------------------------------------------------------------------

describe("Property 3d — Compound idempotence: two consecutive locks produce exactly one AuditLog (Req 4.3 + 4.6)", () => {
  /**
   * **Validates: Requirements 4.3, 4.6**
   */
  it("property: AuditLog count = 1 after calling lockUserById twice on initially-unlocked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, false);
        const userId = user._id.toString();

        // Act: lock twice
        await lockUserById(userId, adminId);
        await lockUserById(userId, adminId);

        // Assert: still only one audit log entry total
        const totalLogs = await AuditLog.countDocuments({ entityId: userId });
        expect(totalLogs).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Bonus: sensitive fields must not appear on returned user
// ---------------------------------------------------------------------------

describe("Bonus — sensitive fields excluded from returned user", () => {
  it("returned user does not contain passwordHash, otpCode, otpExpires, tokenVersion", async () => {
    const email = "sensitivecheck@test.com";
    const adminId = new mongoose.Types.ObjectId().toString();

    const user = await createUser(email, false);
    const result = await lockUserById(user._id.toString(), adminId);

    expect(result).not.toBeNull();
    expect(result.passwordHash).toBeUndefined();
    expect(result.otpCode).toBeUndefined();
    expect(result.otpExpires).toBeUndefined();
    expect(result.tokenVersion).toBeUndefined();
  });
});

// Feature: admin-backoffice, Property 4: Unlock is idempotent — state and audit trail

/**
 * Property 4: unlockUserById is idempotent — state and audit trail
 *
 * Validates: Requirements 5.2, 5.3, 5.6
 *
 * - Req 5.2: Unlocking a locked user sets isLocked=false
 * - Req 5.3: Unlocking an already-unlocked user returns current user WITHOUT creating a new AuditLog
 * - Req 5.6: Unlocking true→false creates exactly ONE AuditLog with correct fields
 */

// ---------------------------------------------------------------------------
// Property 4a — Req 5.2: Unlocking a locked user sets isLocked=false
// ---------------------------------------------------------------------------

describe("Property 4a — unlockUserById sets isLocked=false on locked user (Req 5.2)", () => {
  /**
   * **Validates: Requirements 5.2**
   */
  it("property: returned user always has isLocked=false after unlocking a locked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange: fresh locked user each run
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, true);
        const userId = user._id.toString();

        // Act
        const result = await unlockUserById(userId, adminId);

        // Assert: returned document reflects isLocked=false
        expect(result).not.toBeNull();
        expect(result.isLocked).toBe(false);

        // Confirm the DB was also updated
        const dbUser = await User.findById(userId).lean();
        expect(dbUser.isLocked).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4b — Req 5.3: Unlocking an already-unlocked user creates NO new AuditLog
// ---------------------------------------------------------------------------

describe("Property 4b — unlockUserById on already-unlocked user is idempotent (Req 5.3)", () => {
  /**
   * **Validates: Requirements 5.3**
   */
  it("property: AuditLog count unchanged when unlocking an already-unlocked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange: fresh already-unlocked user
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, false);
        const userId = user._id.toString();

        const countBefore = await AuditLog.countDocuments();

        // Act
        await unlockUserById(userId, adminId);

        // Assert: no new AuditLog entries were created
        const countAfter = await AuditLog.countDocuments();
        expect(countAfter).toBe(countBefore);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4c — Req 5.6: Unlocking true→false creates exactly ONE correct AuditLog
// ---------------------------------------------------------------------------

describe("Property 4c — unlockUserById creates exactly one correct AuditLog on true→false (Req 5.6)", () => {
  /**
   * **Validates: Requirements 5.6**
   */
  it("property: exactly one AuditLog with correct fields after unlocking a locked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, true);
        const userId = user._id.toString();

        // Act
        await unlockUserById(userId, adminId);

        // Assert: exactly one audit log for this entity
        const logs = await AuditLog.find({ entityId: userId }).lean();
        expect(logs).toHaveLength(1);

        const log = logs[0];
        expect(log.action).toBe("unlock-user");
        expect(log.entity).toBe("User");
        expect(log.entityId).toBe(userId);
        expect(log.performedBy).toBe(adminId);
        expect(log.details).toContain(email);
        expect(log.details).toContain("unlocked by admin");
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4d — Compound idempotence: calling unlockUserById twice yields exactly 1 AuditLog
// ---------------------------------------------------------------------------

describe("Property 4d — Compound idempotence: two consecutive unlocks produce exactly one AuditLog (Req 5.3 + 5.6)", () => {
  /**
   * **Validates: Requirements 5.3, 5.6**
   */
  it("property: AuditLog count = 1 after calling unlockUserById twice on initially-locked user", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const user = await createUser(email, true);
        const userId = user._id.toString();

        // Act: unlock twice
        await unlockUserById(userId, adminId);
        await unlockUserById(userId, adminId);

        // Assert: still only one audit log entry total
        const totalLogs = await AuditLog.countDocuments({ entityId: userId });
        expect(totalLogs).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Bonus: sensitive fields must not appear on returned user after unlock
// ---------------------------------------------------------------------------

describe("Bonus — sensitive fields excluded from returned user after unlock", () => {
  it("returned user does not contain passwordHash, otpCode, otpExpires, tokenVersion after unlock", async () => {
    const email = "sensitiveunlock@test.com";
    const adminId = new mongoose.Types.ObjectId().toString();

    const user = await createUser(email, true);
    const result = await unlockUserById(user._id.toString(), adminId);

    expect(result).not.toBeNull();
    expect(result.passwordHash).toBeUndefined();
    expect(result.otpCode).toBeUndefined();
    expect(result.otpExpires).toBeUndefined();
    expect(result.tokenVersion).toBeUndefined();
  });
});

// Feature: admin-backoffice, Property 6: Doctor verify/unverify state and audit trail

/**
 * Property 6: verifyDoctorById — verify/unverify state and audit trail
 *
 * Validates: Requirements 3.2, 3.3, 3.8
 *
 * - Req 3.2: Updating a doctor with verified=true sets isVerified=true
 * - Req 3.3: Updating a doctor with verified=false sets isVerified=false
 * - Req 3.8: Each verify/unverify action creates exactly one AuditLog with correct fields
 */

// ---------------------------------------------------------------------------
// Property 6a — Req 3.2: verify doctor sets isVerified=true
// ---------------------------------------------------------------------------

describe("Property 6a — verifyDoctorById sets isVerified=true (Req 3.2)", () => {
  /**
   * **Validates: Requirements 3.2**
   */
  it("property: returned doctor always has isVerified=true after verifying an unverified doctor", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange: fresh unverified doctor each run
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const doctor = await createDoctor(email, false);
        const doctorId = doctor._id.toString();

        // Act
        const result = await verifyDoctorById(doctorId, true, adminId);

        // Assert: returned document reflects isVerified=true
        expect(result).not.toBeNull();
        expect(result.isVerified).toBe(true);

        // Confirm the DB was also updated
        const dbUser = await User.findById(doctorId).lean();
        expect(dbUser.isVerified).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6b — Req 3.3: unverify doctor sets isVerified=false
// ---------------------------------------------------------------------------

describe("Property 6b — verifyDoctorById sets isVerified=false (Req 3.3)", () => {
  /**
   * **Validates: Requirements 3.3**
   */
  it("property: returned doctor always has isVerified=false after unverifying a verified doctor", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange: fresh verified doctor each run
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const doctor = await createDoctor(email, true);
        const doctorId = doctor._id.toString();

        // Act
        const result = await verifyDoctorById(doctorId, false, adminId);

        // Assert: returned document reflects isVerified=false
        expect(result).not.toBeNull();
        expect(result.isVerified).toBe(false);

        // Confirm the DB was also updated
        const dbUser = await User.findById(doctorId).lean();
        expect(dbUser.isVerified).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6c — Req 3.8: verify creates AuditLog with action="verify-doctor"
// ---------------------------------------------------------------------------

describe("Property 6c — verifyDoctorById creates AuditLog action=verify-doctor (Req 3.8)", () => {
  /**
   * **Validates: Requirements 3.8**
   */
  it("property: exactly one AuditLog with correct fields after verifying a doctor", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const doctor = await createDoctor(email, false);
        const doctorId = doctor._id.toString();

        // Act
        await verifyDoctorById(doctorId, true, adminId);

        // Assert: exactly one audit log for this entity
        const logs = await AuditLog.find({ entityId: doctorId }).lean();
        expect(logs).toHaveLength(1);

        const log = logs[0];
        expect(log.action).toBe("verify-doctor");
        expect(log.entity).toBe("User");
        expect(log.entityId).toBe(doctorId);
        expect(log.performedBy).toBe(adminId);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6d — Req 3.8: unverify creates AuditLog with action="unverify-doctor"
// ---------------------------------------------------------------------------

describe("Property 6d — verifyDoctorById creates AuditLog action=unverify-doctor (Req 3.8)", () => {
  /**
   * **Validates: Requirements 3.8**
   */
  it("property: exactly one AuditLog with correct fields after unverifying a doctor", async () => {
    await fc.assert(
      fc.asyncProperty(emailArbitrary, adminIdArbitrary, async (email, adminId) => {
        // Arrange
        await User.deleteMany({});
        await AuditLog.deleteMany({});

        const doctor = await createDoctor(email, true);
        const doctorId = doctor._id.toString();

        // Act
        await verifyDoctorById(doctorId, false, adminId);

        // Assert: exactly one audit log for this entity
        const logs = await AuditLog.find({ entityId: doctorId }).lean();
        expect(logs).toHaveLength(1);

        const log = logs[0];
        expect(log.action).toBe("unverify-doctor");
        expect(log.entity).toBe("User");
        expect(log.entityId).toBe(doctorId);
        expect(log.performedBy).toBe(adminId);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6e — non-doctor throws error (boundary / negative test)
// ---------------------------------------------------------------------------

describe("Property 6e — verifyDoctorById throws for non-doctor users", () => {
  /**
   * **Validates: Requirements 3.5 (doctor not found / wrong role)**
   */
  it("property: throws and creates no AuditLog for non-doctor roles", async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArbitrary,
        adminIdArbitrary,
        fc.constantFrom("patient", "admin"),
        async (email, adminId, role) => {
          // Arrange
          await User.deleteMany({});
          await AuditLog.deleteMany({});

          const user = await User.create({
            email,
            passwordHash: "hash_placeholder",
            role,
            isVerified: false,
            isLocked: false,
            tokenVersion: 0,
            profile: { name: "Non Doctor" },
          });
          const userId = user._id.toString();

          // Act & Assert: must throw
          await expect(verifyDoctorById(userId, true, adminId)).rejects.toThrow("Doctor not found");

          // No AuditLog should have been created
          const logCount = await AuditLog.countDocuments();
          expect(logCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Bonus — sensitive fields excluded from returned doctor
// ---------------------------------------------------------------------------

describe("Bonus — sensitive fields excluded from returned doctor", () => {
  it("returned doctor does not contain passwordHash, otpCode, otpExpires, tokenVersion", async () => {
    const email = "sensitivedoctor@test.com";
    const adminId = new mongoose.Types.ObjectId().toString();

    const doctor = await createDoctor(email, false);
    const result = await verifyDoctorById(doctor._id.toString(), true, adminId);

    expect(result).not.toBeNull();
    expect(result.passwordHash).toBeUndefined();
    expect(result.otpCode).toBeUndefined();
    expect(result.otpExpires).toBeUndefined();
    expect(result.tokenVersion).toBeUndefined();
  });
});

// Feature: admin-backoffice, Property 5: Stats counts are accurate

/**
 * Property 5: getSystemStats returns counts that exactly match DB state
 *
 * Validates: Requirements 6.2
 *
 * For any state of the database (any number of users, doctors, datasets, audit logs),
 * calling getSystemStats() SHALL return counts that exactly match:
 * - User.countDocuments()              → totalUsers
 * - User.countDocuments({ role: "doctor" }) → totalDoctors
 * - Dataset.countDocuments()           → totalDatasets
 * - AuditLog.countDocuments()          → totalAuditLogs
 */

describe("Property 5 — getSystemStats returns accurate counts for any DB state (Req 6.2)", () => {
  /**
   * **Validates: Requirements 6.2**
   */
  it("property: stats counts exactly match DB state across arbitrary populations", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.nat({ max: 5 }), // nPatients
          fc.nat({ max: 5 }), // nDoctors
          fc.nat({ max: 5 }), // nDatasets
          fc.nat({ max: 5 })  // nAuditLogs
        ),
        async ([nPatients, nDoctors, nDatasets, nAuditLogs]) => {
          // Arrange: clear all relevant collections for a clean slate each run
          await User.deleteMany({});
          await AuditLog.deleteMany({});
          await Dataset.deleteMany({});

          // Create nPatients patient users
          if (nPatients > 0) {
            await User.insertMany(
              Array.from({ length: nPatients }, (_, i) => ({
                email: `user${i}@p5.com`,
                passwordHash: "hash",
                role: "patient",
                isVerified: false,
                isLocked: false,
                tokenVersion: 0,
                profile: { name: "P5 User" },
              }))
            );
          }

          // Create nDoctors doctor users
          if (nDoctors > 0) {
            await User.insertMany(
              Array.from({ length: nDoctors }, (_, i) => ({
                email: `doc${i}@p5.com`,
                passwordHash: "hash",
                role: "doctor",
                isVerified: false,
                isLocked: false,
                tokenVersion: 0,
                profile: { name: "P5 Doc" },
              }))
            );
          }

          // Create nDatasets datasets
          if (nDatasets > 0) {
            await Dataset.insertMany(
              Array.from({ length: nDatasets }, (_, i) => ({
                name: `DS${i}`,
                price: 0,
                status: "pending",
              }))
            );
          }

          // Create nAuditLogs audit log entries
          if (nAuditLogs > 0) {
            await AuditLog.insertMany(
              Array.from({ length: nAuditLogs }, (_, i) => ({
                action: "test",
                entity: "User",
                entityId: new mongoose.Types.ObjectId().toString(),
                performedBy: "admin",
                details: "",
              }))
            );
          }

          // Act
          const stats = await getSystemStats();

          // Assert: all counts exactly match DB state
          expect(stats.totalUsers).toBe(nPatients + nDoctors);
          expect(stats.totalDoctors).toBe(nDoctors);
          expect(stats.totalDatasets).toBe(nDatasets);
          expect(stats.totalAuditLogs).toBe(nAuditLogs);
        }
      ),
      { numRuns: 100 }
    );
  });
});
