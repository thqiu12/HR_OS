/**
 * PII encryption key rotation.
 *
 * Re-encrypts all PII ciphertexts with a new key. Use when:
 *   - Original key may have been compromised
 *   - You want to regularly rotate (annual recommended)
 *   - You're moving from AUTH_SECRET fallback to a dedicated ENCRYPTION_KEY
 *
 * Usage:
 *   OLD_ENCRYPTION_KEY=<current> NEW_ENCRYPTION_KEY=<new> tsx scripts/rotate-pii-key.ts
 *
 * Plan:
 *   1. Snapshot DB before running.
 *   2. Set OLD_ENCRYPTION_KEY = current value of ENCRYPTION_KEY (or AUTH_SECRET).
 *   3. Generate NEW_ENCRYPTION_KEY: openssl rand -hex 32
 *   4. Run this script. It re-encrypts in a single transaction.
 *   5. Update ENCRYPTION_KEY env var to the new value and redeploy.
 *
 * Re-running after step 5 is a no-op for already-rotated rows.
 */

import { db } from "../lib/db";
import { decryptPII, encryptPII, _resetCryptoCacheForTests } from "../lib/crypto";

function main() {
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const newKey = process.env.NEW_ENCRYPTION_KEY;
  if (!oldKey || !newKey) {
    console.error("[rotate] Set OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY env vars");
    process.exit(1);
  }
  if (oldKey === newKey) {
    console.error("[rotate] OLD and NEW keys are identical — nothing to do");
    process.exit(1);
  }

  const employees = db.employees() as any[];
  let rotated = 0, skipped = 0, failed = 0;

  for (const e of employees) {
    const ct = db.getEmployeePiiCiphertext(e.id);
    if (!ct) { skipped++; continue; }
    const fields: any = {};
    let touched = false;

    for (const f of ["myNumberEnc", "bankAccountEnc", "passportNoEnc"] as const) {
      const enc = ct[f];
      if (!enc) continue;
      try {
        // Decrypt under old key
        process.env.ENCRYPTION_KEY = oldKey;
        _resetCryptoCacheForTests();
        const plain = decryptPII(enc);
        // Re-encrypt under new key
        process.env.ENCRYPTION_KEY = newKey;
        _resetCryptoCacheForTests();
        fields[f] = encryptPII(plain);
        touched = true;
      } catch (err: any) {
        console.error(`[rotate] ${e.id} ${f}: ${err?.message}`);
        failed++;
      }
    }

    if (touched) {
      db.setEmployeePii(e.id, fields);
      rotated++;
    }
  }

  console.log(`[rotate] done: rotated=${rotated} skipped_no_pii=${skipped} failed=${failed}`);
  console.log(`[rotate] update ENCRYPTION_KEY env to the new value before next deploy`);
  process.env.ENCRYPTION_KEY = newKey;
}

main();
