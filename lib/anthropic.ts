import Anthropic from "@anthropic-ai/sdk";

/**
 * Resume parser powered by the Claude API.
 *
 * - Model: claude-opus-4-7 (best quality for structured extraction from PDF).
 *   Switch to claude-sonnet-4-6 by setting ANTHROPIC_RESUME_MODEL if you want
 *   to trade some quality for cost.
 * - Adaptive thinking is on so the model can reason about ambiguous fields.
 * - Structured output via a single forced tool call — guarantees the response
 *   matches the schema and no JSON parsing edge cases.
 * - The instructions block is cached: every parse hits a warm cache on the
 *   ~3KB system prompt, so repeated parses are cheap.
 *
 * Falls back to a clearly-labeled mock when ANTHROPIC_API_KEY is absent so
 * the demo works out of the box.
 */

export type ParsedResume = {
  full_name: string | null;
  kana: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;          // ISO date
  nationality: string | null;
  address: string | null;
  jlpt_level: "N1" | "N2" | "N3" | "N4" | "N5" | null;
  summary: string;                  // 2-3 sentence overview in Japanese
  education: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    period_from: string | null;
    period_to: string | null;
  }>;
  career: Array<{
    company: string;
    position: string | null;
    period_from: string | null;
    period_to: string | null;
    description: string | null;
  }>;
  qualifications: Array<{
    name: string;
    acquired_date: string | null;
  }>;
  desired_conditions: {
    salary_min: number | null;
    salary_max: number | null;
    work_style: string | null;
    notes: string | null;
  };
};

export type ParseResult =
  | { ok: true; data: ParsedResume; model: string; tokensIn: number; tokensOut: number; cacheCreationTokens: number; cacheReadTokens: number }
  | { ok: false; reason: "no_api_key" | "api_error" | "no_tool_use"; message?: string; mock?: ParsedResume };

const MODEL = process.env.ANTHROPIC_RESUME_MODEL || "claude-opus-4-7";

const SYSTEM_PROMPT = `あなたは日本の人事採用システムの履歴書解析エキスパートです。
PDF形式の履歴書・職務経歴書を解析し、構造化されたJSONデータとして抽出してください。

抽出ルール：
- 氏名・メールアドレス・電話番号は記載がある場合のみ
- 学歴・職歴は古い順（period_from の昇順）で並べる
- 期間は ISO 8601 形式 (YYYY-MM もしくは YYYY-MM-DD) に統一
- 在籍中の場合は period_to を null にする
- JLPT レベルは N1/N2/N3/N4/N5 のいずれか、記載なしなら null
- 給与希望は数値（万円単位ではなく、円単位の数値）で
- 不明なフィールドは null（空文字列ではなく）
- summary は採用担当者向けの2〜3文の日本語サマリー

extract_resume ツールを使って結果を返してください。`;

const RESUME_SCHEMA = {
  type: "object" as const,
  required: ["full_name", "summary", "education", "career", "qualifications", "desired_conditions"],
  additionalProperties: false,
  properties: {
    full_name: { type: ["string", "null"], description: "氏名（漢字）" },
    kana: { type: ["string", "null"], description: "ふりがな（カタカナ）" },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    birthday: { type: ["string", "null"], description: "ISO date" },
    nationality: { type: ["string", "null"], description: "国籍（例：日本、中国、ベトナム）" },
    address: { type: ["string", "null"] },
    jlpt_level: { type: ["string", "null"], enum: ["N1", "N2", "N3", "N4", "N5", null] },
    summary: { type: "string", description: "2〜3文の日本語サマリー" },
    education: {
      type: "array",
      items: {
        type: "object",
        required: ["school"],
        properties: {
          school: { type: "string" },
          degree: { type: ["string", "null"] },
          field: { type: ["string", "null"] },
          period_from: { type: ["string", "null"] },
          period_to: { type: ["string", "null"] },
        },
      },
    },
    career: {
      type: "array",
      items: {
        type: "object",
        required: ["company"],
        properties: {
          company: { type: "string" },
          position: { type: ["string", "null"] },
          period_from: { type: ["string", "null"] },
          period_to: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
        },
      },
    },
    qualifications: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          acquired_date: { type: ["string", "null"] },
        },
      },
    },
    desired_conditions: {
      type: "object",
      properties: {
        salary_min: { type: ["number", "null"] },
        salary_max: { type: ["number", "null"] },
        work_style: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
    },
  },
};

export async function parseResumeFromPdf(pdfBytes: Buffer): Promise<ParseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no_api_key", mock: mockParsedResume() };
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          name: "extract_resume",
          description: "Extract structured information from a Japanese resume.",
          input_schema: RESUME_SCHEMA as any,
        },
      ],
      tool_choice: { type: "tool", name: "extract_resume" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBytes.toString("base64"),
              },
            },
            { type: "text", text: "この履歴書を解析して、extract_resume ツールで構造化データを返してください。" },
          ],
        },
      ],
    });

    const tool = response.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") {
      return { ok: false, reason: "no_tool_use", message: "Model did not call extract_resume" };
    }
    return {
      ok: true,
      data: tool.input as ParsedResume,
      model: response.model,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      cacheCreationTokens: (response.usage as any).cache_creation_input_tokens || 0,
      cacheReadTokens: (response.usage as any).cache_read_input_tokens || 0,
    };
  } catch (e: any) {
    return { ok: false, reason: "api_error", message: e?.message || String(e) };
  }
}

/** Returned when ANTHROPIC_API_KEY is not configured — labelled clearly so the UI shows a banner. */
export function mockParsedResume(): ParsedResume {
  return {
    full_name: "（モック）李 思琪",
    kana: "（モック）リ シキ",
    email: "li.siqi@example.com",
    phone: "080-1234-5678",
    birthday: "1996-08-15",
    nationality: "中国",
    address: "東京都新宿区...",
    jlpt_level: "N1",
    summary: "（ANTHROPIC_API_KEY 未設定のためモックデータです）日本語講師として3年の指導経験があり、N1取得・教育能力検定試験合格。即戦力として期待できます。",
    education: [
      { school: "北京外国語大学", degree: "学士", field: "日本語学部", period_from: "2015-09", period_to: "2019-06" },
      { school: "早稲田大学大学院", degree: "修士", field: "日本語教育研究科", period_from: "2019-09", period_to: "2021-06" },
    ],
    career: [
      { company: "〇〇日本語学院", position: "非常勤講師", period_from: "2021-04", period_to: "2023-03", description: "初級〜中級指導" },
      { company: "△△インターナショナル", position: "常勤講師", period_from: "2023-04", period_to: "2025-03", description: "カリキュラム策定担当" },
      { company: "フリーランス日本語教師", position: null, period_from: "2025-04", period_to: null, description: "オンライン個別レッスン" },
    ],
    qualifications: [
      { name: "JLPT N1", acquired_date: "2018" },
      { name: "日本語教育能力検定試験 合格", acquired_date: null },
      { name: "普通自動車運転免許", acquired_date: null },
      { name: "TOEIC 850", acquired_date: "2022" },
    ],
    desired_conditions: { salary_min: 280000, salary_max: 350000, work_style: "常勤希望", notes: "首都圏勤務希望" },
  };
}
