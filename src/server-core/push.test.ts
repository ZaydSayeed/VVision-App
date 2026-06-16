import { describe, it, expect, beforeEach } from "vitest";
import { getCaregiverPushTokens, buildHelpPushMessages, getPatientPushToken } from "./push";

describe("getCaregiverPushTokens", () => {
  const db = () => globalThis.__TEST_DB__;

  beforeEach(async () => {
    await db().collection("pushTokens").deleteMany({});
  });

  it("returns every valid caregiver Expo token for the patient (fan-out, not just one)", async () => {
    await db().collection("pushTokens").insertMany([
      { patientId: "p1", caregiverId: "c1", expoPushToken: "ExponentPushToken[aaa]" },
      { patientId: "p1", caregiverId: "c2", expoPushToken: "ExponentPushToken[bbb]" },
      { patientId: "other", caregiverId: "c3", expoPushToken: "ExponentPushToken[ccc]" },
    ]);
    const tokens = await getCaregiverPushTokens(db(), "p1");
    expect(tokens.sort()).toEqual(["ExponentPushToken[aaa]", "ExponentPushToken[bbb]"]);
  });

  it("ignores docs with a missing or malformed token", async () => {
    await db().collection("pushTokens").insertMany([
      { patientId: "p1", expoPushToken: "ExponentPushToken[ok]" },
      { patientId: "p1", expoPushToken: null },
      { patientId: "p1", expoPushToken: "garbage" },
    ]);
    const tokens = await getCaregiverPushTokens(db(), "p1");
    expect(tokens).toEqual(["ExponentPushToken[ok]"]);
  });

  it("returns an empty array when the patient has no caregiver tokens", async () => {
    const tokens = await getCaregiverPushTokens(db(), "nobody");
    expect(tokens).toEqual([]);
  });
});

describe("getPatientPushToken", () => {
  const db = () => globalThis.__TEST_DB__;

  beforeEach(async () => {
    await db().collection("patientPushTokens").deleteMany({});
  });

  it("returns the patient's own valid Expo token", async () => {
    await db().collection("patientPushTokens").insertOne({ patientId: "p1", expoPushToken: "ExponentPushToken[pat]" });
    expect(await getPatientPushToken(db(), "p1")).toBe("ExponentPushToken[pat]");
  });

  it("returns null when the token is missing or malformed", async () => {
    await db().collection("patientPushTokens").insertOne({ patientId: "p1", expoPushToken: "garbage" });
    expect(await getPatientPushToken(db(), "p1")).toBeNull();
    expect(await getPatientPushToken(db(), "nobody")).toBeNull();
  });
});

describe("buildHelpPushMessages", () => {
  it("builds one high-priority message per token, naming the patient", () => {
    const msgs = buildHelpPushMessages(["ExponentPushToken[a]", "ExponentPushToken[b]"], "Mary");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].to).toBe("ExponentPushToken[a]");
    expect(msgs[0].priority).toBe("high");
    expect(msgs[0].body).toContain("Mary");
    expect(msgs[0].data?.type).toBe("help_request");
  });

  it("returns no messages when there are no tokens", () => {
    expect(buildHelpPushMessages([], "Mary")).toEqual([]);
  });
});
