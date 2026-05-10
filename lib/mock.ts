// ===== Mock data for HR OS demo =====

export type School = { id: string; name: string; type: "jls" | "senmon" | "juku" | "hq"; entity: string };
export const schools: School[] = [
  { id: "s1", name: "ABC日本語学校", type: "jls", entity: "学校法人さくら学園" },
  { id: "s2", name: "XYZ国際専門学校", type: "senmon", entity: "学校法人さくら学園" },
  { id: "s3", name: "LMNアカデミー私塾", type: "juku", entity: "株式会社LMN教育" },
  { id: "s4", name: "本社 株式会社さくらHD", type: "hq", entity: "株式会社さくらHD" },
];

export type Department = { id: string; schoolId: string; name: string };
export const departments: Department[] = [
  { id: "d1", schoolId: "s1", name: "教務部" },
  { id: "d2", schoolId: "s1", name: "事務部" },
  { id: "d3", schoolId: "s1", name: "学生支援部" },
  { id: "d4", schoolId: "s2", name: "日本語学科" },
  { id: "d5", schoolId: "s2", name: "ビジネス学科" },
  { id: "d6", schoolId: "s2", name: "事務部" },
  { id: "d7", schoolId: "s3", name: "教室運営" },
  { id: "d8", schoolId: "s4", name: "人事部" },
  { id: "d9", schoolId: "s4", name: "経理部" },
  { id: "d10", schoolId: "s4", name: "経営企画" },
];

export type Employee = {
  id: string;
  empNo: string;
  name: string;
  kana: string;
  romaji: string;
  nationality: string;
  flag: string;
  email: string;
  schoolId: string;
  departmentId: string;
  position: string;
  hireRoute: "新卒" | "中途";
  hireDate: string;
  probationEnd: string;
  contractEnd?: string;
  zairyuExpiry?: string;
  status: "在籍" | "試用期間" | "休職";
  managerId?: string;
  evaluatorId?: string;
  isPrimary: boolean;
  costRatio: number;
  assignmentType: "所属" | "兼任";
  employmentType?: "regular" | "contract" | "part_time" | "gyomu_itaku";
  hourlyRate?: number;
  perClassRate?: number;
  contractRenewalDate?: string;
};

const ja = "🇯🇵", cn = "🇨🇳", vn = "🇻🇳", np = "🇳🇵", kr = "🇰🇷";

