/**
 * Email templates for common HR events. Each template returns
 * { subject, html, text } given typed inputs. Plain HTML, no JSX.
 */

const baseUrl = () => process.env.APP_BASE_URL || "http://localhost:3010";
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const wrap = (title: string, body: string) => `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f8fb;padding:20px;margin:0">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(to right,#4f46e5,#6366f1);color:white;padding:20px 24px">
      <div style="font-weight:700;font-size:18px">${escapeHtml(title)}</div>
    </div>
    <div style="padding:24px;color:#1e293b;font-size:14px;line-height:1.7">
      ${body}
    </div>
    <div style="padding:12px 24px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center">
      ${process.env.EMAIL_REPLY_TO ? `お問い合わせ：${escapeHtml(process.env.EMAIL_REPLY_TO)}` : "HR OS"}
    </div>
  </div>
</body></html>`;

export type TemplateOutput = { subject: string; html: string; text: string };

export const TEMPLATES = {
  /** 応募ありがとうございます (auto-send when candidate is created) */
  applicationReceived(opts: { candidateName: string; jobTitle: string; schoolName: string }): TemplateOutput {
    const subject = `[${opts.schoolName}] ご応募ありがとうございます`;
    const text = `${opts.candidateName} 様\n\nこの度は「${opts.jobTitle}」へのご応募ありがとうございます。書類選考の結果は1週間以内にご連絡いたします。\n\n${opts.schoolName} 採用担当`;
    const html = wrap(subject, `
      <p>${escapeHtml(opts.candidateName)} 様</p>
      <p>この度は <b>${escapeHtml(opts.schoolName)}</b> の <b>「${escapeHtml(opts.jobTitle)}」</b> へのご応募ありがとうございます。</p>
      <p>書類選考の結果は <b>1週間以内</b> にご連絡いたします。今しばらくお待ちください。</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px">${escapeHtml(opts.schoolName)} 採用担当</p>
    `);
    return { subject, html, text };
  },

  /** 面接案内 */
  interviewSchedule(opts: { candidateName: string; round: string; scheduledAt: string; format: "online" | "offline"; location: string; durationMin: number; interviewers: string }): TemplateOutput {
    const dt = new Date(opts.scheduledAt).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const formatLabel = opts.format === "online" ? "オンライン" : "対面";
    const subject = `【面接のご案内】${opts.round} - ${dt}`;
    const text = `${opts.candidateName} 様\n\n${opts.round}を以下の日時で予定しております。\n\n日時：${dt} (${opts.durationMin}分)\n形式：${formatLabel}\n場所：${opts.location || "-"}\n面接官：${opts.interviewers || "-"}\n\nご質問等あればお気軽にご連絡ください。`;
    const html = wrap(subject, `
      <p>${escapeHtml(opts.candidateName)} 様</p>
      <p>下記の通り <b>${escapeHtml(opts.round)}</b> を予定しております。</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:6px 0;width:90px;color:#64748b">日時</td><td style="padding:6px 0;font-weight:600">${escapeHtml(dt)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">時間</td><td style="padding:6px 0">${opts.durationMin}分</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">形式</td><td style="padding:6px 0">${formatLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">${opts.format === "online" ? "URL" : "場所"}</td><td style="padding:6px 0">${escapeHtml(opts.location || "-")}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">面接官</td><td style="padding:6px 0">${escapeHtml(opts.interviewers || "-")}</td></tr>
      </table>
      <p>ご質問等あればお気軽にご連絡ください。</p>
    `);
    return { subject, html, text };
  },

  /** 内定通知 */
  jobOffer(opts: { candidateName: string; jobTitle: string; schoolName: string; salary?: string; startDate?: string; deadline?: string }): TemplateOutput {
    const subject = `🎉 【内定通知】${opts.schoolName} - ${opts.jobTitle}`;
    const text = `${opts.candidateName} 様\n\nこの度は採用面接にご参加いただきありがとうございました。慎重に選考を進めました結果、貴方を ${opts.jobTitle} としてお迎えしたく、内定をご連絡いたします。\n\n${opts.salary ? `給与：${opts.salary}\n` : ""}${opts.startDate ? `入社予定日：${opts.startDate}\n` : ""}${opts.deadline ? `回答期限：${opts.deadline}\n` : ""}`;
    const html = wrap(subject, `
      <p>${escapeHtml(opts.candidateName)} 様</p>
      <p>この度は採用面接にご参加いただきありがとうございました。</p>
      <p>慎重に選考を進めました結果、貴方を <b>${escapeHtml(opts.jobTitle)}</b> としてお迎えしたく、ここに内定をご連絡いたします。</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f0fdf4;padding:16px;border-radius:8px">
        ${opts.salary ? `<tr><td style="padding:6px 12px;width:120px;color:#166534">給与</td><td style="padding:6px 12px;font-weight:600">${escapeHtml(opts.salary)}</td></tr>` : ""}
        ${opts.startDate ? `<tr><td style="padding:6px 12px;color:#166534">入社予定日</td><td style="padding:6px 12px;font-weight:600">${escapeHtml(opts.startDate)}</td></tr>` : ""}
        ${opts.deadline ? `<tr><td style="padding:6px 12px;color:#166534">回答期限</td><td style="padding:6px 12px;font-weight:600">${escapeHtml(opts.deadline)}</td></tr>` : ""}
      </table>
      <p>ご検討のほど、よろしくお願い申し上げます。</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px">${escapeHtml(opts.schoolName)} 人事担当</p>
    `);
    return { subject, html, text };
  },

  /** 不採用通知 */
  rejection(opts: { candidateName: string; jobTitle: string; schoolName: string }): TemplateOutput {
    const subject = `[${opts.schoolName}] 選考結果のご連絡`;
    const text = `${opts.candidateName} 様\n\nこの度は「${opts.jobTitle}」へのご応募ありがとうございました。慎重に検討いたしましたが、誠に残念ながら今回は採用を見送らせていただくことになりました。\n\n貴方の今後のご活躍を心よりお祈り申し上げます。`;
    const html = wrap(subject, `
      <p>${escapeHtml(opts.candidateName)} 様</p>
      <p>この度は <b>「${escapeHtml(opts.jobTitle)}」</b> へのご応募ありがとうございました。</p>
      <p>慎重に検討いたしましたが、誠に残念ながら、今回は採用を見送らせていただくことになりました。</p>
      <p>貴方の今後のご活躍を心よりお祈り申し上げます。</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px">${escapeHtml(opts.schoolName)} 人事担当</p>
    `);
    return { subject, html, text };
  },

  /** 入社書類リマインダー */
  onboardingReminder(opts: { candidateName: string; missingDocs: string[]; expectedJoinDate: string; portalUrl: string }): TemplateOutput {
    const subject = `[要対応] 入社書類のご提出をお願いします`;
    const text = `${opts.candidateName} 様\n\n入社予定日 ${opts.expectedJoinDate} まで、あと少しです。以下の書類が未提出となっております。\n\n${opts.missingDocs.map((d) => "・" + d).join("\n")}\n\n下記URLからアップロードをお願いします。\n${opts.portalUrl}`;
    const html = wrap(subject, `
      <p>${escapeHtml(opts.candidateName)} 様</p>
      <p>入社予定日 <b>${escapeHtml(opts.expectedJoinDate)}</b> まで、あと少しです。<br>以下の書類が未提出となっております。</p>
      <ul style="background:#fef3c7;padding:16px 32px;border-radius:8px">
        ${opts.missingDocs.map((d) => `<li style="margin:4px 0">${escapeHtml(d)}</li>`).join("")}
      </ul>
      <p style="margin-top:16px"><a href="${opts.portalUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">📤 書類をアップロード</a></p>
    `);
    return { subject, html, text };
  },
};

export type TemplateName = keyof typeof TEMPLATES;
export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  applicationReceived: "応募受付通知",
  interviewSchedule: "面接案内",
  jobOffer: "内定通知",
  rejection: "不採用通知",
  onboardingReminder: "入社書類リマインダー",
};
