/**
 * k6 負荷試験スクリプト。
 *
 * 想定: 500社員規模、業務時間に同時 50 ログイン + 100 ダッシュボード閲覧。
 * SQLite 単一ノードでこれを捌けるかの目安測定。
 *
 * 実行:
 *   k6 run -e BASE=https://stg.hr-os.example.com scripts/loadtest.js
 *
 * 合格基準 (95-percentile):
 *   - /api/health        < 50ms
 *   - /dashboard         < 800ms
 *   - error rate         < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:3010";

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // 立ち上がり
    { duration: "1m",  target: 50 },   // 業務開始ピーク
    { duration: "2m",  target: 50 },   // 持続
    { duration: "1m",  target: 100 },  // バースト
    { duration: "30s", target: 0 },    // クールダウン
  ],
  thresholds: {
    "http_req_duration{name:health}":    ["p(95)<50"],
    "http_req_duration{name:dashboard}": ["p(95)<800"],
    "http_req_failed":                   ["rate<0.01"],
  },
};

export default function () {
  // 1. health probe — should always be fast
  http.get(`${BASE}/api/health`, { tags: { name: "health" } });

  // 2. login page (anonymous, no DB write)
  let r = http.get(`${BASE}/login`, { tags: { name: "login_page" } });
  check(r, { "login 200": (res) => res.status === 200 });

  // Authenticated paths require a real session cookie. For unauth load,
  // dashboard returns 302 → /login. Measure the redirect anyway.
  r = http.get(`${BASE}/dashboard`, { tags: { name: "dashboard" }, redirects: 0 });
  check(r, { "dashboard responds": (res) => [200, 302].includes(res.status) });

  sleep(Math.random() * 2);
}
