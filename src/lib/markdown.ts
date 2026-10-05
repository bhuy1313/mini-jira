/**
 * Markdown tokenizer cho mô tả task & comment (Backlog P1).
 *
 * An toàn theo thiết kế: tokenizer chỉ trả về token dạng dữ liệu thuần,
 * renderer (`src/components/ui/markdown.tsx`) dựng React element từ token —
 * không bao giờ đụng `dangerouslySetInnerHTML`, nên không có đường XSS từ nội
 * dung người dùng. Link được lọc theo allowlist protocol.
 */

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] }
  | { kind: "del"; children: InlineNode[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: InlineNode[] }
  | { kind: "mention"; value: string };

export type BlockNode =
  | { kind: "paragraph"; children: InlineNode[] }
  | { kind: "heading"; level: number; children: InlineNode[] }
  | { kind: "codeBlock"; value: string }
  | { kind: "blockquote"; children: BlockNode[] }
  | { kind: "list"; ordered: boolean; items: InlineNode[][] }
  | { kind: "hr" };

/** Thành viên có thể mention — chỉ cần tên hiển thị. */
export interface MentionCandidate {
  name: string;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^(`{3,}|~{3,})\s*([A-Za-z0-9_+.-]*)\s*$/;
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^\d{1,9}[.)]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const BLANK_RE = /^\s*$/;

/**
 * Inline theo thứ tự ưu tiên: code span > bold > italic > strike > link > mention.
 * Nhóm (1) code, (2)(3) bold, (4)(5) italic, (6) strike, (7)(8) link,
 * (9) ký tự đứng trước mention, (10) tên mention.
 *
 * Không dùng cờ `m`: `^` chỉ khớp đầu chuỗi, còn nhánh `[\s([{]` bắt buộc có
 * ký tự phân tách phía trước — nên `a@b.com` không bị nhận nhầm là mention.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildInlineRegex(members?: MentionCandidate[]): RegExp {
  const memberPatterns = (members ?? [])
    .map((m) => escapeRegex(m.name.trim()))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const mentionBranch =
    memberPatterns.length > 0
      ? `(^|[\\s([{])@(${memberPatterns.join("|")}|[A-Za-z0-9](?:[A-Za-z0-9._'-]*[A-Za-z0-9])?)`
      : "(^|[\\s([{])@([A-Za-z0-9](?:[A-Za-z0-9._'-]*[A-Za-z0-9])?)";

  const source =
    "`([^`\\n]+)`" +
    "|(\\*\\*|__)(?=\\S)([\\s\\S]*?\\S)\\2" +
    "|(\\*|_)(?=\\S)([\\s\\S]*?\\S)\\4" +
    "|~~(?=\\S)([\\s\\S]*?\\S)~~" +
    "|\\[([^\\]\\n]*)\\]\\(([^)\\s]+)\\)" +
    "|" +
    mentionBranch;

  return new RegExp(source, "g");
}

const SAFE_PROTOCOL_RE = /^(?:https?:|mailto:)/i;

/** Chỉ cho phép http/https/mailto và link tương đối; trả về null nếu nguy hiểm. */
export function sanitizeHref(rawHref: string): string | null {
  const href = rawHref.trim();
  if (!href) return null;
  // Link tương đối nội bộ: `/...`, `#...`, `./...` (loại trừ protocol-relative `//host`)
  if (/^[#/.]/.test(href) && !href.startsWith("//")) return href;
  return SAFE_PROTOCOL_RE.test(href) ? href : null;
}

/** Tokenize một đoạn inline (không có block). */
export function parseInline(src: string, members?: MentionCandidate[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Regex mới mỗi lần gọi: `parseInline` đệ quy nên `lastIndex` dùng chung sẽ hỏng.
  const re = buildInlineRegex(members);
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(src)) !== null) {
    // Vị trí 3 và 5 là delimiter của bold/italic (chỉ dùng cho backreference) → bỏ qua.
    const [full, code, , bold, , italic, strike, linkText, linkHref, mentionLead, mentionName] =
      match;

    // Nhánh mention ăn luôn ký tự phân tách phía trước — nối nó vào text liền kề
    // thay vì tách thành node text riêng, để output giữ nguyên chuỗi gốc.
    const leadLen = mentionName !== undefined ? (mentionLead?.length ?? 0) : 0;
    const textEnd = match.index + leadLen;
    if (textEnd > cursor) {
      nodes.push({ kind: "text", value: src.slice(cursor, textEnd) });
    }
    cursor = match.index + full.length;

    if (code !== undefined) {
      nodes.push({ kind: "code", value: code });
    } else if (bold !== undefined) {
      nodes.push({ kind: "strong", children: parseInline(bold, members) });
    } else if (italic !== undefined) {
      nodes.push({ kind: "em", children: parseInline(italic, members) });
    } else if (strike !== undefined) {
      nodes.push({ kind: "del", children: parseInline(strike, members) });
    } else if (linkHref !== undefined) {
      const href = sanitizeHref(linkHref);
      if (href) {
        nodes.push({ kind: "link", href, children: parseInline(linkText ?? "", members) });
      } else {
        // URL bị chặn: hiển thị phần text, không tạo link.
        nodes.push({ kind: "text", value: linkText ?? linkHref });
      }
    } else if (mentionName !== undefined) {
      nodes.push({ kind: "mention", value: mentionName });
    }
  }

  if (cursor < src.length) {
    nodes.push({ kind: "text", value: src.slice(cursor) });
  }

  return nodes;
}

function collectFence(lines: string[], from: number): { value: string; next: number } {
  const marker = FENCE_RE.exec(lines[from])?.[1] ?? "```";
  const body: string[] = [];
  let i = from + 1;
  while (i < lines.length && !lines[i].trimEnd().startsWith(marker)) {
    body.push(lines[i]);
    i += 1;
  }
  return { value: body.join("\n"), next: Math.min(i + 1, lines.length) };
}

/** Tokenize toàn bộ tài liệu Markdown thành block. */
export function parseMarkdown(src: string, members?: MentionCandidate[]): BlockNode[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (BLANK_RE.test(line)) {
      i += 1;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const { value, next } = collectFence(lines, i);
      blocks.push({ kind: "codeBlock", value });
      i = next;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, children: parseInline(heading[2], members) });
      i += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length) {
        const quotedLine = QUOTE_RE.exec(lines[i]);
        if (!quotedLine) break;
        quoted.push(quotedLine[1]);
        i += 1;
      }
      blocks.push({ kind: "blockquote", children: parseMarkdown(quoted.join("\n"), members) });
      continue;
    }

    const isOrdered = OL_RE.test(line);
    if (isOrdered || UL_RE.test(line)) {
      const itemRe = isOrdered ? OL_RE : UL_RE;
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const item = itemRe.exec(lines[i]);
        if (!item) break;
        items.push(parseInline(item[1], members));
        i += 1;
      }
      blocks.push({ kind: "list", ordered: isOrdered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && !startsBlock(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", children: parseInline(paragraph.join("\n"), members) });
    }
  }

  return blocks;
}

function startsBlock(line: string): boolean {
  return (
    BLANK_RE.test(line) ||
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    QUOTE_RE.test(line)
  );
}

const MENTION_QUERY_RE = /(?:^|[\s([{])@([A-Za-z0-9._'-]*)$/;

export interface MentionQuery {
  /** Vị trí của ký tự `@` trong chuỗi nguồn. */
  start: number;
  /** Chuỗi người dùng đã gõ sau `@` (có thể rỗng). */
  query: string;
}

/**
 * Dò mention đang gõ tại vị trí con trỏ — dùng cho autocomplete của editor.
 * Trả về null nếu con trỏ không nằm ngay sau một mention đang mở.
 */
export function findMentionQuery(src: string, caret: number): MentionQuery | null {
  if (caret <= 0 || caret > src.length) return null;
  const head = src.slice(0, caret);
  const match = MENTION_QUERY_RE.exec(head);
  if (!match) return null;
  const query = match[1] ?? "";
  const start = caret - query.length - 1;
  if (head[start] !== "@") return null;
  return { start, query };
}

/** Lọc danh sách thành viên theo query mention (không phân biệt hoa thường). */
export function filterMentionCandidates(
  members: MentionCandidate[],
  query: string,
  limit = 6,
): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  const pool = needle ? members.filter((m) => m.name.toLowerCase().includes(needle)) : members;
  return pool.slice(0, limit);
}