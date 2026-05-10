/**
 * 標準評価項目テンプレート。
 *
 * 評価種別ごとに、業績/能力/行動の3カテゴリの初期項目を定義。新規評価作成
 * 時に template から review_items を一括 INSERT する。
 *
 * 業績 (MBO) は空のまま、ユーザーが個別に目標を追加する。
 * 能力・行動は固定項目を自動投入する。
 */

export type ReviewType = "probation" | "mid_year" | "annual" | "promotion" | "special";

export const TYPE_LABEL: Record<ReviewType, string> = {
  probation: "試用期間評価",
  mid_year: "半期評価",
  annual: "年度評価",
  promotion: "昇格評価",
  special: "特別評価",
};

export type TemplateItem = {
  category: "performance" | "competency" | "behavior";
  itemKey: string;
  title: string;
  description?: string;
  weightPct?: number; // performance only
};

/** 4 固定の能力項目 (全種別共通) */
const COMPETENCY_ITEMS: TemplateItem[] = [
  {
    category: "competency",
    itemKey: "expertise",
    title: "専門スキル",
    description: "自分の業務領域での技術・知識・経験の活用度。継続的な学習と業務への反映。",
  },
  {
    category: "competency",
    itemKey: "leadership",
    title: "リーダーシップ",
    description: "チーム/後輩への影響力・育成力。役職に応じたリーダー行動の発揮。",
  },
  {
    category: "competency",
    itemKey: "communication",
    title: "コミュニケーション",
    description: "報連相の的確性、会議でのファシリテーション、対外折衝の質。",
  },
  {
    category: "competency",
    itemKey: "problem_solving",
    title: "問題解決力",
    description: "課題発見・分析・実行・振り返り (PDCA) の質と速度。",
  },
];

/** 3 固定の行動・価値観項目 (全種別共通) */
const BEHAVIOR_ITEMS: TemplateItem[] = [
  {
    category: "behavior",
    itemKey: "teamwork",
    title: "協調性・チームワーク",
    description: "部門内/部門横断連携への貢献。役割を超えたサポート。",
  },
  {
    category: "behavior",
    itemKey: "initiative",
    title: "主体性・挑戦",
    description: "自発的な改善提案・新領域への挑戦。指示待ちでない行動。",
  },
  {
    category: "behavior",
    itemKey: "ethics",
    title: "倫理観・コンプライアンス",
    description: "規律遵守・誠実な業務態度。情報セキュリティ・ハラスメント対応。",
  },
];

/**
 * 試用期間評価は MBO ではなく「適性チェック」中心の固定3項目を使う。
 * 業績の代わりに「業務習熟」「業務遂行品質」「組織適応」を評価。
 */
const PROBATION_PERFORMANCE_ITEMS: TemplateItem[] = [
  {
    category: "performance",
    itemKey: "probation_skills",
    title: "業務習熟度",
    description: "配属業務に必要な基本スキル/知識の習得状況。",
    weightPct: 40,
  },
  {
    category: "performance",
    itemKey: "probation_quality",
    title: "業務遂行品質",
    description: "ミスの少なさ、納期遵守、自己管理。",
    weightPct: 40,
  },
  {
    category: "performance",
    itemKey: "probation_fit",
    title: "組織適応",
    description: "社風/価値観への共感、チームへの溶け込み、勤怠。",
    weightPct: 20,
  },
];

/**
 * 非常勤・業務委託向けの簡易テンプレート (3項目のみ)
 * 8段階フローは過剰なので、年1回 上司一発評価で運用する想定。
 */
const PART_TIME_ITEMS: TemplateItem[] = [
  {
    category: "performance",
    itemKey: "pt_class_quality",
    title: "授業品質",
    description: "学生からの評価 / 受講生の習熟度 / 教材活用。",
    weightPct: 60,
  },
  {
    category: "performance",
    itemKey: "pt_punctuality",
    title: "出勤・遅刻欠勤",
    description: "シフト遵守率 / 振替対応 / 連絡の早さ。",
    weightPct: 25,
  },
  {
    category: "behavior",
    itemKey: "pt_collaboration",
    title: "学校との連携",
    description: "報連相 / 学生指導での協調性 / 規律遵守。",
  },
];

export function templateFor(type: ReviewType, employmentType?: string): TemplateItem[] {
  // 非常勤・業務委託は雇用形態に関わらず簡易テンプレート
  if (employmentType === "part_time" || employmentType === "gyomu_itaku") {
    return PART_TIME_ITEMS;
  }
  if (type === "probation") {
    return [...PROBATION_PERFORMANCE_ITEMS, ...COMPETENCY_ITEMS, ...BEHAVIOR_ITEMS];
  }
  // 半期/年度/昇格/特別: 業績は空 (ユーザーが MBO 目標を個別追加)
  return [...COMPETENCY_ITEMS, ...BEHAVIOR_ITEMS];
}

export const COMPETENCY_KEYS = COMPETENCY_ITEMS.map((i) => i.itemKey);
export const BEHAVIOR_KEYS = BEHAVIOR_ITEMS.map((i) => i.itemKey);
