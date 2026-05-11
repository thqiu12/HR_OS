/**
 * Layout-aware text extraction from PDF.
 *
 * pdfjs-dist gives each text fragment with (x, y) coordinates. By grouping
 * fragments by Y (with tolerance) we reconstruct rows. Within a row, sorting
 * by X gives the visual reading order — even for 2-column 履歴書 templates.
 *
 * We also detect:
 *  - Label-value pairs ("氏名" left of "田中 花子")
 *  - Section headers (大きいフォント or boldフラグ)
 *  - Tables (multiple consistent column boundaries)
 *
 * Returns a tagged structure that the field extractor can use to find
 * "the value RIGHT OF the label「電話」" rather than guessing from flat text.
 */

export type LayoutItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
};

export type LayoutRow = {
  y: number;
  items: LayoutItem[];      // sorted by x
  text: string;             // joined text for fallback
};

export type LayoutDoc = {
  rows: LayoutRow[];
  pageWidth: number;
  pageHeight: number;
};

/** Convert raw pdfjs text content into structured rows. */
export function buildLayout(textContent: any, viewport: { width: number; height: number }): LayoutDoc {
  const items: LayoutItem[] = (textContent.items || [])
    .map((it: any) => {
      if (!("str" in it)) return null;
      const s = String(it.str);
      // Skip whitespace-only items (PDF often emits wide-space "items" as
      // column separators, which would otherwise glue adjacent text).
      if (!s.trim()) return null;
      const t = it.transform || [1, 0, 0, 1, 0, 0];
      const h = Number(it.height || Math.abs(t[3]) || 10);
      // pdfjs sometimes reports width=0 for CJK glyphs; estimate width from
      // height + character count (kanji ≈ height, ASCII ≈ height/2).
      let w = Number(it.width || 0);
      if (w <= 0) {
        let est = 0;
        for (const ch of s) {
          est += /[　-鿿가-힯]/.test(ch) ? h : h * 0.5;
        }
        w = est;
      }
      return {
        str: s,
        x: Number(t[4]),
        y: Number(t[5]),
        width: w,
        height: h,
        fontName: it.fontName,
      };
    })
    .filter(Boolean) as LayoutItem[];

  // Group items by Y. We use a 2-pass clustering: first sort all items by Y,
  // then merge into rows where consecutive Y values are within ~half-line-height.
  // This is more forgiving than fixed-bucket rounding when label/value rows
  // have slightly different baselines (common in 履歴書 templates).
  items.sort((a, b) => b.y - a.y); // top-down (high Y first)
  const rowMap = new Map<number, LayoutItem[]>();
  let lastBucket = Number.NaN;
  for (const it of items) {
    const lh = Math.max(8, it.height);
    if (Number.isNaN(lastBucket) || Math.abs(lastBucket - it.y) > lh * 0.9) {
      lastBucket = it.y;
    }
    if (!rowMap.has(lastBucket)) rowMap.set(lastBucket, []);
    rowMap.get(lastBucket)!.push(it);
  }

  // Sort rows by Y descending (PDF Y starts from bottom; visually top = high Y).
  // Cluster adjacent characters into "tokens" (small gap) and separate
  // tokens by larger horizontal gaps (column boundaries).
  const rows: LayoutRow[] = Array.from(rowMap.entries())
    .map(([y, rawItems]) => {
      rawItems.sort((a, b) => a.x - b.x);
      // Cluster tightly-packed items into single LayoutItem tokens.
      const merged: LayoutItem[] = [];
      for (const it of rawItems) {
        const last = merged[merged.length - 1];
        const lastRight = last ? last.x + last.width : -Infinity;
        const gap = it.x - lastRight;
        // Heuristic: cluster when gap is small relative to typical character pitch.
        // Use a generous absolute floor (28px) since pdfjs often reports height=8
        // for CJK glyphs even though the actual character pitch is ~25-30px.
        // Anything beyond is likely a column boundary in 履歴書 templates.
        const threshold = Math.max(28, (last?.height || it.height) * 2);
        if (last && gap >= 0 && gap < threshold) {
          last.str += it.str;
          last.width = it.x + it.width - last.x;
          last.height = Math.max(last.height, it.height);
        } else {
          merged.push({ ...it });
        }
      }
      // Build text: tokens separated by tab (column boundary signal)
      const text = merged.map((it) => it.str).join("\t").trim();
      return { y, items: merged, text };
    })
    .filter((r) => r.text.length > 0)
    .sort((a, b) => b.y - a.y);

  return { rows, pageWidth: viewport.width, pageHeight: viewport.height };
}

