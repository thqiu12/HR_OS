/**
 * Local (zero-cost) resume parser.
 *
 * Extracts plain text from PDF via pdf-parse, then applies Japanese-resume
 * heuristics (regex + 履歴書 / 職務経歴書 templates) to pull out structured
 * fields. No external API call → ¥0 marginal cost.
 *
 * Trade-off: ~70-90% field accuracy on digital PDFs; near 0 on scanned image
 * PDFs (those need OCR — see Tesseract option in docs). The UI lets the user
 * review and correct extracted fields before saving, so missing/wrong values
 * are caught.
 *
 * Same output shape as `lib/anthropic.ts` ParsedResume so existing UI and
 * storage code work unchanged.
 */

import type { ParsedResume } from "./anthropic";

// pdfjs-dist (legacy build) — safe in Node without DOM polyfills.
// Lazy-loaded so server bundle stays small for routes that don't parse PDFs.
let pdfjs: any = null;
async function getPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Point workerSrc to the worker file. Use createRequire so this works under
  // both CJS and ESM modules in Next.js server context.
  if (pdfjs.GlobalWorkerOptions) {
    try {
      const { createRequire } = await import("module");
      const req = createRequire(import.meta.url || `file://${__filename}`);
      pdfjs.GlobalWorkerOptions.workerSrc = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    } catch (e) {
      console.warn("[resume-parser] failed to resolve pdfjs worker:", (e as Error).message);
    }
  }
  return pdfjs;
}

import { buildLayout, valueAfterLabel, findSectionRanges, rangeText, type LayoutDoc } from "./resume-layout";

async function pdfBufferToLayoutDocs(pdf: Buffer): Promise<LayoutDoc[]> {
  const lib = await getPdfjs();
  const data = new Uint8Array(pdf);
  let standardFontDataUrl: string | undefined;
  try {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url || `file://${__filename}`);
    const path = await import("path");
    standardFontDataUrl = path.dirname(req.resolve("pdfjs-dist/standard_fonts/FoxitFixed.pfb")) + "/";
  } catch {}
  const doc = await lib.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl,
    verbosity: 0,
  }).promise;
  const docs: LayoutDoc[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    docs.push(buildLayout(tc, { width: viewport.width, height: viewport.height }));
  }
  await doc.destroy();
  return docs;
}

/** Backward-compat: flatten layout into plain text. */
function flattenLayout(docs: LayoutDoc[]): string {
  return docs.map((d) => d.rows.map((r) => r.text).join("\n")).join("\n\n");
}

export type LocalParseResult =
  | { ok: true; data: ParsedResume; rawText: string; coverage: number }
  | { ok: false; reason: "pdf_error" | "empty_text"; message: string };

const NATIONALITIES = ["日本", "中国", "ベトナム", "ネパール", "韓国", "台湾", "香港", "ミャンマー", "インドネシア", "フィリピン", "タイ", "モンゴル", "アメリカ", "イギリス"];
const FLAGS: Record<string, string> = {
  "日本": "🇯🇵", "中国": "🇨🇳", "ベトナム": "🇻🇳", "ネパール": "🇳🇵",
  "韓国": "🇰🇷", "台湾": "🇹🇼", "香港": "🇭🇰", "ミャンマー": "🇲🇲",
  "インドネシア": "🇮🇩", "フィリピン": "🇵🇭", "タイ": "🇹🇭",
  "モンゴル": "🇲🇳", "アメリカ": "🇺🇸", "イギリス": "🇬🇧",
};
const JLPT_LEVELS = ["N1", "N2", "N3", "N4", "N5"];

export async function parseResumeLocal(pdf: Buffer): Promise<LocalParseResult> {
  let docs: LayoutDoc[];
  try {
    docs = await pdfBufferToLayoutDocs(pdf);
  } catch (e: any) {
    return { ok: false, reason: "pdf_error", message: e?.message || "PDF読み取りエラー" };
  }
  const text = flattenLayout(docs);
  if (!text.trim()) {
    return { ok: false, reason: "empty_text", message: "テキストを抽出できません (画像PDFの可能性。OCRが必要)" };
  }

  // Layout-aware extraction (uses x/y positions) gives priority,
  // falls back to flat-text regex for missing fields.
  const layoutData = extractFieldsFromLayout(docs);
  const flatData = extractFieldsFromText(text);
  const data = mergeResults(layoutData, flatData);
  const coverage = scoreCoverage(data);
  return { ok: true, data, rawText: text, coverage };
}

/**
 * Extract fields using positional information (label → value to the right of it).
 * Much more reliable than flat-text regex for 2-column 履歴書 templates.
 */
