import crypto from "crypto";
import { Db } from "mongodb";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generate(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

// Generates a link code guaranteed unique in the patients collection.
// Relies on the unique index on link_code for safety — retries on duplicate key.
export async function generateUniqueLinkCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generate();
    const existing = await db.collection("patients").findOne({ link_code: code });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique link code after 10 attempts.");
}
