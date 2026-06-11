/**
 * One-time script: creates the App Store reviewer demo accounts in Supabase + MongoDB.
 *
 * Run from the project root:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-reviewer-account.mjs
 *
 * The SUPABASE_SERVICE_ROLE_KEY is in your Supabase dashboard →
 * Project Settings → API → service_role secret.
 *
 * All other credentials are read from .env automatically.
 */

import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "dvision";

const CAREGIVER_EMAIL = "appreview@velavision.org";
const CAREGIVER_PASSWORD = "VelaReview2026!";
const PATIENT_EMAIL = "appreview-patient@velavision.org";
const PATIENT_PASSWORD = "VelaReview2026!";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "\nERROR: SUPABASE_SERVICE_ROLE_KEY not set.\n" +
    "Add it to your .env file or pass it inline:\n\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-reviewer-account.mjs\n\n" +
    "Find it in: Supabase dashboard → Project Settings → API → service_role\n"
  );
  process.exit(1);
}

async function createSupabaseUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // skip confirmation email
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    // If user already exists, fetch their ID instead
    if (data.msg?.includes("already been registered") || data.code === "email_exists") {
      console.log(`  ↩  ${email} already exists in Supabase, fetching UID...`);
      return await getSupabaseUserId(email);
    }
    throw new Error(`Supabase create user failed (${res.status}): ${JSON.stringify(data)}`);
  }

  console.log(`  ✓  Supabase user created: ${email} (uid: ${data.id})`);
  return data.id;
}

async function getSupabaseUserId(email) {
  // List users and find by email (Supabase admin API doesn't have a direct lookup-by-email)
  let page = 1;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=50`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const data = await res.json();
    const users = data.users || [];
    if (users.length === 0) break;
    const match = users.find((u) => u.email === email);
    if (match) {
      console.log(`  ✓  Found existing Supabase user: ${email} (uid: ${match.id})`);
      return match.id;
    }
    if (users.length < 50) break;
    page++;
  }
  throw new Error(`Could not find Supabase user with email: ${email}`);
}

async function generateLinkCode(db) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const existing = await db.collection("patients").findOne({ link_code: code });
    if (!existing) return code;
  }
  throw new Error("Could not generate unique link code");
}

async function main() {
  console.log("\n=== VelaVision App Store Reviewer Account Setup ===\n");

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  try {
    // --- Step 1: Create Supabase accounts ---
    console.log("Step 1: Creating Supabase accounts...");
    const caregiverUid = await createSupabaseUser(CAREGIVER_EMAIL, CAREGIVER_PASSWORD);
    const patientUid = await createSupabaseUser(PATIENT_EMAIL, PATIENT_PASSWORD);

    // --- Step 2: Check if MongoDB docs already exist ---
    console.log("\nStep 2: Setting up MongoDB documents...");

    const existingCaregiver = await db.collection("users").findOne({ supabase_uid: caregiverUid });
    const existingPatientUser = await db.collection("users").findOne({ supabase_uid: patientUid });

    if (existingCaregiver && existingCaregiver.patient_id) {
      console.log("  ↩  Caregiver already exists and is linked. Skipping MongoDB setup.");
      console.log("\n=== Already done! Credentials below ===");
      printCredentials();
      return;
    }

    // --- Step 3: Create patient profile document ---
    let patientId;
    if (existingPatientUser?.patient_id) {
      patientId = String(existingPatientUser.patient_id);
      console.log(`  ↩  Patient profile already exists: ${patientId}`);
    } else {
      const linkCode = await generateLinkCode(db);
      const patientDoc = {
        name: "Demo Patient",
        age: 72,
        diagnosis: "Alzheimer's Disease (Early Stage)",
        notes: "App Store reviewer demo patient.",
        caregiver_id: "",
        caregiver_ids: [],
        link_code: linkCode,
        created_at: new Date().toISOString(),
      };
      const patientResult = await db.collection("patients").insertOne(patientDoc);
      patientId = String(patientResult.insertedId);
      console.log(`  ✓  Patient profile created: ${patientId} (link code: ${linkCode})`);
    }

    // --- Step 4: Create patient user doc ---
    let patientUserMongoId;
    if (existingPatientUser) {
      patientUserMongoId = String(existingPatientUser._id);
      if (!existingPatientUser.patient_id) {
        await db.collection("users").updateOne(
          { _id: existingPatientUser._id },
          { $set: { patient_id: patientId } }
        );
      }
      console.log(`  ↩  Patient user doc already exists: ${patientUserMongoId}`);
    } else {
      const patientUserDoc = {
        supabase_uid: patientUid,
        email: PATIENT_EMAIL,
        name: "Demo Patient",
        role: "patient",
        patient_id: patientId,
        created_at: new Date().toISOString(),
      };
      const patientUserResult = await db.collection("users").insertOne(patientUserDoc);
      patientUserMongoId = String(patientUserResult.insertedId);
      console.log(`  ✓  Patient user doc created: ${patientUserMongoId}`);
    }

    // --- Step 5: Create caregiver user doc ---
    let caregiverMongoId;
    if (existingCaregiver) {
      caregiverMongoId = String(existingCaregiver._id);
      await db.collection("users").updateOne(
        { _id: existingCaregiver._id },
        { $set: { patient_id: patientId } }
      );
      console.log(`  ↩  Caregiver user doc already exists, updated patient_id: ${caregiverMongoId}`);
    } else {
      const caregiverDoc = {
        supabase_uid: caregiverUid,
        email: CAREGIVER_EMAIL,
        name: "App Reviewer",
        role: "caregiver",
        patient_id: patientId,
        created_at: new Date().toISOString(),
      };
      const caregiverResult = await db.collection("users").insertOne(caregiverDoc);
      caregiverMongoId = String(caregiverResult.insertedId);
      console.log(`  ✓  Caregiver user doc created: ${caregiverMongoId}`);
    }

    // --- Step 6: Link caregiver to patient ---
    await db.collection("patients").updateOne(
      { _id: new ObjectId(patientId) },
      { $addToSet: { caregiver_ids: caregiverMongoId } }
    );
    console.log(`  ✓  Linked caregiver ${caregiverMongoId} to patient ${patientId}`);

    // --- Step 7: Create seat record ---
    const existingSeat = await db.collection("seats").findOne({
      userId: caregiverUid,
      patientId,
    });
    if (!existingSeat) {
      await db.collection("seats").insertOne({
        userId: caregiverUid,
        patientId,
        role: "primary_caregiver",
        createdAt: new Date().toISOString(),
      });
      console.log(`  ✓  Seat record created`);
    } else {
      console.log(`  ↩  Seat record already exists`);
    }

    console.log("\n=== Setup complete! ===\n");
    printCredentials();
  } finally {
    await client.close();
  }
}

function printCredentials() {
  console.log("CAREGIVER ACCOUNT (use this in App Store Connect):");
  console.log(`  Email:    ${CAREGIVER_EMAIL}`);
  console.log(`  Password: ${CAREGIVER_PASSWORD}`);
  console.log("\nPATIENT ACCOUNT (linked to the caregiver above):");
  console.log(`  Email:    ${PATIENT_EMAIL}`);
  console.log(`  Password: ${CAREGIVER_PASSWORD}`);
  console.log("\nEnter the caregiver credentials in:");
  console.log("  App Store Connect → Your App → App Review Information → Sign-in required\n");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