export function extractFieldsFromLayout(docs: LayoutDoc[]): Partial<ParsedResume> {
  const first = docs[0];
  if (!first) return {};

  const result: any = {};

  // Name + furigana — strip the label prefix if it leaked into the value
  const cleanName = (s: string | null) => {
    if (!s) return null;
    let v = s.replace(/^(?:氏\s*名|名\s*前|お名前|ふりがな|フリガナ|性別|生年月日)[:：\s]*/g, "").trim();
    // Cut at trailing labels that may have crept in from a 2-col layout
    v = v.split(/\s+(?:性別|男|女|生年月日|印)\s*$/)[0].trim();
    v = v.replace(/\s+(?:性別|生年月日|電話|メール|住所).*$/, "").trim();
    return v || null;
  };
  result.full_name = cleanName(valueAfterLabel(first, [/^(?:氏\s*名|名\s*前|お名前)/]));
  result.kana = cleanName(valueAfterLabel(first, [/^(?:ふりがな|フリガナ|フリ\s*ガナ)/]));

  // Email — scan all text and strip common label prefixes that may have merged
  // ("mail", "E-mail", "メール") from the matched email.
  const stripEmailPrefix = (e: string): string => {
    return e.replace(/^(?:e[-]?)?mail|^メール(?:アドレス)?|^電子メール/i, "").replace(/^[\W_]+/, "");
  };
  const allEmails = Array.from(
    flattenLayout(docs).matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
  ).map((m) => stripEmailPrefix(m[0])).filter((e) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e));
  if (allEmails.length > 0) result.email = allEmails[0];

  // Phone — scan all text (compact whitespace) for a valid Japanese number
  const compactAll = flattenLayout(docs).replace(/\s+/g, "");
  const phoneMatch = compactAll.match(/(?:0[789]0|0\d{1,3})[-]?\d{2,4}[-]?\d{3,4}/);
  if (phoneMatch) result.phone = phoneMatch[0];

  // Birthday — search the row containing 生年月日 then concat tokens
  // Also strip whitespace within numbers ("1 993" → "1993") which pdfjs splits.
  let birthRaw = valueAfterLabel(first, [/(?:生年月日|誕生日|Date\s*of\s*Birth)/i]) || "";
  // Compact number-like sequences: "1993 年 4 月 3 日" but also "1\t993" etc.
  const birthCompact = birthRaw.replace(/(\d)\s+(\d)/g, "$1$2");
  const sources = [birthCompact, flattenLayout(docs).replace(/(\d)\s+(\d)/g, "$1$2")];
  for (const src of sources) {
    // Reject the document-creation date often shown in header (current year)
    const matches = Array.from(src.matchAll(/((?:19|20)\d{2})\s*[\/\-年]\s*(\d{1,2})\s*[\/\-月]\s*(\d{1,2})\s*日?/g));
    for (const m of matches) {
      const year = Number(m[1]);
      // Plausibility: birth year between 1940 and 18 years ago
      const thisYear = new Date().getFullYear();
      if (year >= 1940 && year <= thisYear - 14) {
        result.birthday = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
        break;
      }
    }
    if (result.birthday) break;
    const era = src.match(/(平成|令和|昭和)\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (era) {
      const offsets: any = { 昭和: 1925, 平成: 1988, 令和: 2018 };
      const y = offsets[era[1]] + Number(era[2]);
      result.birthday = `${y}-${era[3].padStart(2, "0")}-${era[4].padStart(2, "0")}`;
      break;
    }
  }

  // Address — combine the label-value row + next 1-2 rows (address often wraps)
  const addrFirstRow = valueAfterLabel(first, [/^(?:住\s*所|現住所)/]);
  if (addrFirstRow) {
    // Concatenate following rows until we hit something that looks like a new field
    const labelIdx = first.rows.findIndex((r) => /^(?:住\s*所|現住所)/.test(r.text));
    let addr = addrFirstRow;
    if (labelIdx >= 0) {
      for (let j = labelIdx + 1; j < Math.min(labelIdx + 3, first.rows.length); j++) {
        const nxt = first.rows[j].text;
        if (/^(?:電話|TEL|メール|E-?mail|連絡先|生年月日|国籍|学|職|資格|自己)/.test(nxt)) break;
        if (/[都道府県市区町村]|\d{3,}/.test(nxt) && nxt.length < 80) addr += " " + nxt;
      }
    }
    result.address = addr.replace(/\s+/g, " ").trim();
  }

  // Nationality — only trust explicit "国籍" labelling, not bare "日本" appearing
  // in addresses or "中国東南大学" appearing in education
  const natRaw = valueAfterLabel(first, [/^(?:国\s*籍|国籍|nationality)/i]);
  if (natRaw) {
    // Strip 県/都/府/道 to avoid false positives
    const stripped = natRaw.replace(/[一-龯]+(?:都|道|府|県|市|区|町|村)/g, "");
    for (const n of NATIONALITIES) if (stripped.includes(n)) { result.nationality = n; break; }
  }

  // Sections
  const sections = findSectionRanges(first, ["学　歴", "学歴", "職　歴", "職歴", "資格", "免許", "免許・資格", "自己PR", "自己アピール", "志望動機"]);
  const eduRange = sections.get("学歴") || sections.get("学　歴");
  const careerRange = sections.get("職歴") || sections.get("職　歴");
  const qualRange = sections.get("資格") || sections.get("免許") || sections.get("免許・資格");
  const prRange = sections.get("自己PR") || sections.get("自己アピール") || sections.get("志望動機");

  if (eduRange) {
    const text = rangeText(first, eduRange);
    const matches = Array.from(text.matchAll(/([一-龯々ァ-ヶーA-Za-z]+(?:大学院?|専門学校|高校|高等学校|学校))/g)).slice(0, 8);
    result.education = matches.map((m) => ({
      school: m[1], degree: null, field: null, period_from: null, period_to: null,
    }));
  }

  if (careerRange) {
    const text = rangeText(first, careerRange);
    const matches = Array.from(text.matchAll(/((?:株式会社|有限会社|合同会社|学校法人|独立行政法人|社会福祉法人)\s?[一-龯々ァ-ヶーA-Za-z0-9]+)/g)).slice(0, 8);
    result.career = matches.map((m) => ({
      company: m[1].trim(), position: null, period_from: null, period_to: null, description: null,
    }));
  }

  if (qualRange) {
    const text = rangeText(first, qualRange);
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length >= 2 && l.length <= 60);
    result.qualifications = lines.slice(0, 10).map((name) => ({ name, acquired_date: null }));
  }

  if (prRange) {
    result.summary = rangeText(first, prRange).trim().slice(0, 500);
  }

  // Detect JLPT anywhere
  for (const lv of ["N1", "N2", "N3", "N4", "N5"]) {
    if (new RegExp(`\\b${lv}\\b`).test(flattenLayout(docs))) {
      result.jlpt_level = lv;
      break;
    }
  }

  return result;
}

