"use client";

import { useId, useRef, useState } from "react";

import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";
import {
  filterMentionCandidates,
  findMentionQuery,
  type MentionCandidate,
} from "@/lib/markdown";

/**
 * Markdown editor dùng chung cho mô tả task & comment (Backlog P1).
 *
 * - `textarea` vẫn là control thật của form (giữ `name`) nên server action đọc
 *   được Markdown gốc; preview chỉ là bản render read-only.
 * - Gõ `@` mở autocomplete danh sách thành viên, điều hướng bằng bàn phím.
 */

interface Tool {
  key: string;
  /** Nhãn ngắn hiển thị trên toolbar. */
  label: string;
  /** Tooltip + accessible name. */
  title: string;
  /** Bọc quanh selection (inline formatting). */
  wrap?: [string, string];
  /** Tiền tố đầu dòng (block formatting). */
  line?: string;
  /** Hậu tố cuối dòng, chỉ dùng khi selection nằm trong một dòng. */
  lineSuffix?: string;
  /** Văn bản mẫu chèn khi không có selection. */
  sample?: string;
  labelClassName?: string;
}

const TOOLS: Tool[] = [
  { key: "bold", label: "B", title: "Bold", wrap: ["**", "**"], sample: "bold text", labelClassName: "font-bold" },
  { key: "italic", label: "I", title: "Italic", wrap: ["*", "*"], sample: "italic text", labelClassName: "italic" },
  { key: "strike", label: "S", title: "Strikethrough", wrap: ["~~", "~~"], sample: "struck text", labelClassName: "line-through" },
  { key: "code", label: "</>", title: "Inline code", wrap: ["`", "`"], sample: "code" },
  { key: "codeblock", label: "{ }", title: "Code block", line: "```", lineSuffix: "```", sample: "code" },
  { key: "heading", label: "H", title: "Heading", line: "## ", sample: "Heading" },
  { key: "bullet", label: "•", title: "Bullet list", line: "- ", sample: "List item" },
  { key: "number", label: "1.", title: "Numbered list", line: "1. ", sample: "List item" },
  { key: "quote", label: "❝", title: "Quote", line: "> ", sample: "Quote" },
  { key: "link", label: "Link", title: "Insert link", wrap: ["[", "](https://)"], sample: "link text" },
];

function ToolbarButton({
  tool,
  onApply,
}: {
  tool: Tool;
  onApply: (tool: Tool) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onApply(tool)}
      title={tool.title}
      aria-label={tool.title}
      className={cn(
        "min-w-6 rounded px-1.5 py-0.5 text-xs text-ink-faint transition-colors hover:bg-paper hover:text-ink",
        tool.labelClassName,
      )}
    >
      {tool.label}
    </button>
  );
}

