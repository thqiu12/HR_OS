import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const randomId = () => randomBytes(8).toString("hex");
import { runMigrations } from "./migrations";

const GENESIS_HASH = "0".repeat(64);
const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");
import {
  schools as seedSchools,
  departments as seedDepartments,
  employees as seedEmployees,
  jobs as seedJobs,
  candidates as seedCandidates,
  onboardingCases as seedOnboarding,
  reviewsByEmp as seedReviews,
  reminders as seedReminders,
} from "./mock";

// Reuse the connection across hot-reloads in dev
const g = globalThis as unknown as { __hrDb?: Database.Database };

function open(): Database.Database {
  if (g.__hrDb) return g.__hrDb;
  const dbPath = process.env.HR_DB_PATH || path.join(process.cwd(), "hr-os.db");
  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  runMigrations(conn);
  // Seed only in non-production environments. In production, the empty DB
  // requires `npm run bootstrap` to provision the first admin + master data
  // (see scripts/bootstrap.ts) — prevents demo data from leaking to live use.
  const row: any = conn.prepare("SELECT COUNT(*) AS n FROM schools").get();
  if (row.n === 0 && process.env.NODE_ENV !== "production" && process.env.HR_SKIP_SEED !== "1") {
    seed(conn);
  }
  g.__hrDb = conn;
  return conn;
}

