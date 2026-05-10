import os from "os";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";

// Force a unique throwaway DB file per test process
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hr-os-test-"));
process.env.HR_DB_PATH = path.join(dir, `hr-os-${randomBytes(4).toString("hex")}.db`);
process.env.AUTH_SECRET = "test-secret-do-not-use-in-prod-test-secret-do-not-use-in-prod";
