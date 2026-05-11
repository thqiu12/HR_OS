import { describe, it, expect } from "vitest";
import { extractFieldsFromText } from "../lib/resume-parser-local";

const SAMPLE_TEXT = `
履歴書

ふりがな
たなか はなこ

氏名
田中 花子

生年月日 1995年4月12日
住所 〒150-0001 東京都渋谷区神宮前1-2-3
電話 080-1234-5678
メール tanaka.hanako@example.com

国籍 日本

学歴
2014年4月 東京大学 文学部 入学
2018年3月 東京大学 文学部 卒業

職歴
2018年4月 株式会社サクラ教育 入社
2022年3月 株式会社サクラ教育 退職
2022年4月 学校法人ABC日本語学校 入社

資格
JLPT N1 取得
TOEIC 850点

スキル
教材作成、クラス運営、Excel、PowerPoint

経験 7年

自己PR
日本語教育に携わって 7年、N1合格率 65% を達成しました。
担任クラスの学生満足度 4.5/5 を維持。
`;

describe("local resume parser", () => {
  it("extracts the basic identity block", () => {
    const r = extractFieldsFromText(SAMPLE_TEXT);
    expect(r.full_name).toBe("田中 花子");
    expect(r.kana).toContain("たなか");
    expect(r.email).toBe("tanaka.hanako@example.com");
    expect(r.phone).toBe("080-1234-5678");
    expect(r.birthday).toBe("1995-04-12");
    expect(r.nationality).toBe("日本");
    expect(r.address).toContain("東京都渋谷区");
  });

  it("detects JLPT level", () => {
    const r = extractFieldsFromText(SAMPLE_TEXT);
    expect(r.jlpt_level).toBe("N1");
    expect(r.qualifications.find((q) => q.name.includes("JLPT") || q.name === "N1")).toBeTruthy();
  });

  it("extracts education entries", () => {
    const r = extractFieldsFromText(SAMPLE_TEXT);
    expect(r.education.length).toBeGreaterThan(0);
    expect(r.education[0].school).toContain("東京大学");
  });

  it("extracts work history (株式会社 / 学校法人 markers)", () => {
    const r = extractFieldsFromText(SAMPLE_TEXT);
    expect(r.career.length).toBeGreaterThanOrEqual(2);
    const companies = r.career.map((w) => w.company);
    expect(companies.some((c) => c.includes("サクラ教育"))).toBe(true);
    expect(companies.some((c) => c.includes("ABC日本語学校"))).toBe(true);
  });

  it("captures skills/qualifications as separated keywords", () => {
    const r = extractFieldsFromText(SAMPLE_TEXT);
    expect(r.qualifications.length).toBeGreaterThanOrEqual(2);
    expect(r.qualifications.map((q) => q.name)).toContain("Excel");
  });

  it("captures self-PR text in summary", () => {
    const r = extractFieldsFromText(SAMPLE_TEXT);
    expect(r.summary).toContain("日本語教育");
  });

  it("does not crash on empty / minimal input", () => {
    const r = extractFieldsFromText("");
    expect(r.full_name).toContain("抽出できませんでした");
    expect(r.email).toBeNull();
    expect(r.phone).toBeNull();
  });

  it("falls back gracefully when fields missing", () => {
    const r = extractFieldsFromText("田中 太郎\nメール: taro@example.com");
    expect(r.full_name).toBe("田中 太郎");
    expect(r.email).toBe("taro@example.com");
    expect(r.phone).toBeNull();
    expect(r.birthday).toBeNull();
  });

  it("recognizes Chinese / Vietnamese / Nepalese nationalities", () => {
    expect(extractFieldsFromText("国籍 中国\n陳 美玲").nationality).toBe("中国");
    expect(extractFieldsFromText("国籍 ベトナム\nNguyen").nationality).toBe("ベトナム");
    expect(extractFieldsFromText("国籍 ネパール").nationality).toBe("ネパール");
  });
});
