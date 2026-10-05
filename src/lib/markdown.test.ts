import { describe, expect, it } from "vitest";

import {
  filterMentionCandidates,
  findMentionQuery,
  parseInline,
  parseMarkdown,
  sanitizeHref,
  type BlockNode,
  type InlineNode,
} from "@/lib/markdown";

const inline = (src: string): InlineNode[] => parseInline(src);
const blocks = (src: string): BlockNode[] => parseMarkdown(src);

describe("sanitizeHref", () => {
  it("cho phép http, https, mailto và link tương đối nội bộ", () => {
    expect(sanitizeHref("https://example.com")).toBe("https://example.com");
    expect(sanitizeHref("http://example.com")).toBe("http://example.com");
    expect(sanitizeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(sanitizeHref("/workspaces/abc")).toBe("/workspaces/abc");
    expect(sanitizeHref("#task-1")).toBe("#task-1");
  });

  it("chặn javascript:, data: và protocol-relative", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref("JavaScript:alert(1)")).toBeNull();
    expect(sanitizeHref("data:text/html,<script>")).toBeNull();
    expect(sanitizeHref("//evil.example")).toBeNull();
    expect(sanitizeHref("   ")).toBeNull();
  });
});

describe("parseInline", () => {
  it("text thuần không đổi", () => {
    expect(inline("First comment from owner")).toEqual([
      { kind: "text", value: "First comment from owner" },
    ]);
  });

  it("code span không diễn giải markdown bên trong", () => {
    expect(inline("`**not bold**`")).toEqual([{ kind: "code", value: "**not bold**" }]);
  });

  it("bold, italic, strikethrough", () => {
    expect(inline("**a**")).toEqual([{ kind: "strong", children: [{ kind: "text", value: "a" }] }]);
    expect(inline("__a__")).toEqual([{ kind: "strong", children: [{ kind: "text", value: "a" }] }]);
    expect(inline("*a*")).toEqual([{ kind: "em", children: [{ kind: "text", value: "a" }] }]);
    expect(inline("_a_")).toEqual([{ kind: "em", children: [{ kind: "text", value: "a" }] }]);
    expect(inline("~~a~~")).toEqual([{ kind: "del", children: [{ kind: "text", value: "a" }] }]);
  });

  it("không khớp emphasis khi delimiter bám khoảng trắng", () => {
    expect(inline("2 * 3 * 4")).toEqual([{ kind: "text", value: "2 * 3 * 4" }]);
    expect(inline("a * b")).toEqual([{ kind: "text", value: "a * b" }]);
  });

  it("link an toàn và link bị chặn", () => {
    expect(inline("[docs](https://example.com/a)")).toEqual([
      { kind: "link", href: "https://example.com/a", children: [{ kind: "text", value: "docs" }] },
    ]);
    expect(inline("[click](javascript:alert1)")).toEqual([{ kind: "text", value: "click" }]);
  });

  it("link thiếu href giữ nguyên chữ gốc", () => {
    expect(inline("[a]()")).toEqual([{ kind: "text", value: "[a]()" }]);
  });

  it("mention ở đầu chuỗi và sau khoảng trắng, giữ lại ký tự phân tách", () => {
    expect(inline("@Owner")).toEqual([{ kind: "mention", value: "Owner" }]);
    expect(inline("cc @Owner")).toEqual([
      { kind: "text", value: "cc " },
      { kind: "mention", value: "Owner" },
    ]);
    expect(inline("(@Owner)")).toEqual([
      { kind: "text", value: "(" },
      { kind: "mention", value: "Owner" },
      { kind: "text", value: ")" },
    ]);
    expect(parseInline("Hello @Alice Member", [{ name: "Alice Member" }])).toEqual([
      { kind: "text", value: "Hello " },
      { kind: "mention", value: "Alice Member" },
    ]);
  });

  it("mention dừng trước dấu câu và không bắt nhầm email", () => {
    expect(inline("ping @Nam.")).toEqual([
      { kind: "text", value: "ping " },
      { kind: "mention", value: "Nam" },
      { kind: "text", value: "." },
    ]);
    expect(inline("mail dev@demo.com")).toEqual([{ kind: "text", value: "mail dev@demo.com" }]);
  });

  it("nhiều token trên cùng dòng giữ đúng thứ tự", () => {
    expect(inline("**bold** and `code` and @Ann")).toEqual([
      { kind: "strong", children: [{ kind: "text", value: "bold" }] },
      { kind: "text", value: " and " },
      { kind: "code", value: "code" },
      { kind: "text", value: " and " },
      { kind: "mention", value: "Ann" },
    ]);
  });

  it("parse lặp (bold chứa code) không bị vỡ lastIndex", () => {
    expect(inline("**a `b` c**")).toEqual([
      {
        kind: "strong",
        children: [
          { kind: "text", value: "a " },
          { kind: "code", value: "b" },
          { kind: "text", value: " c" },
        ],
      },
    ]);
  });

  it("dấu chưa đóng không vỡ chuỗi", () => {
    expect(inline("**oops")).toEqual([{ kind: "text", value: "**oops" }]);
    expect(inline("")).toEqual([]);
  });
});

