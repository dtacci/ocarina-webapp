"use client";

import React from "react";

interface Props {
  children: string;
  className?: string;
}

/**
 * Tightly-scoped Markdown subset for notes + comments.
 *
 * Supported (intentionally narrow):
 *   - **bold**
 *   - *italic* / _italic_
 *   - `inline code`
 *   - [label](url)  (http / https / mailto only)
 *   - Soft line breaks preserved via whitespace-pre-wrap
 *
 * NOT supported (deliberate — keeps XSS surface to zero):
 *   - Raw HTML, images, tables, headings, lists
 *   - Nested formatting beyond one level deep
 *
 * Render goes straight to React nodes — no HTML string construction, no
 * dangerouslySetInnerHTML, no DOM-injection surface. Inputs that don't
 * cleanly match a token are emitted as plain text.
 */
export function SafeMarkdown({ children, className }: Props) {
  return (
    <span className={`whitespace-pre-wrap ${className ?? ""}`}>
      {renderInline(children)}
    </span>
  );
}

interface Token {
  /** Earliest start index in `text` where this token begins. */
  start: number;
  /** Index just past the token's end in `text`. */
  end: number;
  node: React.ReactNode;
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const tok = nextToken(text, i, () => `t${key++}`);
    if (!tok) {
      out.push(text.slice(i));
      break;
    }
    if (tok.start > i) out.push(text.slice(i, tok.start));
    out.push(tok.node);
    i = tok.end;
  }
  return out;
}

function nextToken(text: string, from: number, nextKey: () => string): Token | null {
  let best: Token | null = null;
  const candidates: ((s: number) => Token | null)[] = [
    (s) => matchDelimited(text, s, "**", (inner) => <strong key={nextKey()}>{inner}</strong>),
    (s) => matchDelimited(text, s, "`", (inner) => <code key={nextKey()} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{inner}</code>, /* raw */ true),
    (s) => matchSingleDelim(text, s, "*", (inner) => <em key={nextKey()}>{inner}</em>),
    (s) => matchSingleDelim(text, s, "_", (inner) => <em key={nextKey()}>{inner}</em>),
    (s) => matchLink(text, s, nextKey),
  ];
  for (const c of candidates) {
    const t = c(from);
    if (t && (!best || t.start < best.start)) best = t;
  }
  return best;
}

function matchDelimited(
  text: string,
  from: number,
  delim: string,
  build: (inner: React.ReactNode) => React.ReactNode,
  raw = false
): Token | null {
  const start = text.indexOf(delim, from);
  if (start < 0) return null;
  const end = text.indexOf(delim, start + delim.length);
  if (end < 0) return null;
  const innerText = text.slice(start + delim.length, end);
  if (innerText.length === 0) return null;
  const inner = raw ? innerText : innerText;
  return { start, end: end + delim.length, node: build(inner) };
}

function matchSingleDelim(
  text: string,
  from: number,
  delim: string,
  build: (inner: string) => React.ReactNode
): Token | null {
  // Skip pairs like ** which the bold matcher handles
  let i = from;
  while (i < text.length) {
    const start = text.indexOf(delim, i);
    if (start < 0) return null;
    // Don't match the first char of `**` as italic
    if (text[start + 1] === delim) { i = start + 2; continue; }
    const end = text.indexOf(delim, start + 1);
    if (end < 0) return null;
    if (text[end - 1] === delim || text[end + 1] === delim) { i = end + 1; continue; }
    const innerText = text.slice(start + 1, end);
    if (innerText.length === 0) { i = end + 1; continue; }
    return { start, end: end + 1, node: build(innerText) };
  }
  return null;
}

function matchLink(text: string, from: number, nextKey: () => string): Token | null {
  const open = text.indexOf("[", from);
  if (open < 0) return null;
  const closeBracket = text.indexOf("]", open + 1);
  if (closeBracket < 0) return null;
  if (text[closeBracket + 1] !== "(") return null;
  const closeParen = text.indexOf(")", closeBracket + 2);
  if (closeParen < 0) return null;
  const label = text.slice(open + 1, closeBracket);
  const url = text.slice(closeBracket + 2, closeParen).trim();
  if (!label || !url) return null;
  if (!isSafeUrl(url)) return null;
  return {
    start: open,
    end: closeParen + 1,
    node: (
      <a
        key={nextKey()}
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline decoration-foreground/40 underline-offset-2 hover:text-foreground"
      >
        {label}
      </a>
    ),
  };
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ["http:", "https:", "mailto:"].includes(u.protocol);
  } catch {
    return false;
  }
}