export function MarkdownEditor({
  name,
  defaultValue = "",
  ariaLabel,
  placeholder,
  rows = 3,
  members = [],
  compact = false,
  required,
  className,
}: {
  name: string;
  defaultValue?: string;
  ariaLabel: string;
  placeholder?: string;
  rows?: number;
  /** Thành viên workspace để autocomplete cho @mention. */
  members?: MentionCandidate[];
  compact?: boolean;
  required?: boolean;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();

  // Mirror giá trị để render preview; textarea vẫn uncontrolled để form submit
  // đúng giá trị và tương thích với autofill/fill() của Playwright.
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeOption, setActiveOption] = useState(0);

  const candidates = mentionStart === null ? [] : filterMentionCandidates(members, mentionQuery);
  const mentionOpen = mentionStart !== null && candidates.length > 0;

  function syncMention(el: HTMLTextAreaElement) {
    const found = findMentionQuery(el.value, el.selectionStart ?? 0);
    if (!found) {
      setMentionStart(null);
      return;
    }
    setMentionStart(found.start);
    setMentionQuery(found.query);
    setActiveOption(0);
  }

  function applyText(next: string, caret: number) {
    const el = textareaRef.current;
    if (!el) return;
    el.value = next;
    setValue(next);
    el.focus();
    el.setSelectionRange(caret, caret);
    syncMention(el);
  }

  function applyTool(tool: Tool) {
    const el = textareaRef.current;
    if (!el) return;
    const current = el.value;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = current.slice(start, end);

    if (tool.wrap) {
      const [open, close] = tool.wrap;
      const body = selected || (tool.sample ?? "");
      const next = `${current.slice(0, start)}${open}${body}${close}${current.slice(end)}`;
      applyText(next, start + open.length + body.length);
      return;
    }

    if (!tool.line) return;

    const lineStart = current.lastIndexOf("\n", start - 1) + 1;
    const lineBreak = current.indexOf("\n", end);
    const lineEnd = lineBreak === -1 ? current.length : lineBreak;

    if (selected.includes("\n")) {
      // Nhiều dòng: prefix từng dòng, không bọc hậu tố.
      const rewritten = current
        .slice(lineStart, lineEnd)
        .split("\n")
        .map((line) => `${tool.line}${line}`)
        .join("\n");
      applyText(`${current.slice(0, lineStart)}${rewritten}${current.slice(lineEnd)}`, start + tool.line.length);
      return;
    }

    const rewritten = `${tool.line}${selected || (tool.sample ?? "")}${tool.lineSuffix ?? ""}`;
    applyText(
      `${current.slice(0, lineStart)}${rewritten}${current.slice(lineEnd)}`,
      lineStart + tool.line.length + (selected || tool.sample || "").length,
    );
  }

  function acceptMention(candidate: MentionCandidate | undefined) {
    const el = textareaRef.current;
    if (!el || mentionStart === null || !candidate) return;
    const current = el.value;
    const caret = el.selectionStart ?? 0;
    const insertion = `@${candidate.name} `;
    applyText(`${current.slice(0, mentionStart)}${insertion}${current.slice(caret)}`, mentionStart + insertion.length);
    setMentionStart(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveOption((prev) => (prev + step + candidates.length) % candidates.length);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      acceptMention(candidates[activeOption] ?? candidates[0]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionStart(null);
    }
  }

  return (
    <div className={cn("relative rounded-md border border-rule bg-panel transition-colors focus-within:border-primary", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-rule px-1.5 py-1">
        {TOOLS.map((tool) => (
          <ToolbarButton key={tool.key} tool={tool} onApply={applyTool} />
        ))}

        <div className="ml-auto flex items-center gap-1 border-l border-rule pl-1.5">
          <button
            type="button"
            onClick={() => setPreview(false)}
            aria-pressed={!preview}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              preview ? "text-ink-faint hover:text-ink" : "bg-primary-soft text-primary-deep",
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            aria-pressed={preview}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              preview ? "bg-primary-soft text-primary-deep" : "text-ink-faint hover:text-ink",
            )}
          >
            Preview
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mentionOpen}
        aria-controls={mentionOpen ? listboxId : undefined}
        aria-activedescendant={
          mentionOpen ? `${optionIdPrefix}-${activeOption}` : undefined
        }
        onChange={(e) => {
          setValue(e.target.value);
          syncMention(e.target);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setMentionStart(null)}
        onKeyUp={(e) => syncMention(e.currentTarget)}
        onClick={(e) => syncMention(e.currentTarget)}
        className={cn(
          "block w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 text-ink outline-none placeholder:text-ink-faint",
          compact ? "text-[13px]" : "text-sm",
          preview && "sr-only",
        )}
      />

      {preview ? (
        <div className={cn("px-3 py-2", compact ? "min-h-14" : "min-h-20")}>
          {value.trim() ? (
            <Markdown source={value} members={members} />
          ) : (
            <p className="text-sm text-ink-faint">Nothing to preview yet.</p>
          )}
        </div>
      ) : null}

      {mentionOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Mention a workspace member"
          className="absolute left-1 z-30 mt-1 max-h-52 w-64 overflow-y-auto rounded-md border border-rule bg-panel py-1 shadow-lg"
        >
          {candidates.map((candidate, i) => (
            <li
              key={`${candidate.name}-${i}`}
              id={`${optionIdPrefix}-${i}`}
              role="option"
              aria-selected={i === activeOption}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveOption(i)}
              onClick={() => acceptMention(candidate)}
              className={cn(
                "cursor-pointer px-3 py-1.5 text-sm transition-colors",
                i === activeOption ? "bg-primary-soft text-primary-deep" : "text-ink-soft hover:bg-paper",
              )}
            >
              @{candidate.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}