describe("parseMarkdown", () => {
  it("tách đoạn văn theo dòng trống, giữ soft break", () => {
    expect(blocks("one\n\ntwo")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", value: "one" }] },
      { kind: "paragraph", children: [{ kind: "text", value: "two" }] },
    ]);
    expect(blocks("one\ntwo")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", value: "one\ntwo" }] },
    ]);
  });

  it("heading H1–H6", () => {
    expect(blocks("### Title")).toEqual([
      { kind: "heading", level: 3, children: [{ kind: "text", value: "Title" }] },
    ]);
  });

  it("fenced code block giữ nguyên nội dung", () => {
    expect(blocks("```ts\nconst a = 1;\n```")).toEqual([
      { kind: "codeBlock", value: "const a = 1;" },
    ]);
  });

  it("fenced code block chưa đóng vẫn render được", () => {
    expect(blocks("```\nraw")).toEqual([{ kind: "codeBlock", value: "raw" }]);
  });

  it("bullet list và ordered list", () => {
    expect(blocks("- a\n- b")).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [[{ kind: "text", value: "a" }], [{ kind: "text", value: "b" }]],
      },
    ]);
    expect(blocks("1. a\n2. b")).toEqual([
      {
        kind: "list",
        ordered: true,
        items: [[{ kind: "text", value: "a" }], [{ kind: "text", value: "b" }]],
      },
    ]);
  });

  it("blockquote lồng nhau", () => {
    expect(blocks("> quoted **bold**")).toEqual([
      {
        kind: "blockquote",
        children: [
          {
            kind: "paragraph",
            children: [
              { kind: "text", value: "quoted " },
              { kind: "strong", children: [{ kind: "text", value: "bold" }] },
            ],
          },
        ],
      },
    ]);
  });

  it("horizontal rule", () => {
    expect(blocks("---")).toEqual([{ kind: "hr" }]);
  });

  it("dòng đầu rỗng và CRLF không sinh block rác", () => {
    expect(blocks("\r\n\r\nhello\r\n")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", value: "hello" }] },
    ]);
  });

  it("chuỗi rỗng không sinh block nào", () => {
    expect(blocks("")).toEqual([]);
  });
});

describe("findMentionQuery", () => {
  it("tìm mention đang gõ ở đầu văn bản", () => {
    expect(findMentionQuery("@Ow", 3)).toEqual({ start: 0, query: "Ow" });
  });

  it("tìm mention sau khoảng trắng và trả về đúng vị trí `@`", () => {
    expect(findMentionQuery("cc @An", 6)).toEqual({ start: 3, query: "An" });
  });

  it("chấp nhận query rỗng ngay sau `@`", () => {
    expect(findMentionQuery("hi @", 4)).toEqual({ start: 3, query: "" });
  });

  it("trả null khi không phải mention hoặc đã đóng", () => {
    expect(findMentionQuery("hello world", 11)).toBeNull();
    expect(findMentionQuery("hi @Ann done", 13)).toBeNull();
    expect(findMentionQuery("mail dev@demo", 12)).toBeNull();
    expect(findMentionQuery("", 0)).toBeNull();
  });
});

describe("filterMentionCandidates", () => {
  const members = [
    { name: "Owner User" },
    { name: "Admin User" },
    { name: "Member User" },
  ];

  it("không query thì lấy tối đa limit thành viên đầu", () => {
    expect(filterMentionCandidates(members, "", 2)).toEqual(members.slice(0, 2));
  });

  it("lọc không phân biệt hoa thường", () => {
    expect(filterMentionCandidates(members, "admin")).toEqual([members[1]]);
  });

  it("giới hạn số kết quả", () => {
    expect(filterMentionCandidates(members, "user")).toHaveLength(3);
    expect(filterMentionCandidates(members, "user", 1)).toHaveLength(1);
  });

  it("không khớp thì trả mảng rỗng", () => {
    expect(filterMentionCandidates(members, "zzz")).toEqual([]);
  });
});