function seed(c: Database.Database) {
  const tx = c.transaction(() => {
    const insSchool = c.prepare(`INSERT INTO schools (id,name,type,entity) VALUES (?,?,?,?)`);
    seedSchools.forEach((s) => insSchool.run(s.id, s.name, s.type, s.entity));

    const insDept = c.prepare(`INSERT INTO departments (id,school_id,name) VALUES (?,?,?)`);
    seedDepartments.forEach((d) => insDept.run(d.id, d.schoolId, d.name));

    const insEmp = c.prepare(`INSERT INTO employees
      (id,emp_no,name,kana,romaji,nationality,flag,email,school_id,department_id,position,hire_route,hire_date,probation_end,contract_end,zairyu_expiry,status,manager_id,evaluator_id,is_primary,cost_ratio,assignment_type,employment_type,hourly_rate,per_class_rate,contract_renewal_date)
      VALUES (@id,@empNo,@name,@kana,@romaji,@nationality,@flag,@email,@schoolId,@departmentId,@position,@hireRoute,@hireDate,@probationEnd,@contractEnd,@zairyuExpiry,@status,@managerId,@evaluatorId,@isPrimary,@costRatio,@assignmentType,@employmentType,@hourlyRate,@perClassRate,@contractRenewalDate)`);
    seedEmployees.forEach((e) =>
      insEmp.run({
        ...e,
        contractEnd: e.contractEnd ?? null,
        zairyuExpiry: e.zairyuExpiry ?? null,
        managerId: e.managerId ?? null,
        evaluatorId: e.evaluatorId ?? null,
        isPrimary: e.isPrimary ? 1 : 0,
        employmentType: (e as any).employmentType ?? "regular",
        hourlyRate: (e as any).hourlyRate ?? null,
        perClassRate: (e as any).perClassRate ?? null,
        contractRenewalDate: (e as any).contractRenewalDate ?? null,
      })
    );

    // Mirror each employee as their primary employee_assignments row.
    // The migration's backfill is a no-op when seed runs after migrations on a
    // fresh DB (employees was empty when migration ran), so seed must do it.
    const insAsg = c.prepare(`INSERT INTO employee_assignments
      (id, employee_id, school_id, department_id, position, is_primary, assignment_type, cost_ratio,
       manager_employee_id, evaluator_employee_id, start_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    seedEmployees.forEach((e) => insAsg.run(
      `asg_${randomId()}`, e.id, e.schoolId, e.departmentId, e.position,
      e.isPrimary ? 1 : 0, e.assignmentType, e.costRatio,
      e.managerId ?? null, e.evaluatorId ?? null, e.hireDate
    ));

    const insJob = c.prepare(`INSERT INTO jobs
      (id,title,school_id,department_id,route,status,open_count,posted_at)
      VALUES (@id,@title,@schoolId,@departmentId,@route,@status,@openCount,@postedAt)`);
    seedJobs.forEach((j) => insJob.run(j));

    const insCand = c.prepare(`INSERT INTO candidates
      (id,name,kana,flag,nationality,jlpt,job_id,stage,attachments,applied_at,email,phone,age,experience,source)
      VALUES (@id,@name,@kana,@flag,@nationality,@jlpt,@jobId,@stage,@attachments,@appliedAt,@email,@phone,@age,@experience,@source)`);
    seedCandidates.forEach((cd) => insCand.run({ ...cd, jlpt: cd.jlpt ?? null }));

    const insCase = c.prepare(`INSERT INTO onboarding_cases
      (id,candidate_name,flag,school_id,position,route,expected_join_date,status)
      VALUES (@id,@candidateName,@flag,@schoolId,@position,@route,@expectedJoinDate,@status)`);
    const insDoc = c.prepare(`INSERT INTO onboarding_documents
      (case_id,doc_code,doc_name,required,status,reject_reason,ord)
      VALUES (?,?,?,?,?,?,?)`);
    seedOnboarding.forEach((o) => {
      insCase.run({
        id: o.id,
        candidateName: o.candidateName,
        flag: o.flag,
        schoolId: o.schoolId,
        position: o.position,
        route: o.route,
        expectedJoinDate: o.expectedJoinDate,
        status: o.status,
      });
      o.docs.forEach((d, i) =>
        insDoc.run(o.id, d.code, d.name, d.required ? 1 : 0, d.status, d.rejectReason ?? null, i)
      );
    });

    const insRev = c.prepare(`INSERT INTO reviews
      (id,employee_id,type,period_label,due_date,rating,result,evaluator,status)
      VALUES (?,?,?,?,?,?,?,?,?)`);
    Object.entries(seedReviews).forEach(([empId, rs]) =>
      rs.forEach((r) =>
        insRev.run(r.id, empId, r.type, r.periodLabel, r.dueDate, r.rating ?? null, r.result, r.evaluator, r.status)
      )
    );

    const insRem = c.prepare(`INSERT INTO reminders
      (id,category,severity,title,detail,trigger_date,school_id)
      VALUES (?,?,?,?,?,?,?)`);
    seedReminders.forEach((r) =>
      insRem.run(r.id, r.category, r.severity, r.title, r.detail, r.triggerDate, r.schoolId)
    );

    const hash = (pw: string) => bcrypt.hashSync(pw, 8);
    const insUser = c.prepare(`INSERT INTO users (id,login_id,email,name,password_hash,employee_id) VALUES (?,?,?,?,?,?)`);
    const insRole = c.prepare(`INSERT INTO user_roles (user_id,role,scope_type,scope_id) VALUES (?,?,?,?)`);

    // ===== Demo users =====
    const users = [
      { id: "u1", loginId: "admin",        name: "高橋 校長 (Group Admin)",  email: "admin@hr.os",     pw: "admin123", empId: "e10" },
      { id: "u2", loginId: "hr-entity",    name: "渡辺 由美 (法人HR)",       email: "watanabe@hr.os",  pw: "hr123",    empId: "e11" },
      { id: "u3", loginId: "hr-s1",        name: "中村 さやか (学校HR @ s1)", email: "nakamura@hr.os", pw: "hr123",    empId: "e14" },
      { id: "u4", loginId: "principal-s1", name: "佐藤 一郎 (校長 @ s1)",     email: "sato@hr.os",     pw: "pri123",   empId: "e1"  },
      { id: "u5", loginId: "manager-s2",   name: "鈴木 次郎 (部門長 @ s2)",   email: "suzuki@hr.os",   pw: "mgr123",   empId: "e6"  },
      { id: "u6", loginId: "tanaka",       name: "田中 花子 (一般社員)",      email: "tanaka@hr.os",   pw: "emp123",   empId: "e2"  },
    ];
    users.forEach((u) => insUser.run(u.id, u.loginId, u.email, u.name, hash(u.pw), u.empId));

    const roles = [
      // u1 グループ管理者：すべてのデータ
      ["u1", "group_admin", "group", null],
      // u2 法人HR：学校法人さくら学園 配下（s1+s2）
      ["u2", "entity_hr", "entity", "学校法人さくら学園"],
      // u3 学校HR：ABC日本語学校
      ["u3", "school_hr", "school", "s1"],
      // u4 校長 + 教務部 部門長
      ["u4", "principal", "school", "s1"],
      ["u4", "manager", "department", "d1"],
      // u5 部門長：日本語学科
      ["u5", "manager", "department", "d4"],
      // u6 一般社員（自分のみ）
      ["u6", "employee", "school", "s1"],
    ] as const;
    roles.forEach((r) => insRole.run(r[0], r[1], r[2], r[3] as any));
  });
  tx();
}

// ===== Row → camelCase helpers =====
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function rowToCamel<T = any>(r: any): T {
  if (!r) return r as T;
  const out: any = {};
  for (const k of Object.keys(r)) out[camel(k)] = r[k];
  return out;
}
function rowsToCamel<T = any>(rs: any[]): T[] {
  return rs.map((r) => rowToCamel<T>(r));
}

// ===== Public API =====
export const db = {
  // reads
  schools: () => rowsToCamel(open().prepare("SELECT * FROM schools").all()),
  schoolById: (id: string) => {
    const r = open().prepare("SELECT * FROM schools WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  insertSchool: (row: { id: string; name: string; type: string; entity: string }) =>
    open().prepare("INSERT INTO schools (id, name, type, entity) VALUES (?,?,?,?)").run(row.id, row.name, row.type, row.entity),
  updateSchool: (id: string, fields: { name?: string; type?: string; entity?: string }) => {
    const map: Record<string, string> = { name: "name", type: "type", entity: "entity" };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, v] of Object.entries(fields)) if (map[k] && v !== undefined) { sets.push(`${map[k]} = ?`); args.push(v); }
    if (sets.length === 0) return;
    args.push(id);
    open().prepare(`UPDATE schools SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  },
  deleteSchool: (id: string) => {
    const c = open();
    const tx = c.transaction(() => {
      const empCount: any = c.prepare("SELECT COUNT(*) AS n FROM employees WHERE school_id = ?").get(id);
      if (empCount.n > 0) throw new Error(`学校に ${empCount.n} 名の社員が所属しているため削除できません`);
      const deptCount: any = c.prepare("SELECT COUNT(*) AS n FROM departments WHERE school_id = ?").get(id);
      if (deptCount.n > 0) throw new Error(`学校に ${deptCount.n} 件の部門が紐付いているため削除できません`);
      c.prepare("DELETE FROM schools WHERE id = ?").run(id);
    });
    tx();
  },
  departments: () => rowsToCamel(open().prepare("SELECT * FROM departments").all()),
  departmentsBySchool: (schoolId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM departments WHERE school_id = ?").all(schoolId)),
  employees: () => rowsToCamel(open().prepare("SELECT * FROM employees").all()).map(coerceBool),
  employee: (id: string) => {
    const r = open().prepare("SELECT * FROM employees WHERE id = ?").get(id);
    return r ? coerceBool(rowToCamel(r)) : null;
  },
  employeesByScope: (schoolId: string, deptId?: string) => {
    const rows = deptId
      ? open().prepare("SELECT * FROM employees WHERE school_id = ? AND department_id = ?").all(schoolId, deptId)
      : open().prepare("SELECT * FROM employees WHERE school_id = ?").all(schoolId);
    return rowsToCamel(rows).map(coerceBool);
  },
  jobs: () => rowsToCamel(open().prepare("SELECT * FROM jobs").all()),
  insertJob: (row: any) =>
    open().prepare(`INSERT INTO jobs (id,title,school_id,department_id,route,status,open_count,posted_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      row.id, row.title, row.schoolId, row.departmentId, row.route, row.status, row.openCount, row.postedAt
    ),
  insertEmployee: (row: any) =>
    open().prepare(`INSERT INTO employees
      (id,emp_no,name,kana,romaji,nationality,flag,email,school_id,department_id,position,
       hire_route,hire_date,probation_end,contract_end,zairyu_expiry,status,manager_id,evaluator_id,
       is_primary,cost_ratio,assignment_type,employment_type,hourly_rate,per_class_rate,contract_renewal_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id, row.empNo, row.name, row.kana, row.romaji, row.nationality, row.flag, row.email,
      row.schoolId, row.departmentId, row.position, row.hireRoute, row.hireDate, row.probationEnd,
      row.contractEnd ?? null, row.zairyuExpiry ?? null, row.status,
      row.managerId ?? null, row.evaluatorId ?? null, row.isPrimary ? 1 : 0, row.costRatio, row.assignmentType,
      row.employmentType ?? "regular", row.hourlyRate ?? null, row.perClassRate ?? null, row.contractRenewalDate ?? null
    ),
  updateEmployee: (id: string, fields: Record<string, any>) => {
    const allowed: Record<string, string> = {
      name: "name", kana: "kana", romaji: "romaji", nationality: "nationality", flag: "flag",
      email: "email", schoolId: "school_id", departmentId: "department_id", position: "position",
      hireRoute: "hire_route", hireDate: "hire_date", probationEnd: "probation_end",
      contractEnd: "contract_end", zairyuExpiry: "zairyu_expiry", status: "status",
      managerId: "manager_id", evaluatorId: "evaluator_id", costRatio: "cost_ratio",
      employmentType: "employment_type", hourlyRate: "hourly_rate",
      perClassRate: "per_class_rate", contractRenewalDate: "contract_renewal_date",
      commuteMode: "commute_mode", commuteAmount: "commute_amount", commuteTaxable: "commute_taxable",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed[k]) { sets.push(`${allowed[k]} = ?`); args.push(v); }
    }
    if (sets.length === 0) return;
    args.push(id);
    open().prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  },
  insertDepartment: (row: { id: string; schoolId: string; name: string }) =>
    open().prepare(`INSERT INTO departments (id,school_id,name) VALUES (?,?,?)`).run(row.id, row.schoolId, row.name),
  updateDepartment: (id: string, name: string) =>
    open().prepare(`UPDATE departments SET name = ? WHERE id = ?`).run(name, id),
  deleteDepartment: (id: string) => {
    const c = open();
    const tx = c.transaction(() => {
      const inUse: any = c.prepare("SELECT COUNT(*) AS n FROM employees WHERE department_id = ?").get(id);
      if (inUse.n > 0) throw new Error(`部門に ${inUse.n} 名の社員が所属しているため削除できません`);
      c.prepare("DELETE FROM departments WHERE id = ?").run(id);
    });
    tx();
  },
  job: (id: string) => {
    const r = open().prepare("SELECT * FROM jobs WHERE id = ?").get(id);
    return r ? rowToCamel(r) : null;
  },
  candidates: () => rowsToCamel(open().prepare("SELECT * FROM candidates").all()),
  insertCandidate: (row: any) =>
    open().prepare(`INSERT INTO candidates
      (id, name, kana, flag, nationality, jlpt, job_id, stage, attachments, applied_at, email, phone, age, experience, source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id, row.name, row.kana, row.flag, row.nationality, row.jlpt ?? null,
      row.jobId, row.stage, row.attachments, row.appliedAt, row.email, row.phone,
      row.age, row.experience, row.source
    ),
  /** Anonymize a candidate: scrub PII fields but keep stage/dates for analytics. */
  anonymizeCandidate: (id: string) => {
    open().prepare(`UPDATE candidates SET
      name = '(削除済)', kana = '', email = '', phone = '', flag = '🏳', nationality = '不明', experience = ''
      WHERE id = ?`).run(id);
  },
  /** Hard-delete candidate + all related uploaded files. */
  deleteCandidate: (id: string) => {
    const c = open();
    const tx = c.transaction(() => {
      c.prepare("DELETE FROM candidate_files WHERE candidate_id = ?").run(id);
      c.prepare("DELETE FROM interviews WHERE candidate_id = ?").run(id);
      c.prepare("DELETE FROM candidates WHERE id = ?").run(id);
    });
    tx();
  },
  candidate: (id: string) => {
    const r = open().prepare("SELECT * FROM candidates WHERE id = ?").get(id);
    return r ? rowToCamel(r) : null;
  },
  onboardingCases: () => {
    const cases = rowsToCamel<any>(open().prepare("SELECT * FROM onboarding_cases").all());
    return cases.map((c) => withDocs(c));
  },
  onboardingCase: (id: string) => {
    const r = open().prepare("SELECT * FROM onboarding_cases WHERE id = ?").get(id);
    return r ? withDocs(rowToCamel<any>(r)) : null;
  },
  reviewsByEmployee: (empId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM reviews WHERE employee_id = ? ORDER BY due_date").all(empId)),
  reviewById: (id: string) => {
    const r = open().prepare("SELECT * FROM reviews WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  insertReviewFile: (row: any) =>
    open().prepare(`INSERT INTO review_files
      (review_id, file_kind, storage_key, original_name, content_type, size_bytes, sha256, uploaded_at, uploaded_by, iv, auth_tag)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.reviewId, row.fileKind, row.storageKey, row.originalName, row.contentType,
      row.sizeBytes, row.sha256, new Date().toISOString(), row.uploadedBy, row.iv, row.authTag
    ),
  reviewFilesByReview: (reviewId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM review_files WHERE review_id = ? ORDER BY uploaded_at DESC").all(reviewId)),
  reviewFile: (id: number) => {
    const r = open().prepare("SELECT * FROM review_files WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  insertReview: (row: {
    id: string; employeeId: string; type: string; periodLabel: string;
    dueDate: string; rating: string | null; result: string; evaluator: string; status: string;
  }) =>
    open().prepare(`INSERT INTO reviews
      (id, employee_id, type, period_label, due_date, rating, result, evaluator, status)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      row.id, row.employeeId, row.type, row.periodLabel, row.dueDate,
      row.rating, row.result, row.evaluator, row.status
    ),
  /** Update a review's workflow status + optional related fields (computed score / rank). */
  updateReviewWorkflow: (id: string, fields: Record<string, any>) => {
    const allowed = [
      "workflow_status", "category_weights", "computed_score", "computed_rank",
      "calibrated_rank", "second_evaluator", "started_at", "finalized_at",
      "cancelled_reason", "feedback_meeting_at", "mid_review_notes", "rating", "result",
    ];
    const sets: string[] = []; const vals: any[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = ?`); vals.push(v);
    }
    if (sets.length === 0) return;
    vals.push(id);
    open().prepare(`UPDATE reviews SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  },

  // ===== review_items =====
  insertReviewItem: (row: {
    reviewId: string; category: string; itemKey: string; title: string;
    description?: string | null; weightPct?: number | null; target?: string | null; ord?: number;
  }) => {
    const now = new Date().toISOString();
    open().prepare(`INSERT INTO review_items
      (review_id, category, item_key, title, description, weight_pct, target, ord, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      row.reviewId, row.category, row.itemKey, row.title, row.description ?? null,
      row.weightPct ?? null, row.target ?? null, row.ord ?? 0, now, now
    );
  },
  itemsByReview: (reviewId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM review_items WHERE review_id = ? ORDER BY category, ord, id").all(reviewId)),
  updateReviewItem: (id: number, fields: Record<string, any>) => {
    const allowed = [
      "title", "description", "weight_pct", "target",
      "self_actual", "self_score", "self_comment",
      "mgr_actual", "mgr_score", "mgr_comment",
      "second_score", "second_comment", "final_score",
    ];
    const sets: string[] = []; const vals: any[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k} = ?`); vals.push(v);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = ?"); vals.push(new Date().toISOString());
    vals.push(id);
    open().prepare(`UPDATE review_items SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  },
  deleteReviewItem: (id: number) =>
    open().prepare("DELETE FROM review_items WHERE id = ?").run(id),

  // ===== review_workflow_events =====
  insertReviewEvent: (row: {
    reviewId: string; fromStatus: string | null; toStatus: string;
    actorUserId: string | null; actorName: string | null; note?: string | null;
  }) =>
    open().prepare(`INSERT INTO review_workflow_events
      (review_id, from_status, to_status, actor_user_id, actor_name, note, ts)
      VALUES (?,?,?,?,?,?,?)`).run(
      row.reviewId, row.fromStatus, row.toStatus, row.actorUserId, row.actorName,
      row.note ?? null, new Date().toISOString()
    ),
  eventsByReview: (reviewId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM review_workflow_events WHERE review_id = ? ORDER BY ts").all(reviewId)),
  reminders: () => rowsToCamel(open().prepare("SELECT * FROM reminders").all()),

  /**
   * Atomically replace all auto-generated reminders with `expected`,
   * preserving handled_at for any keys that survive across the run.
   */
  regenerateReminderTx: (input: {
    deleteAll: boolean;
    expected: any[];
    handledByKey: [string, { handledAt: string; handledBy: string | null }][];
    ranBy: string;
  }) => {
    const c = open();
    const handledMap = new Map(input.handledByKey);
    const tx = c.transaction(() => {
      if (input.deleteAll) {
        c.prepare("DELETE FROM reminders WHERE auto_generated = 1").run();
      }
      const ins = c.prepare(`INSERT INTO reminders
        (id, category, severity, title, detail, trigger_date, school_id,
         dedup_key, auto_generated, target_type, target_id, generated_at,
         handled_at, handled_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const now = new Date().toISOString();
      let preserved = 0;
      for (const r of input.expected) {
        const id = `auto_${randomId()}`;
        const handled = handledMap.get(r.dedupKey);
        if (handled) preserved++;
        ins.run(
          id, r.category, r.severity, r.title, r.detail, r.triggerDate, r.schoolId,
          r.dedupKey, 1, r.targetType, r.targetId, now,
          handled?.handledAt ?? null, handled?.handledBy ?? null
        );
      }
      return { preserved };
    });
    return tx();
  },

  recordReminderGeneratorRun: (row: { ranBy: string; generatedCount: number; removedCount: number; durationMs: number }) =>
    open().prepare(
      `INSERT INTO reminder_generator_runs (ran_at, ran_by, generated_count, removed_count, duration_ms) VALUES (?,?,?,?,?)`
    ).run(new Date().toISOString(), row.ranBy, row.generatedCount, row.removedCount, row.durationMs),

  latestReminderGeneratorRun: () => {
    const r = open().prepare("SELECT * FROM reminder_generator_runs ORDER BY id DESC LIMIT 1").get();
    return r ? rowToCamel<any>(r) : null;
  },

  markReminderHandled: (id: string, userLogin: string | null) =>
    open()
      .prepare("UPDATE reminders SET handled_at = ?, handled_by = ? WHERE id = ?")
      .run(new Date().toISOString(), userLogin, id),
  unmarkReminderHandled: (id: string) =>
    open()
      .prepare("UPDATE reminders SET handled_at = NULL, handled_by = NULL WHERE id = ?")
      .run(id),
  reminder: (id: string) => {
    const r = open().prepare("SELECT * FROM reminders WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },

  // users / auth
  userByLogin: (loginId: string) => {
    const r = open().prepare("SELECT * FROM users WHERE login_id = ?").get(loginId);
    return r ? rowToCamel<any>(r) : null;
  },
  userById: (id: string) => {
    const r = open().prepare("SELECT * FROM users WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  userByEmail: (email: string) => {
    const r = open().prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(email);
    return r ? rowToCamel<any>(r) : null;
  },
  rolesByUserId: (userId: string) =>
    rowsToCamel<any>(open().prepare("SELECT role, scope_type, scope_id FROM user_roles WHERE user_id = ?").all(userId)),
  allUsers: () => rowsToCamel(open().prepare("SELECT id, login_id, email, name, employee_id, totp_enabled_at FROM users").all()),

  // 2FA / TOTP
  setUserTotp: (userId: string, secret: string | null) =>
    open()
      .prepare(`UPDATE users SET totp_secret = ?, totp_enabled_at = ? WHERE id = ?`)
      .run(secret, secret ? new Date().toISOString() : null, userId),

  // writes
  updateCandidateStage: (id: string, stage: string) =>
    open().prepare("UPDATE candidates SET stage = ? WHERE id = ?").run(stage, id),
  insertOnboardingCase: (row: any) =>
    open().prepare(`INSERT INTO onboarding_cases
      (id, candidate_name, flag, school_id, position, route, expected_join_date, status)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      row.id, row.candidateName, row.flag, row.schoolId, row.position,
      row.route, row.expectedJoinDate, row.status
    ),
  insertOnboardingDocument: (row: any) =>
    open().prepare(`INSERT INTO onboarding_documents
      (case_id, doc_code, doc_name, required, status, reject_reason, ord)
      VALUES (?,?,?,?,?,?,?)`).run(
      row.caseId, row.docCode, row.docName, row.required ? 1 : 0,
      row.status, row.rejectReason ?? null, row.ord
    ),
  onboardingCaseExistsForCandidate: (candidateName: string, schoolId: string) => {
    const r: any = open().prepare(
      "SELECT id FROM onboarding_cases WHERE candidate_name = ? AND school_id = ?"
    ).get(candidateName, schoolId);
    return !!r;
  },
  updateDocStatus: (caseId: string, docCode: string, status: string, rejectReason?: string | null) =>
    open()
      .prepare(
        "UPDATE onboarding_documents SET status = ?, reject_reason = ? WHERE case_id = ? AND doc_code = ?"
      )
      .run(status, rejectReason ?? null, caseId, docCode),

  // audit (hash-chained, append-only)
  insertAudit: (row: {
    ts: string; userId: string | null; userLogin: string | null;
    action: string; resourceType: string | null; resourceId: string | null;
    before: string | null; after: string | null;
    ip: string | null; ua: string | null; reason: string | null;
  }) => {
    const c = open();
    const tx = c.transaction((r: any) => {
      const last: any = c.prepare("SELECT row_hash FROM audit_logs ORDER BY id DESC LIMIT 1").get();
      const prevHash = last?.row_hash || GENESIS_HASH;
      const canonical = JSON.stringify({
        ts: r.ts, userId: r.userId, userLogin: r.userLogin, action: r.action,
        resourceType: r.resourceType, resourceId: r.resourceId,
        before: r.before, after: r.after, ip: r.ip, ua: r.ua, reason: r.reason,
        prev: prevHash,
      });
      const rowHash = sha256Hex(canonical);
      c.prepare(`INSERT INTO audit_logs
        (ts,user_id,user_login,action,resource_type,resource_id,before_value,after_value,ip,user_agent,reason,prev_hash,row_hash)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        r.ts, r.userId, r.userLogin, r.action, r.resourceType, r.resourceId,
        r.before, r.after, r.ip, r.ua, r.reason, prevHash, rowHash
      );
    });
    tx(row);
  },
  recentAudits: (limit = 20) =>
    rowsToCamel(open().prepare("SELECT * FROM audit_logs ORDER BY ts DESC LIMIT ?").all(limit)),
  auditCountSince: (sinceISO: string) => {
    const r: any = open().prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE ts >= ?").get(sinceISO);
    return r?.n ?? 0;
  },
  auditSearch: (opts: { action?: string; userId?: string; limit?: number }) => {
    const limit = Math.min(opts.limit ?? 200, 500);
    const where: string[] = []; const args: any[] = [];
    if (opts.action) { where.push("action LIKE ?"); args.push(`%${opts.action}%`); }
    if (opts.userId) { where.push("user_id = ?"); args.push(opts.userId); }
    const sql = `SELECT * FROM audit_logs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ts DESC LIMIT ?`;
    return rowsToCamel(open().prepare(sql).all(...args, limit));
  },

  // audit chain verification — walks all rows and recomputes hashes
  verifyAuditChain: () => {
    const c = open();
    const rows: any[] = c.prepare(
      "SELECT id, ts, user_id, user_login, action, resource_type, resource_id, before_value, after_value, ip, user_agent, reason, prev_hash, row_hash FROM audit_logs ORDER BY id ASC"
    ).all();
    let prev = GENESIS_HASH;
    for (const r of rows) {
      const canonical = JSON.stringify({
        ts: r.ts, userId: r.user_id, userLogin: r.user_login, action: r.action,
        resourceType: r.resource_type, resourceId: r.resource_id,
        before: r.before_value, after: r.after_value, ip: r.ip, ua: r.user_agent, reason: r.reason,
        prev,
      });
      const expected = sha256Hex(canonical);
      if (r.prev_hash !== prev) {
        return { ok: false as const, brokenAt: r.id, reason: "prev_hash mismatch" };
      }
      if (r.row_hash !== expected) {
        return { ok: false as const, brokenAt: r.id, reason: "row_hash mismatch" };
      }
      prev = r.row_hash;
    }
    return { ok: true as const, count: rows.length, headHash: prev };
  },

  // rate limit (sliding window aligned to windowSec)
  rateLimitHit: (key: string, windowSec: number) => {
    const c = open();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSec);
    const tx = c.transaction(() => {
      const existing: any = c.prepare(
        "SELECT count FROM rate_limit_buckets WHERE bucket_key = ? AND window_start = ?"
      ).get(key, windowStart);
      if (existing) {
        c.prepare(
          "UPDATE rate_limit_buckets SET count = count + 1 WHERE bucket_key = ? AND window_start = ?"
        ).run(key, windowStart);
        return existing.count + 1;
      } else {
        c.prepare(
          "INSERT INTO rate_limit_buckets (bucket_key, window_start, count) VALUES (?, ?, 1)"
        ).run(key, windowStart);
        return 1;
      }
    });
    return { count: tx() as number, windowStart };
  },
  rateLimitCleanup: (olderThanSec: number) => {
    const cutoff = Math.floor(Date.now() / 1000) - olderThanSec;
    open().prepare("DELETE FROM rate_limit_buckets WHERE window_start < ?").run(cutoff);
  },

  // API usage
  insertApiUsage: (row: {
    ts: string; model: string; feature: string;
    userId: string | null; userLogin: string | null;
    resourceType: string | null; resourceId: string | null;
    inputTokens: number; outputTokens: number;
    cacheCreationTokens: number; cacheReadTokens: number;
    costUsd: number; durationMs: number | null;
    status: string; error: string | null;
  }) => open().prepare(`INSERT INTO api_usage
    (ts, model, feature, user_id, user_login, resource_type, resource_id,
     input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
     cost_usd, duration_ms, status, error)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    row.ts, row.model, row.feature, row.userId, row.userLogin,
    row.resourceType, row.resourceId,
    row.inputTokens, row.outputTokens, row.cacheCreationTokens, row.cacheReadTokens,
    row.costUsd, row.durationMs, row.status, row.error
  ),
  apiUsageSince: (sinceISO: string) =>
    rowsToCamel(open().prepare("SELECT * FROM api_usage WHERE ts >= ? ORDER BY ts DESC").all(sinceISO)),
  apiUsageDailySince: (sinceISO: string) =>
    rowsToCamel(open().prepare(`
      SELECT substr(ts, 1, 10) AS day,
             model,
             SUM(input_tokens) AS input_tokens,
             SUM(output_tokens) AS output_tokens,
             SUM(cache_read_tokens) AS cache_read_tokens,
             SUM(cache_creation_tokens) AS cache_creation_tokens,
             SUM(cost_usd) AS cost_usd,
             COUNT(*) AS calls
      FROM api_usage
      WHERE ts >= ?
      GROUP BY day, model
      ORDER BY day DESC
    `).all(sinceISO)),

  // PII (encrypted)
  setEmployeePii: (employeeId: string, fields: { myNumberEnc?: string | null; bankAccountEnc?: string | null; passportNoEnc?: string | null }) => {
    const sets: string[] = []; const args: any[] = [];
    if (fields.myNumberEnc !== undefined) { sets.push("my_number_enc = ?"); args.push(fields.myNumberEnc); }
    if (fields.bankAccountEnc !== undefined) { sets.push("bank_account_enc = ?"); args.push(fields.bankAccountEnc); }
    if (fields.passportNoEnc !== undefined) { sets.push("passport_no_enc = ?"); args.push(fields.passportNoEnc); }
    if (sets.length === 0) return;
    args.push(employeeId);
    open().prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  },
  getEmployeePiiCiphertext: (employeeId: string) => {
    const r: any = open().prepare(
      "SELECT my_number_enc, bank_account_enc, passport_no_enc FROM employees WHERE id = ?"
    ).get(employeeId);
    return r ? { myNumberEnc: r.my_number_enc, bankAccountEnc: r.bank_account_enc, passportNoEnc: r.passport_no_enc } : null;
  },

  // document files (onboarding)
  insertDocumentFile: (row: {
    caseId: string; docCode: string; storageKey: string; originalName: string;
    contentType: string | null; sizeBytes: number; sha256: string;
    uploadedBy: string | null; iv: string; authTag: string;
  }) =>
    open().prepare(`INSERT INTO document_files
      (case_id, doc_code, storage_key, original_name, content_type, size_bytes, sha256, uploaded_at, uploaded_by, iv, auth_tag)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.caseId, row.docCode, row.storageKey, row.originalName, row.contentType,
      row.sizeBytes, row.sha256, new Date().toISOString(), row.uploadedBy, row.iv, row.authTag
    ),
  documentFilesByCase: (caseId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM document_files WHERE case_id = ? ORDER BY uploaded_at DESC").all(caseId)),
  documentFilesByDoc: (caseId: string, docCode: string) =>
    rowsToCamel(open().prepare("SELECT * FROM document_files WHERE case_id = ? AND doc_code = ? ORDER BY uploaded_at DESC").all(caseId, docCode)),
  documentFile: (id: number) => {
    const r = open().prepare("SELECT * FROM document_files WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },

  // candidate files (resume etc.)
  insertCandidateFile: (row: {
    candidateId: string; storageKey: string; originalName: string;
    contentType: string | null; sizeBytes: number; sha256: string;
    uploadedBy: string | null; iv: string; authTag: string; isResume: boolean;
  }) =>
    open().prepare(`INSERT INTO candidate_files
      (candidate_id, storage_key, original_name, content_type, size_bytes, sha256, uploaded_at, uploaded_by, iv, auth_tag, is_resume)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.candidateId, row.storageKey, row.originalName, row.contentType,
      row.sizeBytes, row.sha256, new Date().toISOString(), row.uploadedBy, row.iv, row.authTag, row.isResume ? 1 : 0
    ),
  candidateFiles: (candidateId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM candidate_files WHERE candidate_id = ? ORDER BY uploaded_at DESC").all(candidateId)),
  candidateLatestResume: (candidateId: string) => {
    const r = open().prepare(
      "SELECT * FROM candidate_files WHERE candidate_id = ? AND is_resume = 1 ORDER BY uploaded_at DESC LIMIT 1"
    ).get(candidateId);
    return r ? rowToCamel<any>(r) : null;
  },

  // candidate AI parsed data
  setCandidateAiParsed: (id: string, data: { status: string; data?: string | null; model?: string | null }) =>
    open().prepare(
      "UPDATE candidates SET ai_parse_status = ?, ai_parsed_data = ?, ai_parse_model = ?, ai_parsed_at = ? WHERE id = ?"
    ).run(data.status, data.data ?? null, data.model ?? null, new Date().toISOString(), id),

  // email logs
  insertEmailLog: (row: any) =>
    open().prepare(`INSERT INTO email_logs (ts, recipients, subject, tag, provider, status, message_id, error)
      VALUES (?,?,?,?,?,?,?,?)`).run(row.ts, row.recipients, row.subject, row.tag, row.provider, row.status, row.message_id, row.error),
  recentEmailLogs: (limit = 50) =>
    rowsToCamel(open().prepare("SELECT * FROM email_logs ORDER BY ts DESC LIMIT ?").all(limit)),
  /** Update an email log row by message_id with bounce/delivery info from a webhook. */
  updateEmailLogStatus: (messageId: string, status: string, error?: string | null) =>
    open()
      .prepare(`UPDATE email_logs SET status = ?, error = ? WHERE message_id = ?`)
      .run(status, error ?? null, messageId),

  // session revocations — used to invalidate JWTs before their natural expiry
  revokeUserSessions: (userId: string, by: string | null, reason?: string) =>
    open()
      .prepare(`INSERT OR REPLACE INTO session_revocations (user_id, revoked_at, revoked_by, reason)
        VALUES (?, ?, ?, ?)`)
      .run(userId, new Date().toISOString(), by, reason ?? null),
  sessionRevokedAt: (userId: string): string | null => {
    const r: any = open().prepare("SELECT revoked_at FROM session_revocations WHERE user_id = ?").get(userId);
    return r?.revoked_at || null;
  },

  // interviews
  insertInterview: (row: any) =>
    open().prepare(`INSERT INTO interviews
      (id, candidate_id, round, scheduled_at, duration_min, format, location, interviewer_names,
       status, result, feedback, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id, row.candidateId, row.round, row.scheduledAt, row.durationMin || 60,
      row.format, row.location ?? null, row.interviewerNames ?? null,
      row.status || "scheduled", row.result ?? null, row.feedback ?? null,
      row.createdBy ?? null, new Date().toISOString(), new Date().toISOString()
    ),
  updateInterview: (id: string, fields: Record<string, any>) => {
    const map: Record<string, string> = {
      scheduledAt: "scheduled_at", durationMin: "duration_min", format: "format",
      location: "location", interviewerNames: "interviewer_names", status: "status",
      result: "result", feedback: "feedback",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, v] of Object.entries(fields)) if (map[k]) { sets.push(`${map[k]} = ?`); args.push(v); }
    if (sets.length === 0) return;
    sets.push("updated_at = ?"); args.push(new Date().toISOString());
    args.push(id);
    open().prepare(`UPDATE interviews SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  },
  interviewsByCandidate: (candidateId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM interviews WHERE candidate_id = ? ORDER BY scheduled_at").all(candidateId)),
  upcomingInterviews: (limit = 50) =>
    rowsToCamel(open().prepare(
      "SELECT * FROM interviews WHERE status = 'scheduled' AND scheduled_at >= ? ORDER BY scheduled_at ASC LIMIT ?"
    ).all(new Date().toISOString(), limit)),
  allInterviews: () => rowsToCamel(open().prepare("SELECT * FROM interviews ORDER BY scheduled_at DESC").all()),

  // employee_assignments
  insertAssignment: (row: any) =>
    open().prepare(`INSERT INTO employee_assignments
      (id, employee_id, school_id, department_id, position, is_primary, assignment_type,
       cost_ratio, manager_employee_id, evaluator_employee_id, start_date, end_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      row.id, row.employeeId, row.schoolId, row.departmentId, row.position,
      row.isPrimary ? 1 : 0, row.assignmentType, row.costRatio,
      row.managerEmployeeId ?? null, row.evaluatorEmployeeId ?? null,
      row.startDate, row.endDate ?? null
    ),
  assignmentsByEmployee: (employeeId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM employee_assignments WHERE employee_id = ? ORDER BY is_primary DESC, start_date").all(employeeId)),
  deleteAssignment: (id: string) =>
    open().prepare("DELETE FROM employee_assignments WHERE id = ? AND is_primary = 0").run(id),

  // app-wide settings (key-value store, see migration 025)
  getAppSetting: (key: string): string | null => {
    const r: any = open().prepare("SELECT value FROM app_settings WHERE setting_key = ?").get(key);
    return r?.value ?? null;
  },
  setAppSetting: (key: string, value: string, updatedBy?: string | null) =>
    open().prepare(`INSERT INTO app_settings (setting_key, value, updated_at, updated_by) VALUES (?,?,?,?)
      ON CONFLICT(setting_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .run(key, value, new Date().toISOString(), updatedBy ?? null),

  // user preferences
  setUserPref: (userId: string, key: string, value: string) =>
    open().prepare(`INSERT INTO user_preferences (user_id, pref_key, value, updated_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id, pref_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
      .run(userId, key, value, new Date().toISOString()),
  getUserPref: (userId: string, key: string) => {
    const r: any = open().prepare("SELECT value FROM user_preferences WHERE user_id = ? AND pref_key = ?").get(userId, key);
    return r?.value || null;
  },

  // user mgmt
  insertUser: (row: { id: string; loginId: string; email: string; name: string; passwordHash: string; employeeId: string | null }) =>
    open().prepare(`INSERT INTO users (id, login_id, email, name, password_hash, employee_id) VALUES (?,?,?,?,?,?)`).run(
      row.id, row.loginId, row.email, row.name, row.passwordHash, row.employeeId
    ),
  updateUserPassword: (userId: string, passwordHash: string) =>
    open().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId),
  deleteUserById: (userId: string) => {
    const c = open();
    const tx = c.transaction(() => {
      c.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
      c.prepare("DELETE FROM users WHERE id = ?").run(userId);
    });
    tx();
  },
  insertUserRole: (row: { userId: string; role: string; scopeType: string; scopeId: string | null }) =>
    open().prepare(`INSERT INTO user_roles (user_id, role, scope_type, scope_id) VALUES (?,?,?,?)`).run(
      row.userId, row.role, row.scopeType, row.scopeId
    ),
  deleteUserRolesByUser: (userId: string) =>
    open().prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId),

  // invite tokens
  insertInviteToken: (row: { jti: string; caseId: string; issuedBy: string | null; issuedAt: string; expiresAt: string }) =>
    open().prepare(`INSERT INTO invite_tokens (jti,case_id,issued_by,issued_at,expires_at) VALUES (?,?,?,?,?)`)
      .run(row.jti, row.caseId, row.issuedBy, row.issuedAt, row.expiresAt),
  inviteTokenByJti: (jti: string) => {
    const r = open().prepare("SELECT * FROM invite_tokens WHERE jti = ?").get(jti);
    return r ? rowToCamel<any>(r) : null;
  },
  touchInviteToken: (jti: string) =>
    open().prepare("UPDATE invite_tokens SET last_used_at = ? WHERE jti = ?").run(new Date().toISOString(), jti),
  revokeInviteToken: (jti: string) =>
    open().prepare("UPDATE invite_tokens SET revoked_at = ? WHERE jti = ?").run(new Date().toISOString(), jti),

  // ===== wage rate types (master) =====
  /** Returns rate types visible at the given scope, broader-scope first.
   * E.g. school s1 sees: group rates + entity rates of its entity + s1's own rates. */
  wageRateTypesFor: (scope: { entity?: string; schoolId?: string }) => {
    const params: any[] = [];
    const clauses: string[] = ["scope_type = 'group'"];
    if (scope.entity) { clauses.push("(scope_type = 'entity' AND scope_id = ?)"); params.push(scope.entity); }
    if (scope.schoolId) { clauses.push("(scope_type = 'school' AND scope_id = ?)"); params.push(scope.schoolId); }
    const where = clauses.join(" OR ");
    return rowsToCamel(
      open().prepare(`SELECT * FROM wage_rate_types WHERE active = 1 AND (${where}) ORDER BY scope_type, sort_order, id`).all(...params)
    );
  },
  allWageRateTypes: () =>
    rowsToCamel(open().prepare("SELECT * FROM wage_rate_types ORDER BY scope_type, sort_order, id").all()),
  wageRateType: (id: number) => {
    const r = open().prepare("SELECT * FROM wage_rate_types WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  insertWageRateType: (row: {
    scopeType: string; scopeId: string | null; code: string; name: string;
    unit?: string; defaultAmount?: number | null; sortOrder?: number; notes?: string | null;
  }) =>
    open().prepare(`INSERT INTO wage_rate_types
      (scope_type, scope_id, code, name, unit, default_amount, sort_order, created_at, notes)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      row.scopeType, row.scopeId, row.code, row.name, row.unit ?? "hour",
      row.defaultAmount ?? null, row.sortOrder ?? 0, new Date().toISOString(), row.notes ?? null
    ),
  updateWageRateType: (id: number, fields: Record<string, any>) => {
    const allowed: Record<string, string> = {
      name: "name", unit: "unit", defaultAmount: "default_amount",
      sortOrder: "sort_order", active: "active", notes: "notes",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed[k]) { sets.push(`${allowed[k]} = ?`); args.push(k === "active" ? (v ? 1 : 0) : v); }
    }
    if (sets.length === 0) return;
    args.push(id);
    open().prepare(`UPDATE wage_rate_types SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  },
  deleteWageRateType: (id: number) => {
    // Refuse if there are existing employee rates referencing this type
    const used: any = open().prepare("SELECT COUNT(*) AS n FROM employee_wage_rates WHERE rate_type_id = ?").get(id);
    if (used.n > 0) throw new Error(`使用中の賃率種別は削除できません (${used.n} 件の社員賃率が参照中)。先に「無効化」してください。`);
    open().prepare("DELETE FROM wage_rate_types WHERE id = ?").run(id);
  },

  // ===== employee wage rates =====
  /** Currently-active rates for an employee (effective_to IS NULL). */
  activeWageRatesFor: (employeeId: string) =>
    rowsToCamel(open().prepare(`
      SELECT r.*, t.code AS type_code, t.name AS type_name, t.unit AS type_unit
      FROM employee_wage_rates r
      JOIN wage_rate_types t ON t.id = r.rate_type_id
      WHERE r.employee_id = ? AND r.effective_to IS NULL
      ORDER BY t.sort_order, t.id
    `).all(employeeId)),
  /** Full history of an employee's rates (active + past). */
  wageRateHistoryFor: (employeeId: string) =>
    rowsToCamel(open().prepare(`
      SELECT r.*, t.name AS type_name, t.unit AS type_unit
      FROM employee_wage_rates r
      JOIN wage_rate_types t ON t.id = r.rate_type_id
      WHERE r.employee_id = ?
      ORDER BY r.effective_from DESC, r.id DESC
    `).all(employeeId)),
  /** Add a new rate. Closes any currently-active rate for the same type by setting its effective_to = new from-date - 1 day. */
  addEmployeeWageRate: (row: {
    employeeId: string; rateTypeId: number; amount: number;
    effectiveFrom: string; notes?: string | null; createdBy?: string | null;
  }) => {
    const c = open();
    const tx = c.transaction(() => {
      // Close any prior active rate for this employee + type
      c.prepare(`UPDATE employee_wage_rates SET effective_to = date(?, '-1 day')
                 WHERE employee_id = ? AND rate_type_id = ? AND effective_to IS NULL`)
        .run(row.effectiveFrom, row.employeeId, row.rateTypeId);
      c.prepare(`INSERT INTO employee_wage_rates
        (employee_id, rate_type_id, amount, effective_from, effective_to, notes, created_at, created_by)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`).run(
        row.employeeId, row.rateTypeId, row.amount, row.effectiveFrom,
        row.notes ?? null, new Date().toISOString(), row.createdBy ?? null
      );
    });
    tx();
  },
  /** End an active rate without replacing (e.g. employee no longer eligible for that wage type). */
  endEmployeeWageRate: (id: number, effectiveTo: string) =>
    open().prepare("UPDATE employee_wage_rates SET effective_to = ? WHERE id = ? AND effective_to IS NULL")
      .run(effectiveTo, id),

  // ===== courses =====
  insertCourse: (row: { id: string; schoolId: string; code: string; name: string; level?: string | null; defaultMinutes?: number }) =>
    open().prepare(`INSERT INTO courses (id, school_id, code, name, level, default_minutes, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)`).run(
      row.id, row.schoolId, row.code, row.name, row.level ?? null, row.defaultMinutes ?? 60, new Date().toISOString()
    ),
  coursesBySchool: (schoolId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM courses WHERE school_id = ? AND active = 1 ORDER BY code").all(schoolId)),
  course: (id: string) => {
    const r = open().prepare("SELECT * FROM courses WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },

  // ===== shift_patterns =====
  insertShiftPattern: (row: any) =>
    open().prepare(`INSERT INTO shift_patterns
      (employee_id, school_id, course_id, rate_type_id, day_of_week, start_time, end_time,
       effective_from, effective_to, notes, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      row.employeeId, row.schoolId, row.courseId ?? null, row.rateTypeId,
      row.dayOfWeek, row.startTime, row.endTime,
      row.effectiveFrom, row.effectiveTo ?? null, row.notes ?? null,
      new Date().toISOString(), row.createdBy ?? null
    ),
  patternsByEmployee: (employeeId: string, includeInactive = false) =>
    rowsToCamel(open().prepare(`SELECT * FROM shift_patterns WHERE employee_id = ?
      ${includeInactive ? "" : "AND effective_to IS NULL"} ORDER BY day_of_week, start_time`).all(employeeId)),
  patternsBySchool: (schoolId: string) =>
    rowsToCamel(open().prepare("SELECT * FROM shift_patterns WHERE school_id = ? AND effective_to IS NULL ORDER BY employee_id, day_of_week, start_time").all(schoolId)),
  shiftPatternById: (id: number) => {
    const r = open().prepare("SELECT * FROM shift_patterns WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  endShiftPattern: (id: number, effectiveTo: string) =>
    open().prepare("UPDATE shift_patterns SET effective_to = ? WHERE id = ? AND effective_to IS NULL")
      .run(effectiveTo, id),
  deleteShiftPattern: (id: number) =>
    open().prepare("DELETE FROM shift_patterns WHERE id = ?").run(id),

  // ===== shift_assignments =====
  insertShiftAssignment: (row: any) => {
    const now = new Date().toISOString();
    open().prepare(`INSERT INTO shift_assignments
      (employee_id, school_id, course_id, rate_type_id, rate_amount_snapshot, rate_unit,
       date, start_time, end_time, hours, classes, status, pattern_id,
       substitute_employee_id, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      row.employeeId, row.schoolId, row.courseId ?? null, row.rateTypeId,
      row.rateAmountSnapshot, row.rateUnit,
      row.date, row.startTime, row.endTime, row.hours, row.classes ?? 1,
      row.status ?? "planned", row.patternId ?? null,
      row.substituteEmployeeId ?? null, row.notes ?? null, now, now
    );
  },
  shiftsByEmployeeMonth: (employeeId: string, yearMonth: string) =>
    rowsToCamel(open().prepare(`SELECT * FROM shift_assignments
      WHERE employee_id = ? AND substr(date, 1, 7) = ? ORDER BY date, start_time`).all(employeeId, yearMonth)),
  shiftsBySchoolMonth: (schoolId: string, yearMonth: string) =>
    rowsToCamel(open().prepare(`SELECT * FROM shift_assignments
      WHERE school_id = ? AND substr(date, 1, 7) = ? ORDER BY date, start_time`).all(schoolId, yearMonth)),
  /** All shifts in a given month across all schools — used by payroll commute computation. */
  allShiftsInMonth: (yearMonth: string) =>
    rowsToCamel(open().prepare(`SELECT * FROM shift_assignments
      WHERE substr(date, 1, 7) = ? ORDER BY date, start_time`).all(yearMonth)),
  shiftAssignmentById: (id: number) => {
    const r = open().prepare("SELECT * FROM shift_assignments WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  updateShiftAssignment: (id: number, fields: Record<string, any>) => {
    const allowed: Record<string, string> = {
      date: "date", startTime: "start_time", endTime: "end_time",
      hours: "hours", classes: "classes", status: "status",
      substituteEmployeeId: "substitute_employee_id", notes: "notes",
      payrollPeriodId: "payroll_period_id",
    };
    const sets: string[] = []; const args: any[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed[k]) { sets.push(`${allowed[k]} = ?`); args.push(v); }
    }
    if (sets.length === 0) return;
    sets.push("updated_at = ?"); args.push(new Date().toISOString());
    args.push(id);
    open().prepare(`UPDATE shift_assignments SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  },
  deleteShiftAssignment: (id: number) =>
    open().prepare("DELETE FROM shift_assignments WHERE id = ?").run(id),

  /** Aggregate shifts for a month into per-(employee, rate_type) totals. */
  aggregateShiftsForPeriod: (yearMonth: string) =>
    rowsToCamel(open().prepare(`
      SELECT
        employee_id,
        rate_type_id,
        rate_amount_snapshot,
        rate_unit,
        SUM(hours) AS hours,
        SUM(classes) AS classes,
        COUNT(*) AS shift_count,
        SUM(CASE
          WHEN rate_unit = 'hour' THEN hours * rate_amount_snapshot
          WHEN rate_unit = 'class' THEN classes * rate_amount_snapshot
          WHEN rate_unit = 'day' THEN rate_amount_snapshot
          WHEN rate_unit = 'fixed' THEN rate_amount_snapshot
          ELSE 0
        END) AS amount
      FROM shift_assignments
      WHERE substr(date, 1, 7) = ?
        AND status IN ('confirmed', 'completed')
      GROUP BY employee_id, rate_type_id, rate_amount_snapshot, rate_unit
      ORDER BY employee_id, rate_type_id
    `).all(yearMonth)),

  // ===== payroll =====
  insertPayrollPeriod: (row: { yearMonth: string; notes?: string }) => {
    const r = open().prepare(`INSERT INTO payroll_periods (year_month, status, created_at, notes)
      VALUES (?, 'open', ?, ?)`).run(row.yearMonth, new Date().toISOString(), row.notes ?? null);
    return Number(r.lastInsertRowid);
  },
  payrollPeriodByYearMonth: (yearMonth: string) => {
    const r = open().prepare("SELECT * FROM payroll_periods WHERE year_month = ?").get(yearMonth);
    return r ? rowToCamel<any>(r) : null;
  },
  payrollPeriodById: (id: number) => {
    const r = open().prepare("SELECT * FROM payroll_periods WHERE id = ?").get(id);
    return r ? rowToCamel<any>(r) : null;
  },
  allPayrollPeriods: (limit = 24) =>
    rowsToCamel(open().prepare("SELECT * FROM payroll_periods ORDER BY year_month DESC LIMIT ?").all(limit)),
  insertPayrollLine: (row: any) =>
    open().prepare(`INSERT INTO payroll_lines
      (period_id, employee_id, rate_type_id, rate_amount_snapshot, rate_unit,
       hours, classes, amount, shift_count, notes, created_at, kind, taxable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      row.periodId, row.employeeId, row.rateTypeId, row.rateAmountSnapshot, row.rateUnit,
      row.hours, row.classes, row.amount, row.shiftCount, row.notes ?? null, new Date().toISOString(),
      row.kind ?? "wage", row.taxable ?? 1
    ),
  linesByPeriod: (periodId: number) =>
    rowsToCamel(open().prepare(`
      SELECT pl.*, e.name AS employee_name, e.emp_no AS employee_no, e.employment_type AS employment_type,
             COALESCE(wrt.name,
               CASE pl.kind WHEN 'commute' THEN '通勤手当' WHEN 'bonus' THEN '賞与' WHEN 'allowance' THEN '手当' ELSE pl.kind END
             ) AS rate_type_name
      FROM payroll_lines pl
      JOIN employees e ON e.id = pl.employee_id
      LEFT JOIN wage_rate_types wrt ON wrt.id = pl.rate_type_id
      WHERE pl.period_id = ?
      ORDER BY e.emp_no, pl.kind, COALESCE(wrt.sort_order, 999), pl.id
    `).all(periodId)),
  clearPayrollLines: (periodId: number) => {
    const c = open();
    const tx = c.transaction(() => {
      c.prepare("UPDATE shift_assignments SET payroll_period_id = NULL WHERE payroll_period_id = ?").run(periodId);
      c.prepare("DELETE FROM payroll_lines WHERE period_id = ?").run(periodId);
    });
    tx();
  },
  lockPayrollPeriod: (id: number, by: string, totalAmount: number, totalEmployees: number) =>
    open().prepare(`UPDATE payroll_periods SET status = 'locked', locked_at = ?, locked_by = ?,
      total_amount = ?, total_employees = ? WHERE id = ?`).run(
      new Date().toISOString(), by, totalAmount, totalEmployees, id
    ),
  markPayrollExported: (id: number, by: string) =>
    open().prepare("UPDATE payroll_periods SET status = 'exported', exported_at = ?, exported_by = ? WHERE id = ?")
      .run(new Date().toISOString(), by, id),

  // ===== teacher portal invite (extended invite_tokens) =====
  insertTeacherPortalInvite: (row: { jti: string; employeeId: string; issuedBy: string | null; issuedAt: string; expiresAt: string }) =>
    open().prepare(`INSERT INTO invite_tokens
      (jti, case_id, kind, employee_id, issued_by, issued_at, expires_at)
      VALUES (?, '', 'teacher_portal', ?, ?, ?, ?)`).run(
      row.jti, row.employeeId, row.issuedBy, row.issuedAt, row.expiresAt
    ),
};

function withDocs(c: any) {
  const docs = rowsToCamel<any>(
    open().prepare("SELECT * FROM onboarding_documents WHERE case_id = ? ORDER BY ord").all(c.id)
  ).map((d) => ({ ...d, required: !!d.required, name: d.docName, code: d.docCode }));
  const completed = docs.filter((d) => d.status === "完了").length;
  const progress = Math.round((completed / docs.length) * 100);
  return { ...c, docs, progress };
}

function coerceBool(e: any) {
  return { ...e, isPrimary: !!e.isPrimary };
}
