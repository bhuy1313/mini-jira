import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  parseMarkdown,
  type BlockNode,
  type InlineNode,
  type MentionCandidate,
} from "@/lib/markdown";

/**
 * Read-only Markdown renderer.
 *
 * Token từ `@/lib/markdown` được dựng thẳng thành React element — không có
 * `dangerouslySetInnerHTML` nên nội dung người dùng không thể inject HTML.
 */

/** H1–H6 của markdown → thẻ h3–h5 để không phá thứ tự heading của trang. */
const HEADING_TAG = { 1: "h3", 2: "h3", 3: "h4", 4: "h4", 5: "h5", 6: "h5" } as const;
const HEADING_CLASS = {
  1: "mt-1 text-sm font-semibold text-ink",
  2: "mt-1 text-sm font-semibold text-ink",
  3: "mt-1 text-sm font-semibold text-ink-soft",
  4: "text-sm font-semibold text-ink-soft",
  5: "text-xs font-semibold uppercase tracking-wide text-ink-faint",
  6: "text-xs font-semibold uppercase tracking-wide text-ink-faint",
} as const;

const INLINE_CODE_CLASS =
  "rounded border border-rule bg-paper px-1 py-px font-mono text-[0.8em] text-accent-ink";

function renderInline(nodes: InlineNode[], members: MentionCandidate[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;

    switch (node.kind) {
      case "text":
        return <Fragment key={key}>{node.value}</Fragment>;

      case "strong":
        return <strong key={key}>{renderInline(node.children, members, key)}</strong>;

      case "em":
        return <em key={key}>{renderInline(node.children, members, key)}</em>;

      case "del":
        return <del key={key}>{renderInline(node.children, members, key)}</del>;

      case "code":
        return (
          <code key={key} className={INLINE_CODE_CLASS}>
            {node.value}
          </code>
        );

      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            {renderInline(node.children, members, key)}
          </a>
        );

      case "mention": {
        // Mention khớp thành viên workspace → chip; không khớp thì tô nhạt để
        // thấy ngay đây là tham chiếu tới người không còn trong workspace.
        const known = members.some((m) => m.name === node.value);
        return known ? (
          <span
            key={key}
            className="rounded bg-primary-soft px-1 font-medium text-primary-deep"
          >
            @{node.value}
          </span>
        ) : (
          <span key={key} className="text-accent-ink">
            @{node.value}
          </span>
        );
      }
    }
  });
}

function renderBlocks(blocks: BlockNode[], members: MentionCandidate[], keyPrefix: string): ReactNode[] {
  return blocks.map((block, i) => {
    const key = `${keyPrefix}-b${i}`;
    const nested = (nodes: BlockNode[]) => renderBlocks(nodes, members, key);

    switch (block.kind) {
      case "paragraph":
        return (
          <p key={key} className="whitespace-pre-wrap">
            {renderInline(block.children, members, key)}
          </p>
        );

      case "heading": {
        const Tag = HEADING_TAG[block.level as keyof typeof HEADING_TAG];
        return (
          <Tag key={key} className={HEADING_CLASS[block.level as keyof typeof HEADING_CLASS]}>
            {renderInline(block.children, members, key)}
          </Tag>
        );
      }

      case "codeBlock":
        return (
          <pre
            key={key}
            className="overflow-x-auto rounded-md border border-rule bg-paper p-3 font-mono text-xs leading-5 text-ink-soft"
          >
            <code>{block.value}</code>
          </pre>
        );

      case "blockquote":
        return (
          <blockquote
            key={key}
            className="space-y-2 border-l-2 border-rule-strong pl-3 text-ink-soft"
          >
            {nested(block.children)}
          </blockquote>
        );

      case "list": {
        const items = block.items.map((item, j) => (
          <li key={`${key}-l${j}`}>{renderInline(item, members, `${key}-l${j}`)}</li>
        ));
        return block.ordered ? (
          <ol key={key} className="list-decimal space-y-1 pl-5 marker:text-ink-faint">
            {items}
          </ol>
        ) : (
          <ul key={key} className="list-disc space-y-1 pl-5 marker:text-ink-faint">
            {items}
          </ul>
        );
      }

      case "hr":
        return <hr key={key} className="border-rule" />;
    }
  });
}

export function Markdown({
  source,
  members = [],
  className,
}: {
  source: string | null | undefined;
  /** Danh sách thành viên để nhận diện mention nào còn hợp lệ. */
  members?: MentionCandidate[];
  className?: string;
}) {
  if (!source?.trim()) return null;

  return (
    <div className={cn("space-y-2 text-sm leading-6 text-ink-soft", className)}>
      {renderBlocks(parseMarkdown(source, members), members, "md")}
    </div>
  );
}