/** Combine layout-aware result (preferred) with flat-text fallback. */
function mergeResults(primary: Partial<ParsedResume>, fallback: ParsedResume): ParsedResume {
  const out: any = { ...fallback };
  for (const k of Object.keys(primary)) {
    const v = (primary as any)[k];
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = v;
  }
  return out;
}

/** Apply Japanese 履歴書 heuristics to extract structured fields. */
export function extractFieldsFromText(text: string): ParsedResume {
  const norm = normalize(text);

  // Email — most reliable
  const emailMatch = norm.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch?.[0] || null;

  // Phone — Japanese mobile / landline patterns
  const phoneMatch = norm.match(/(?:0[789]0|0\d{1,3})[-(\s]?\d{2,4}[-)\s]?\d{3,4}/);
  const phone = phoneMatch?.[0]?.replace(/\s/g, "") || null;

  // Name — try common patterns
  // 1) line containing 「氏名」 then next non-empty token
  // 2) 「ふりがな」直下行
  // 3) first non-empty line of doc (often the title page name)
  let fullName: string | null = null;
  let kana: string | null = null;
  const lines = norm.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/(氏名|名前|お名前|ふりがな|フリガナ)\s*[:：]?\s*$/.test(l) && lines[i + 1]) {
      const next = lines[i + 1].replace(/\s+/g, " ").trim();
      if (/[ぁ-んァ-ンー]+\s+[ぁ-んァ-ンー]+/.test(next)) kana = kana || next;
      else if (/[一-龯々ヵヶ]+/.test(next) && next.length < 30) fullName = fullName || next;
      continue;
    }
    const inline = l.match(/^(?:氏名|名前|お名前)\s*[:：]\s*(.+)$/);
    if (inline) { fullName = fullName || inline[1].trim(); continue; }
    const inlineKana = l.match(/^(?:ふりがな|フリガナ)\s*[:：]\s*(.+)$/);
    if (inlineKana) { kana = kana || inlineKana[1].trim(); continue; }
  }
  // Fallback: first plausible name line if none found
  if (!fullName) {
    for (const l of lines.slice(0, 8)) {
      if (/^[一-龯々ヵヶ]{1,4}\s*[一-龯々ヵヶ]{1,6}$/.test(l)) { fullName = l.replace(/\s+/g, " "); break; }
    }
  }

  // Birth + age — 生年月日 / 西暦
  let birthDate: string | null = null;
  let age: number | null = null;
  const bm = norm.match(/(?:生年月日|誕生日)[\s:：]*((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (bm) {
    birthDate = `${bm[1]}-${bm[2].padStart(2, "0")}-${bm[3].padStart(2, "0")}`;
    const today = new Date();
    const dob = new Date(birthDate);
    age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  }
  // Standalone 「33歳」style
  if (age == null) {
    const am = norm.match(/(\d{2})\s*歳/);
    if (am) age = Number(am[1]);
  }

  // Address — 〒XXX-XXXX  住所行
  let address: string | null = null;
  const addrMatch = norm.match(/(?:住所|現住所)[\s:：]*([〒\d\-\s一-龯ヵヶー、々-]+(?:都|道|府|県)[一-龯ヵヶー、々\d\s\-]+)/);
  if (addrMatch) address = addrMatch[1].trim().replace(/\s+/g, " ");

  // Nationality
  let nationality: string | null = null;
  for (const n of NATIONALITIES) {
    if (norm.includes(n)) { nationality = n; break; }
  }

  // JLPT
  let jlpt: string | null = null;
  for (const lv of JLPT_LEVELS) {
    if (new RegExp(`(?:JLPT|日本語能力)\\s*[\\d]?\\s*${lv}\\b`, "i").test(norm) || new RegExp(`\\b${lv}\\s*(?:合格|取得)`, "i").test(norm)) {
      jlpt = lv; break;
    }
  }

  // Years of experience — 「経験 5年」「○年経験」など
  let yearsOfExperience: number | null = null;
  const yexp = norm.match(/(?:経験|実務|キャリア)\s*[:：]?\s*(\d{1,2})\s*年/);
  if (yexp) yearsOfExperience = Number(yexp[1]);

  // Education — extract 「○○大学」「○○専門学校」 mentions
  const educationMatches = Array.from(norm.matchAll(/([一-龯々ァ-ヶーA-Za-z]+(?:大学院?|専門学校|高校|高等学校|学校))/g)).slice(0, 5);
  const education = educationMatches.length > 0 ? educationMatches.map((m) => ({
    school: m[1],
    degree: null as string | null,
    field: null as string | null,
    period_from: null as string | null,
    period_to: null as string | null,
  })) : [];

  // Work history — extract 「株式会社○○」「有限会社○○」 mentions
  const workMatches = Array.from(norm.matchAll(/((?:株式会社|有限会社|合同会社|学校法人|独立行政法人|社会福祉法人)\s?[一-龯々ァ-ヶーA-Za-z0-9]+)/g)).slice(0, 5);
  const career = workMatches.length > 0 ? workMatches.map((m) => ({
    company: m[1].trim(),
    position: null as string | null,
    period_from: null as string | null,
    period_to: null as string | null,
    description: null as string | null,
  })) : [];

  // Skills — keep as qualification strings. Look at all relevant block headers.
  const qualifications: { name: string; acquired_date: string | null }[] = [];
  const blockMatchers = [/(?:スキル|特技|得意|できること)[\s:：]*([^\n]+)/g];
  for (const re of blockMatchers) {
    for (const m of norm.matchAll(re)) {
      m[1].split(/[、,，\/\s]/).map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 30 && !/^\d+$/.test(s))
        .forEach((s) => {
          if (!qualifications.some((q) => q.name === s)) qualifications.push({ name: s, acquired_date: null });
        });
    }
  }
  if (jlpt && !qualifications.some((q) => q.name.includes("JLPT") || q.name === jlpt)) {
    qualifications.unshift({ name: `JLPT ${jlpt}`, acquired_date: null });
  }

  // Summary — first long paragraph from 自己PR / 志望動機
  const summary = (() => {
    const m = norm.match(/(?:自己PR|自己アピール|志望動機)[\s:：]*\n?([\s\S]{20,500}?)(?:\n\n|$)/);
    return m ? m[1].trim().slice(0, 300) : (yearsOfExperience ? `経験 ${yearsOfExperience}年` : "ローカル解析 (要確認)");
  })();

  return {
    full_name: fullName || "（抽出できませんでした）",
    kana,
    email,
    phone,
    birthday: birthDate,
    nationality,
    address,
    jlpt_level: (jlpt as any) || null,
    summary,
    education,
    career,
    qualifications,
    desired_conditions: { salary_min: null, salary_max: null, work_style: null, notes: null },
  };
}

function normalize(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[　\t]/g, " ")          // full-width space, tab → space
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Heuristic 0-1 score of how many fields were extracted. UI uses this to nudge. */
function scoreCoverage(d: ParsedResume): number {
  const checks = [
    d.full_name !== "（抽出できませんでした）",
    !!d.email,
    !!d.phone,
    !!d.nationality,
    !!d.birthday,
    !!d.address,
    d.education.length > 0,
    d.career.length > 0,
    d.qualifications.length > 0,
    !!d.jlpt_level,
  ];
  const hits = checks.filter(Boolean).length;
  return hits / checks.length;
}