export const employees: Employee[] = [
  { id: "e1", empNo: "S0001", name: "佐藤 一郎", kana: "サトウ イチロウ", romaji: "Sato Ichiro", nationality: "日本", flag: ja, email: "sato@sakura.jp", schoolId: "s1", departmentId: "d1", position: "教務部長", hireRoute: "中途", hireDate: "2018-04-01", probationEnd: "2018-09-30", status: "在籍", evaluatorId: "e10", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e2", empNo: "S0002", name: "田中 花子", kana: "タナカ ハナコ", romaji: "Tanaka Hanako", nationality: "日本", flag: ja, email: "tanaka@sakura.jp", schoolId: "s1", departmentId: "d1", position: "主任講師", hireRoute: "新卒", hireDate: "2024-04-01", probationEnd: "2024-09-30", status: "在籍", managerId: "e1", evaluatorId: "e1", isPrimary: true, costRatio: 60, assignmentType: "所属" },
  { id: "e3", empNo: "S0003", name: "陳 美玲", kana: "チン ビレイ", romaji: "Chen Meiling", nationality: "中国", flag: cn, email: "chen@sakura.jp", schoolId: "s1", departmentId: "d1", position: "常勤講師", hireRoute: "中途", hireDate: "2023-10-01", probationEnd: "2024-03-31", zairyuExpiry: "2026-06-08", status: "在籍", managerId: "e1", evaluatorId: "e1", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e4", empNo: "S0004", name: "李 健", kana: "リ ケン", romaji: "Li Jian", nationality: "中国", flag: cn, email: "li@sakura.jp", schoolId: "s1", departmentId: "d1", position: "非常勤講師", hireRoute: "中途", hireDate: "2025-01-15", probationEnd: "2025-07-14", zairyuExpiry: "2025-12-22", status: "試用期間", managerId: "e1", evaluatorId: "e1", isPrimary: true, costRatio: 50, assignmentType: "兼任", employmentType: "part_time", hourlyRate: 3500, contractRenewalDate: "2026-07-14" },
  { id: "e5", empNo: "S0005", name: "Nguyen Thi Lan", kana: "グエン ティ ラン", romaji: "Nguyen Thi Lan", nationality: "ベトナム", flag: vn, email: "lan@sakura.jp", schoolId: "s1", departmentId: "d3", position: "学生支援担当", hireRoute: "新卒", hireDate: "2025-04-01", probationEnd: "2025-09-30", zairyuExpiry: "2027-04-10", status: "試用期間", managerId: "e1", evaluatorId: "e1", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e6", empNo: "S0006", name: "鈴木 次郎", kana: "スズキ ジロウ", romaji: "Suzuki Jiro", nationality: "日本", flag: ja, email: "suzuki@sakura.jp", schoolId: "s2", departmentId: "d4", position: "学科長", hireRoute: "中途", hireDate: "2017-04-01", probationEnd: "2017-09-30", status: "在籍", evaluatorId: "e10", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e7", empNo: "S0007", name: "山田 美咲", kana: "ヤマダ ミサキ", romaji: "Yamada Misaki", nationality: "日本", flag: ja, email: "yamada@sakura.jp", schoolId: "s2", departmentId: "d4", position: "常勤講師", hireRoute: "新卒", hireDate: "2022-04-01", probationEnd: "2022-09-30", status: "在籍", managerId: "e6", evaluatorId: "e6", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e8", empNo: "S0008", name: "Park Min-Jun", kana: "パク ミンジュン", romaji: "Park Min-Jun", nationality: "韓国", flag: kr, email: "park@sakura.jp", schoolId: "s2", departmentId: "d5", position: "ビジネス講師", hireRoute: "中途", hireDate: "2024-07-01", probationEnd: "2025-01-01", zairyuExpiry: "2026-05-30", status: "在籍", managerId: "e6", evaluatorId: "e6", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e9", empNo: "S0009", name: "Bishal Shrestha", kana: "ビシャル シュレスタ", romaji: "Bishal Shrestha", nationality: "ネパール", flag: np, email: "bishal@sakura.jp", schoolId: "s2", departmentId: "d4", position: "非常勤講師", hireRoute: "中途", hireDate: "2025-03-01", probationEnd: "2025-08-31", zairyuExpiry: "2025-11-15", status: "試用期間", managerId: "e6", evaluatorId: "e6", isPrimary: true, costRatio: 100, assignmentType: "所属", employmentType: "part_time", hourlyRate: 3200, contractRenewalDate: "2026-09-01" },
  { id: "e10", empNo: "S0010", name: "高橋 校長", kana: "タカハシ コウチョウ", romaji: "Takahashi Koucho", nationality: "日本", flag: ja, email: "takahashi@sakura.jp", schoolId: "s4", departmentId: "d10", position: "代表取締役", hireRoute: "中途", hireDate: "2010-04-01", probationEnd: "2010-09-30", status: "在籍", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e11", empNo: "S0011", name: "渡辺 由美", kana: "ワタナベ ユミ", romaji: "Watanabe Yumi", nationality: "日本", flag: ja, email: "watanabe@sakura.jp", schoolId: "s4", departmentId: "d8", position: "人事マネージャー", hireRoute: "中途", hireDate: "2019-04-01", probationEnd: "2019-09-30", status: "在籍", managerId: "e10", evaluatorId: "e10", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e12", empNo: "S0012", name: "伊藤 健太", kana: "イトウ ケンタ", romaji: "Ito Kenta", nationality: "日本", flag: ja, email: "ito@sakura.jp", schoolId: "s3", departmentId: "d7", position: "教室長", hireRoute: "中途", hireDate: "2021-04-01", probationEnd: "2021-09-30", status: "在籍", managerId: "e10", evaluatorId: "e10", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e13", empNo: "S0013", name: "王 浩然", kana: "ワン コウゼン", romaji: "Wang Haoran", nationality: "中国", flag: cn, email: "wang@sakura.jp", schoolId: "s3", departmentId: "d7", position: "講師", hireRoute: "中途", hireDate: "2024-09-01", probationEnd: "2025-02-28", zairyuExpiry: "2026-07-20", status: "在籍", managerId: "e12", evaluatorId: "e12", isPrimary: true, costRatio: 70, assignmentType: "所属" },
  { id: "e14", empNo: "S0014", name: "中村 さやか", kana: "ナカムラ サヤカ", romaji: "Nakamura Sayaka", nationality: "日本", flag: ja, email: "nakamura@sakura.jp", schoolId: "s1", departmentId: "d2", position: "事務主任", hireRoute: "中途", hireDate: "2020-04-01", probationEnd: "2020-09-30", status: "在籍", managerId: "e1", evaluatorId: "e1", isPrimary: true, costRatio: 100, assignmentType: "所属" },
  { id: "e15", empNo: "S0015", name: "Tran Van Minh", kana: "チャン バン ミン", romaji: "Tran Van Minh", nationality: "ベトナム", flag: vn, email: "minh@sakura.jp", schoolId: "s2", departmentId: "d4", position: "常勤講師", hireRoute: "中途", hireDate: "2024-04-01", probationEnd: "2024-09-30", zairyuExpiry: "2025-11-30", status: "在籍", managerId: "e6", evaluatorId: "e6", isPrimary: true, costRatio: 100, assignmentType: "所属" },
];

export function findEmployee(id: string) {
  return employees.find((e) => e.id === id);
}
export function schoolName(id: string) {
  return schools.find((s) => s.id === id)?.name || "";
}
export function deptName(id: string) {
  return departments.find((d) => d.id === id)?.name || "";
}

// ===== Recruiting =====
export type Stage = "応募" | "書類選考" | "一次面接" | "二次面接" | "条件提示" | "内定" | "入社手続き" | "入社済";
export const stages: Stage[] = ["応募", "書類選考", "一次面接", "二次面接", "条件提示", "内定", "入社手続き", "入社済"];

export type Job = { id: string; title: string; schoolId: string; departmentId: string; route: "新卒" | "中途"; status: "公開中" | "下書き" | "停止"; openCount: number; postedAt: string };
export const jobs: Job[] = [
  { id: "j1", title: "常勤日本語講師（N1必須）", schoolId: "s1", departmentId: "d1", route: "中途", status: "公開中", openCount: 12, postedAt: "2026-04-01" },
  { id: "j2", title: "新卒採用 2027年4月入社・教務職", schoolId: "s1", departmentId: "d1", route: "新卒", status: "公開中", openCount: 8, postedAt: "2026-03-15" },
  { id: "j3", title: "ビジネス学科 専任講師", schoolId: "s2", departmentId: "d5", route: "中途", status: "公開中", openCount: 4, postedAt: "2026-04-20" },
  { id: "j4", title: "学生支援担当（多言語対応）", schoolId: "s1", departmentId: "d3", route: "中途", status: "公開中", openCount: 5, postedAt: "2026-04-10" },
  { id: "j5", title: "事務スタッフ（経理経験者）", schoolId: "s4", departmentId: "d9", route: "中途", status: "公開中", openCount: 3, postedAt: "2026-04-05" },
  { id: "j6", title: "私塾 数学講師（高校生向け）", schoolId: "s3", departmentId: "d7", route: "中途", status: "公開中", openCount: 6, postedAt: "2026-04-12" },
];

export type Candidate = {
  id: string;
  name: string;
  kana: string;
  flag: string;
  nationality: string;
  jlpt?: string;
  jobId: string;
  stage: Stage;
  attachments: number;
  appliedAt: string;
  email: string;
  phone: string;
  age: number;
  experience: string;
  source: string;
};

export const candidates: Candidate[] = [
  { id: "c1", name: "李 思琪", kana: "リ シキ", flag: cn, nationality: "中国", jlpt: "N1", jobId: "j1", stage: "応募", attachments: 3, appliedAt: "2026-05-01", email: "li.siqi@example.com", phone: "080-1234-5678", age: 28, experience: "日本語講師 3年", source: "自社サイト" },
  { id: "c2", name: "王 璐", kana: "ワン ルー", flag: cn, nationality: "中国", jlpt: "N1", jobId: "j1", stage: "応募", attachments: 2, appliedAt: "2026-05-02", email: "wang.lu@example.com", phone: "080-2345-6789", age: 30, experience: "日本語講師 5年", source: "agent" },
  { id: "c3", name: "Phan Thi Mai", kana: "ファン ティ マイ", flag: vn, nationality: "ベトナム", jlpt: "N1", jobId: "j1", stage: "書類選考", attachments: 4, appliedAt: "2026-04-28", email: "mai@example.com", phone: "080-3456-7890", age: 26, experience: "日本語講師 2年", source: "紹介" },
  { id: "c4", name: "Kim Soo-Yeon", kana: "キム スヨン", flag: kr, nationality: "韓国", jlpt: "N1", jobId: "j3", stage: "書類選考", attachments: 3, appliedAt: "2026-04-29", email: "kim@example.com", phone: "080-4567-8901", age: 32, experience: "ビジネス講師 6年", source: "agent" },
  { id: "c5", name: "佐々木 美穂", kana: "ササキ ミホ", flag: ja, nationality: "日本", jobId: "j2", stage: "一次面接", attachments: 2, appliedAt: "2026-04-15", email: "sasaki@example.com", phone: "080-5678-9012", age: 22, experience: "新卒（教育学部）", source: "自社サイト" },
  { id: "c6", name: "Sharma Anil", kana: "シャルマ アニル", flag: np, nationality: "ネパール", jlpt: "N2", jobId: "j4", stage: "一次面接", attachments: 4, appliedAt: "2026-04-18", email: "anil@example.com", phone: "080-6789-0123", age: 27, experience: "学生支援 3年", source: "紹介" },
  { id: "c7", name: "陳 文豪", kana: "チン ブンゴウ", flag: cn, nationality: "中国", jlpt: "N1", jobId: "j1", stage: "二次面接", attachments: 5, appliedAt: "2026-04-10", email: "chen.wh@example.com", phone: "080-7890-1234", age: 29, experience: "日本語講師 4年", source: "自社サイト" },
  { id: "c8", name: "Tanaka Yuki", kana: "タナカ ユキ", flag: ja, nationality: "日本", jobId: "j5", stage: "二次面接", attachments: 3, appliedAt: "2026-04-08", email: "yuki@example.com", phone: "080-8901-2345", age: 31, experience: "経理 7年", source: "agent" },
  { id: "c9", name: "Le Van Hung", kana: "レ バン フン", flag: vn, nationality: "ベトナム", jlpt: "N1", jobId: "j1", stage: "条件提示", attachments: 4, appliedAt: "2026-04-01", email: "hung@example.com", phone: "080-9012-3456", age: 28, experience: "日本語講師 4年", source: "紹介" },
  { id: "c10", name: "山口 智子", kana: "ヤマグチ トモコ", flag: ja, nationality: "日本", jobId: "j6", stage: "条件提示", attachments: 2, appliedAt: "2026-04-03", email: "yamaguchi@example.com", phone: "080-0123-4567", age: 35, experience: "数学講師 10年", source: "自社サイト" },
  { id: "c11", name: "張 偉", kana: "チョウ イ", flag: cn, nationality: "中国", jlpt: "N1", jobId: "j1", stage: "内定", attachments: 5, appliedAt: "2026-03-20", email: "zhang@example.com", phone: "080-1111-2222", age: 26, experience: "日本語講師 2年", source: "自社サイト" },
  { id: "c12", name: "高橋 翔", kana: "タカハシ ショウ", flag: ja, nationality: "日本", jobId: "j2", stage: "内定", attachments: 3, appliedAt: "2026-03-25", email: "sho@example.com", phone: "080-3333-4444", age: 22, experience: "新卒（言語学部）", source: "紹介" },
  { id: "c13", name: "Pham Thu Ha", kana: "ファム トゥー ハー", flag: vn, nationality: "ベトナム", jlpt: "N1", jobId: "j4", stage: "入社手続き", attachments: 6, appliedAt: "2026-03-10", email: "ha@example.com", phone: "080-5555-6666", age: 27, experience: "学生支援 4年", source: "紹介" },
  { id: "c14", name: "森田 直子", kana: "モリタ ナオコ", flag: ja, nationality: "日本", jobId: "j5", stage: "入社手続き", attachments: 7, appliedAt: "2026-03-08", email: "morita@example.com", phone: "080-7777-8888", age: 33, experience: "経理 9年", source: "agent" },
  { id: "c15", name: "Lim Hye-Jin", kana: "リム ヘジン", flag: kr, nationality: "韓国", jobId: "j3", stage: "入社済", attachments: 8, appliedAt: "2026-02-15", email: "lim@example.com", phone: "080-9999-0000", age: 30, experience: "ビジネス講師 5年", source: "agent" },
];

// ===== Onboarding =====
export type DocStatus = "未提出" | "提出済" | "確認中" | "差戻し" | "完了";
export type OnboardDoc = { code: string; name: string; required: boolean; status: DocStatus; rejectReason?: string };

export type OnboardingCase = {
  id: string;
  candidateName: string;
  flag: string;
  schoolId: string;
  position: string;
  route: "新卒" | "中途";
  expectedJoinDate: string;
  progress: number;
  status: "未開始" | "入力中" | "書類待ち" | "HR確認中" | "完了";
  docs: OnboardDoc[];
};

const baseDocsShinsotsu = (): OnboardDoc[] => [
  { code: "zairyu_card", name: "在留カード（両面カラーコピー）", required: true, status: "未提出" },
  { code: "mynumber_card", name: "マイナンバーカード（両面）または住民票", required: true, status: "未提出" },
  { code: "bank_card", name: "給与振込口座（キャッシュカード両面）", required: true, status: "未提出" },
];

const baseDocsChuto = (): OnboardDoc[] => [
  ...baseDocsShinsotsu(),
  { code: "rishoku_shomei", name: "離職証明書", required: true, status: "未提出" },
  { code: "koyo_hoken", name: "雇用保険被保険者証", required: true, status: "未提出" },
  { code: "gensen_choshu", name: "前職の源泉徴収票", required: true, status: "未提出" },
];

export const onboardingCases: OnboardingCase[] = [
  {
    id: "o1", candidateName: "Pham Thu Ha", flag: vn, schoolId: "s1", position: "学生支援担当", route: "中途",
    expectedJoinDate: "2026-06-01", progress: 60, status: "HR確認中",
    docs: (() => {
      const d = baseDocsChuto();
      d[0].status = "確認中"; d[1].status = "完了"; d[2].status = "差戻し"; d[2].rejectReason = "裏面が不鮮明です。再撮影をお願いします。";
      d[3].status = "完了"; d[4].status = "提出済"; d[5].status = "未提出";
      return d;
    })(),
  },
  {
    id: "o2", candidateName: "森田 直子", flag: ja, schoolId: "s4", position: "経理スタッフ", route: "中途",
    expectedJoinDate: "2026-06-01", progress: 85, status: "HR確認中",
    docs: (() => { const d = baseDocsChuto(); d[0].status = "完了"; d[1].status = "完了"; d[2].status = "完了"; d[3].status = "完了"; d[4].status = "完了"; d[5].status = "確認中"; return d; })(),
  },
  {
    id: "o3", candidateName: "張 偉", flag: cn, schoolId: "s1", position: "常勤日本語講師", route: "中途",
    expectedJoinDate: "2026-07-01", progress: 30, status: "書類待ち",
    docs: (() => { const d = baseDocsChuto(); d[0].status = "提出済"; d[1].status = "提出済"; d[2].status = "未提出"; d[3].status = "未提出"; d[4].status = "未提出"; d[5].status = "未提出"; return d; })(),
  },
  {
    id: "o4", candidateName: "高橋 翔", flag: ja, schoolId: "s1", position: "教務職（新卒）", route: "新卒",
    expectedJoinDate: "2027-04-01", progress: 15, status: "入力中",
    docs: (() => { const d = baseDocsShinsotsu(); d[0].status = "未提出"; d[1].status = "提出済"; d[2].status = "未提出"; return d; })(),
  },
  {
    id: "o5", candidateName: "Lim Hye-Jin", flag: kr, schoolId: "s2", position: "ビジネス講師", route: "中途",
    expectedJoinDate: "2026-05-01", progress: 100, status: "完了",
    docs: (() => { const d = baseDocsChuto(); d.forEach((x) => (x.status = "完了")); return d; })(),
  },
];

// ===== Performance =====
export type Review = {
  id: string;
  type: "試用期間評価" | "年度評価" | "昇格評価" | "給与改定";
  periodLabel: string;
  dueDate: string;
  rating?: "S" | "A+" | "A" | "B" | "C" | "D";
  result: string;
  evaluator: string;
  status: "下書き" | "提出済" | "承認済" | "完了" | "予定";
};

export const reviewsByEmp: Record<string, Review[]> = {
  e2: [
    { id: "r1", type: "試用期間評価", periodLabel: "2024-04 〜 2024-09", dueDate: "2024-09-30", rating: "B", result: "本採用", evaluator: "佐藤 一郎", status: "完了" },
    { id: "r2", type: "年度評価", periodLabel: "2024-04 〜 2025-03", dueDate: "2025-03-31", rating: "A", result: "昇給 5%（250,000 → 262,500円）", evaluator: "佐藤 一郎", status: "完了" },
    { id: "r3", type: "昇格評価", periodLabel: "2025-04 〜 2025-09", dueDate: "2025-09-30", rating: "A+", result: "主任講師に昇格（262,500 → 290,000円）", evaluator: "高橋 校長", status: "完了" },
    { id: "r4", type: "年度評価", periodLabel: "2025-04 〜 2026-03", dueDate: "2026-03-31", result: "（評価入力中）", evaluator: "佐藤 一郎", status: "提出済" },
  ],
  e4: [
    { id: "r5", type: "試用期間評価", periodLabel: "2025-01 〜 2025-07", dueDate: "2025-07-14", result: "（期日まで残り 65日）", evaluator: "佐藤 一郎", status: "予定" },
  ],
  e5: [
    { id: "r6", type: "試用期間評価", periodLabel: "2025-04 〜 2025-09", dueDate: "2025-09-30", result: "（期日まで残り 144日）", evaluator: "佐藤 一郎", status: "予定" },
  ],
};

// ===== Reminders =====
export type Reminder = {
  id: string;
  category: "在留カード期限" | "試用期間終了" | "雇用契約終了" | "書類未提出" | "書類差戻し" | "源泉徴収票未提出";
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  triggerDate: string;
  schoolId: string;
};

export const reminders: Reminder[] = [
  { id: "rm1", category: "在留カード期限", severity: "critical", title: "李 健 さんの在留カードが 30日以内に期限切れ", detail: "有効期限：2025-12-22 / 在留資格更新の手続きをお願いします", triggerDate: "2025-11-22", schoolId: "s1" },
  { id: "rm2", category: "在留カード期限", severity: "critical", title: "Bishal Shrestha さんの在留カードが 30日以内に期限切れ", detail: "有効期限：2025-11-15", triggerDate: "2025-10-15", schoolId: "s2" },
  { id: "rm3", category: "在留カード期限", severity: "warn", title: "Tran Van Minh さんの在留カードが 60日以内に期限切れ", detail: "有効期限：2025-11-30", triggerDate: "2025-10-01", schoolId: "s2" },
  { id: "rm4", category: "在留カード期限", severity: "warn", title: "Park Min-Jun さんの在留カードが 60日以内に期限切れ", detail: "有効期限：2026-05-30", triggerDate: "2026-04-01", schoolId: "s2" },
  { id: "rm5", category: "在留カード期限", severity: "warn", title: "陳 美玲 さんの在留カードが 60日以内に期限切れ", detail: "有効期限：2026-06-08", triggerDate: "2026-04-09", schoolId: "s1" },
  { id: "rm6", category: "試用期間終了", severity: "warn", title: "Bishal Shrestha さんの試用期間が 2週間後に終了", detail: "試用期間終了日：2025-08-31 / 評価面談の設定をお願いします", triggerDate: "2025-08-17", schoolId: "s2" },
  { id: "rm7", category: "試用期間終了", severity: "info", title: "Nguyen Thi Lan さんの試用期間が 30日後に終了", detail: "試用期間終了日：2025-09-30", triggerDate: "2025-08-31", schoolId: "s1" },
  { id: "rm8", category: "試用期間終了", severity: "info", title: "李 健 さんの試用期間が 30日後に終了", detail: "試用期間終了日：2025-07-14", triggerDate: "2025-06-14", schoolId: "s1" },
  { id: "rm9", category: "書類差戻し", severity: "critical", title: "Pham Thu Ha さんの「給与振込口座」が差戻し中", detail: "理由：裏面が不鮮明 / 再提出が必要です", triggerDate: "2026-05-08", schoolId: "s1" },
  { id: "rm10", category: "書類未提出", severity: "warn", title: "Pham Thu Ha さんの「源泉徴収票」が未提出", detail: "入社予定日：2026-06-01", triggerDate: "2026-05-09", schoolId: "s1" },
  { id: "rm11", category: "書類未提出", severity: "warn", title: "張 偉 さんの「離職証明書」が未提出", detail: "入社予定日：2026-07-01", triggerDate: "2026-05-09", schoolId: "s1" },
  { id: "rm12", category: "雇用契約終了", severity: "info", title: "非常勤講師 3名の雇用契約が 90日以内に終了", detail: "契約更新の判断をお願いします", triggerDate: "2026-05-09", schoolId: "s1" },
  { id: "rm13", category: "源泉徴収票未提出", severity: "warn", title: "森田 直子 さんの源泉徴収票が確認中", detail: "前職分。HR確認待ち。", triggerDate: "2026-05-07", schoolId: "s4" },
];
