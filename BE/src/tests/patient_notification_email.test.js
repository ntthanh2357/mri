import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { User } from "../models/user.model.js";
import { resolvePatientNotificationEmail } from "../services/email.service.js";
import { createPatientAtDesk, updatePatientEmail } from "../controllers/patient.controller.js";

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe("Patient notification email separated from unique login email", () => {
  const origExists = User.exists;
  const origFind = User.find;
  const origCreate = User.create;
  const origFindOne = User.findOne;

  afterEach(() => {
    User.exists = origExists;
    User.find = origFind;
    User.create = origCreate;
    User.findOne = origFindOne;
  });

  it("resolvePatientNotificationEmail prefers profile.notificationEmail over internal .local login email", () => {
    assert.equal(
      resolvePatientNotificationEmail({
        email: "bn001.123456@benhnhan.neuroscan.local",
        profile: { notificationEmail: "hainampromax@gmail.com" },
      }),
      "hainampromax@gmail.com"
    );
    assert.equal(
      resolvePatientNotificationEmail({
        email: "patient@gmail.com",
        profile: {},
      }),
      "patient@gmail.com"
    );
    assert.equal(
      resolvePatientNotificationEmail({
        email: "bn002.123456@benhnhan.neuroscan.local",
        profile: {},
      }),
      ""
    );
  });

  it("createPatientAtDesk allows an email already used by another User account", async () => {
    let createdPayload = null;
    User.exists = async (query) => Boolean(query?.email === "hainampromax@gmail.com");
    User.find = () => ({
      select: () => ({
        lean: async () => [{ profile: { medicalId: "BN003" } }],
      }),
    });
    User.create = async (payload) => {
      createdPayload = payload;
      return {
        _id: "pat_1",
        ...payload,
        toObject() {
          return { _id: "pat_1", ...payload };
        },
      };
    };

    const req = {
      user: { id: "nurse_1", hospitalId: "65f1234567890abcdef12345" },
      body: {
        name: "Hai Nam",
        phone: "0905118965",
        cccd: "079204012345",
        birthYear: 2000,
        gender: "Nam",
        address: "120 mai thuc lan",
        email: "hainampromax@gmail.com",
      },
    };
    const res = mockRes();

    await createPatientAtDesk(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(createdPayload.profile.notificationEmail, "hainampromax@gmail.com");
    assert.equal(createdPayload.email, "bn004.f12345@benhnhan.neuroscan.local");
    assert.equal(createdPayload.isVerified, false);
    assert.equal(res.body.data.profile.notificationEmail, "hainampromax@gmail.com");
  });

  it("createPatientAtDesk uses the email as loginEmail when it is not taken yet", async () => {
    let createdPayload = null;
    User.exists = async () => false;
    User.find = () => ({
      select: () => ({
        lean: async () => [],
      }),
    });
    User.create = async (payload) => {
      createdPayload = payload;
      return {
        _id: "pat_2",
        ...payload,
        toObject() {
          return { _id: "pat_2", ...payload };
        },
      };
    };

    const req = {
      user: { id: "nurse_1", hospitalId: "65f1234567890abcdef12345" },
      body: {
        name: "Nguyen Van B",
        phone: "0905118966",
        email: "freshpatient@gmail.com",
      },
    };
    const res = mockRes();

    await createPatientAtDesk(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(createdPayload.email, "freshpatient@gmail.com");
    assert.equal(createdPayload.profile.notificationEmail, "freshpatient@gmail.com");
    assert.equal(createdPayload.isVerified, true);
  });

  it("updatePatientEmail saves profile.notificationEmail without failing 409 when email belongs to another account", async () => {
    let saved = false;
    const fakePatient = {
      _id: "pat_3",
      role: "patient",
      hospitalId: "65f1234567890abcdef12345",
      email: "bn005.f12345@benhnhan.neuroscan.local",
      profile: { name: "Emergency Patient" },
      async save() {
        saved = true;
      },
    };
    User.findOne = async () => fakePatient;
    User.exists = async () => true;

    const req = {
      user: { id: "nurse_1", role: "nurse", hospitalId: "65f1234567890abcdef12345" },
      params: { patientId: "pat_3" },
      body: { email: "hainampromax@gmail.com" },
    };
    const res = mockRes();

    await updatePatientEmail(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(saved, true);
    assert.equal(fakePatient.profile.notificationEmail, "hainampromax@gmail.com");
    assert.equal(fakePatient.email, "bn005.f12345@benhnhan.neuroscan.local");
    assert.equal(res.body.data.notificationEmail, "hainampromax@gmail.com");
  });
});

