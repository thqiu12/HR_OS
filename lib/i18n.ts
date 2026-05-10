/**
 * Lightweight i18n for HR OS.
 *
 * 現状すべて日本語ハードコードされたUIを段階的に t() 経由に切り替えるための
 * 足場。実装は最小 — 将来 next-intl / react-intl への移行を妨げない。
 *
 * Usage:
 *   import { t } from "@/lib/i18n";
 *   <button>{t("common.save")}</button>
 *
 * 言語切替は `?lang=en` クエリ または ユーザー設定 `i18n.lang` で実装予定。
 */

export type Locale = "ja" | "en" | "zh";

const MESSAGES: Record<Locale, Record<string, string>> = {
  ja: {
    "common.save": "保存",
    "common.cancel": "キャンセル",
    "common.delete": "削除",
    "common.edit": "編集",
    "common.submit": "送信",
    "common.confirm": "確定",
    "common.create": "作成",
    "common.search": "検索",
    "common.loading": "読み込み中...",
    "common.error": "エラーが発生しました",
    "common.success": "完了しました",
    "common.required": "必須",
    "common.yes": "はい",
    "common.no": "いいえ",
    "auth.login": "ログイン",
    "auth.logout": "ログアウト",
    "auth.password": "パスワード",
    "auth.loginId": "ログインID",
    "auth.2fa.code": "2FA 認証コード",
    "nav.dashboard": "ダッシュボード",
    "nav.recruiting": "採用管理",
    "nav.onboarding": "入社手続き",
    "nav.organization": "組織管理",
    "nav.performance": "評価管理",
    "nav.reminders": "リマインダー",
    "nav.settings": "設定",
    "review.start": "評価を開始",
    "review.goal": "目標",
    "review.score": "スコア",
    "review.rank": "ランク",
    "forbidden.title": "アクセス権限がありません",
  },
  en: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.submit": "Submit",
    "common.confirm": "Confirm",
    "common.create": "Create",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.success": "Done",
    "common.required": "Required",
    "common.yes": "Yes",
    "common.no": "No",
    "auth.login": "Sign in",
    "auth.logout": "Sign out",
    "auth.password": "Password",
    "auth.loginId": "Login ID",
    "auth.2fa.code": "2FA code",
    "nav.dashboard": "Dashboard",
    "nav.recruiting": "Recruiting",
    "nav.onboarding": "Onboarding",
    "nav.organization": "Organization",
    "nav.performance": "Performance",
    "nav.reminders": "Reminders",
    "nav.settings": "Settings",
    "review.start": "Start review",
    "review.goal": "Goal",
    "review.score": "Score",
    "review.rank": "Rank",
    "forbidden.title": "Access denied",
  },
  zh: {
    "common.save": "保存",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.submit": "提交",
    "common.confirm": "确定",
    "common.create": "创建",
    "common.search": "搜索",
    "common.loading": "加载中...",
    "common.error": "发生错误",
    "common.success": "完成",
    "common.required": "必填",
    "common.yes": "是",
    "common.no": "否",
    "auth.login": "登录",
    "auth.logout": "登出",
    "auth.password": "密码",
    "auth.loginId": "登录ID",
    "auth.2fa.code": "2FA 验证码",
    "nav.dashboard": "仪表板",
    "nav.recruiting": "招聘管理",
    "nav.onboarding": "入职手续",
    "nav.organization": "组织管理",
    "nav.performance": "绩效考核",
    "nav.reminders": "提醒事项",
    "nav.settings": "设置",
    "review.start": "开始评估",
    "review.goal": "目标",
    "review.score": "评分",
    "review.rank": "等级",
    "forbidden.title": "无访问权限",
  },
};

let currentLocale: Locale = "ja";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = MESSAGES[currentLocale] || MESSAGES.ja;
  let s = dict[key] || MESSAGES.ja[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
};
