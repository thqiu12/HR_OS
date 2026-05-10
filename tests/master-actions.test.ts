import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

describe("master CRUD direct DB layer", () => {
  it("creates a department, lists it, deletes it, and rejects delete when occupied", () => {
    db.insertDepartment({ id: "test_dept_1", schoolId: "s1", name: "テスト部" });
    const all = db.departments() as any[];
    expect(all.find((d) => d.id === "test_dept_1")?.name).toBe("テスト部");

    // Rename
    db.updateDepartment("test_dept_1", "テスト部（改名）");
    expect((db.departments() as any[]).find((d) => d.id === "test_dept_1")?.name).toBe("テスト部（改名）");

    // Add an employee to it
    db.insertEmployee({
      id: "test_emp_1", empNo: "T0001", name: "テスト 太郎", kana: "テスト タロウ", romaji: "Test Taro",
      nationality: "日本", flag: "🇯🇵", email: "test@x.jp",
      schoolId: "s1", departmentId: "test_dept_1", position: "テスト",
      hireRoute: "新卒", hireDate: "2026-04-01", probationEnd: "2026-09-30",
      status: "試用期間", isPrimary: true, costRatio: 100, assignmentType: "所属",
    });

    // Delete should now fail because of the employee
    expect(() => db.deleteDepartment("test_dept_1")).toThrow(/所属しているため削除できません/);

    // Reassign employee, then delete should succeed
    db.updateEmployee("test_emp_1", { departmentId: "d1" });
    expect(() => db.deleteDepartment("test_dept_1")).not.toThrow();
    expect((db.departments() as any[]).find((d) => d.id === "test_dept_1")).toBeUndefined();
  });

  it("creates a job", () => {
    db.insertJob({
      id: "test_job_1", title: "テスト求人", schoolId: "s1", departmentId: "d1",
      route: "中途", status: "公開中", openCount: 3, postedAt: "2026-05-10",
    });
    const found = (db.jobs() as any[]).find((j) => j.id === "test_job_1");
    expect(found?.title).toBe("テスト求人");
  });

  it("creates an employee with all required fields", () => {
    db.insertEmployee({
      id: "test_emp_2", empNo: "T0002", name: "新規 二郎", kana: "シンキ ジロウ", romaji: "Shinki Jiro",
      nationality: "日本", flag: "🇯🇵", email: "j@x.jp",
      schoolId: "s4", departmentId: "d8", position: "事務スタッフ",
      hireRoute: "中途", hireDate: "2026-05-10", probationEnd: "2026-11-09",
      status: "試用期間", isPrimary: true, costRatio: 100, assignmentType: "所属",
    });
    const e: any = db.employee("test_emp_2");
    expect(e.name).toBe("新規 二郎");
    expect(e.status).toBe("試用期間");
  });
});