// Common labels that appear adjacent and should NOT be treated as values
const COMMON_LABELS = /^(?:氏\s*名|名\s*前|お名前|ふりがな|フリガナ|性別|生年月日|誕生日|電\s*話|TEL|FAX|携帯電話|連絡先|メール|E-?mail|住\s*所|現住所|国\s*籍|学\s*歴|職\s*歴|資\s*格|免\s*許|自己\s*PR|志望動機)$/i;

function isLabelOnly(s: string): boolean {
  return COMMON_LABELS.test(s.trim());
}

/** Find the label "氏名"/"電話"/etc and return the value text immediately to its right OR on the next line. */
export function valueAfterLabel(doc: LayoutDoc, labelPatterns: RegExp[]): string | null {
  for (let i = 0; i < doc.rows.length; i++) {
    const row = doc.rows[i];
    for (const re of labelPatterns) {
      const labelIdx = row.items.findIndex((it) => re.test(it.str));
      if (labelIdx < 0) continue;
      const label = row.items[labelIdx];

      // Build the candidate value by combining:
      //  - inSame: text after the label inside the same item (when clustering merged label + value)
      //  - rest: subsequent items on the same row, skipping any that look like other labels
      const inSame = label.str.replace(re, "").replace(/^[:：\s]+/, "").trim();
      const rest = row.items.slice(labelIdx + 1)
        .filter((it) => !isLabelOnly(it.str))
        .map((it) => it.str.replace(/^[:：\s]+/, "").trim())
        .filter((s) => s && !/^[:：]+$/.test(s));

      // If a sibling on this row IS a label (e.g. TEL ... 携帯電話 ... 080-...),
      // jump past it and take everything after.
      const beyondSiblingLabel = (() => {
        const sibLabelIdx = row.items.findIndex((it, idx) => idx > labelIdx && isLabelOnly(it.str));
        if (sibLabelIdx < 0) return null;
        const after = row.items.slice(sibLabelIdx + 1)
          .map((it) => it.str.replace(/^[:：\s]+/, "").trim())
          .filter((s) => s && !/^[:：]+$/.test(s));
        return after.length > 0 ? after.join(" ").trim() : null;
      })();

      const combined = [inSame, ...rest].filter(Boolean).join(" ").trim();
      if (combined && combined.length >= 1 && !labelPatterns.some((p) => p.test(combined))) {
        // If the value looks too short and there's a longer beyond-sibling-label value, prefer it
        if (beyondSiblingLabel && beyondSiblingLabel.length > combined.length * 1.5 && /\d/.test(beyondSiblingLabel)) {
          return beyondSiblingLabel;
        }
        return combined;
      }

      // Fallback to next-row value
      for (let j = i + 1; j < Math.min(i + 4, doc.rows.length); j++) {
        const nxt = doc.rows[j];
        if (COMMON_LABELS.test(nxt.text.split(/\s+/)[0]) && !nxt.items.some((it) => Math.abs(it.x - label.x) > label.width * 3)) {
          continue; // pure label row
        }
        const candidate = nxt.items.find((it) => Math.abs(it.x - label.x) < label.width + 30 || it.x > label.x);
        if (candidate && candidate.str.trim()) {
          const fromX = candidate.x;
          const v = nxt.items
            .filter((it) => it.x >= fromX - 1 && !isLabelOnly(it.str))
            .map((it) => it.str)
            .join(" ")
            .replace(/^[:：\s]+/, "")
            .trim();
          if (v) return v;
        }
      }
    }
  }
  return null;
}

/** Find rows that look like section headers (e.g. 学歴 / 職歴 / 資格). */
export function findSectionRanges(doc: LayoutDoc, sectionLabels: string[]): Map<string, [number, number]> {
  const result = new Map<string, [number, number]>();
  const indices: { label: string; idx: number }[] = [];
  for (let i = 0; i < doc.rows.length; i++) {
    const text = doc.rows[i].text;
    for (const label of sectionLabels) {
      if (new RegExp(`^[\\s・]*${label}\\s*$`).test(text) || new RegExp(`^[\\s・]*${label}\\s+`).test(text)) {
        indices.push({ label, idx: i });
        break;
      }
    }
  }
  for (let k = 0; k < indices.length; k++) {
    const start = indices[k].idx + 1;
    const end = k + 1 < indices.length ? indices[k + 1].idx : doc.rows.length;
    result.set(indices[k].label, [start, end]);
  }
  return result;
}

/** Concatenate all text in a row range, useful for free-text sections like 自己PR. */
export function rangeText(doc: LayoutDoc, range: [number, number]): string {
  return doc.rows.slice(range[0], range[1]).map((r) => r.text).join("\n");
}
