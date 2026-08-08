import type { ReactNode } from "react";

/**
 * Small safe markdown → React renderer for LLM brief text.
 * Supports ### / ####, **bold**, `inline code`, ul/ol, ---, !!! urgent, tables, paragraphs.
 * Escapes via JSX text — never interprets raw HTML from the model.
 */

type InlinePart = string | { bold: string } | { code: string };

type Block =
  | { type: "h3" | "h4"; parts: InlinePart[] }
  | { type: "hr" }
  | { type: "urgent"; parts: InlinePart[] }
  | { type: "ul" | "ol"; items: InlinePart[][] }
  | { type: "table"; headers: InlinePart[][]; rows: InlinePart[][][] }
  | { type: "p"; parts: InlinePart[] };

function parseInlines(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Bold and inline code; process left-to-right so nested markers don't fight.
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[1] !== undefined) {
      parts.push({ bold: match[1] });
    } else {
      parts.push({ code: match[2]! });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length > 0 ? parts : [""];
}

function renderInlines(parts: InlinePart[]): ReactNode[] {
  return parts.map((part, i) => {
    if (typeof part === "string") {
      return <span key={i}>{part}</span>;
    }
    if ("bold" in part) {
      return <strong key={i}>{part.bold}</strong>;
    }
    return (
      <code key={i} className="brief-inline-code">
        {part.code}
      </code>
    );
  });
}

function cellPlainText(parts: InlinePart[]): string {
  return parts
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if ("bold" in part) {
        return part.bold;
      }
      return part.code;
    })
    .join("");
}

type DeltaDirection = "up" | "down" | "flat";

/**
 * Detect stock-style deltas in compact table cells only.
 * Matches arrows (↑↓→), signed % (+12% / -4%), and connector labels
 * (→ flat, ↑ new). Skips prose / mixed-signal cells so Key Signal stays uncolored.
 */
function detectDeltaDirection(text: string): DeltaDirection | null {
  const t = text.trim();
  if (t.length === 0 || t.length > 48) {
    return null;
  }

  // Leading arrow or sign, optional magnitude, optional short label.
  // e.g. ↑ 4%, ↓27%, → 0%, → flat, ↑ new, +12%, -3.5%, ↑ 18% vs prior day
  const leading = t.match(
    /^(?:([↑⬆▲])|([↓⬇▼])|([→➡▶←⬅◀])|([+-]))\s*(?:(\d+(?:\.\d+)?)\s*%?)?(?:\s+(?:vs\s+prior\s+(?:day|7d)|flat|new))?$/i,
  );
  if (leading) {
    const [, up, down, flat, sign, magnitude] = leading;
    if (flat) {
      return "flat";
    }
    if (up || sign === "+") {
      return magnitude !== undefined && Number.parseFloat(magnitude) === 0
        ? "flat"
        : "up";
    }
    if (down || sign === "-") {
      return magnitude !== undefined && Number.parseFloat(magnitude) === 0
        ? "flat"
        : "down";
    }
  }

  // Trailing arrow: 4% ↑ / 27%↓
  const trailing = t.match(
    /^(\d+(?:\.\d+)?)\s*%?\s*([↑⬆▲↓⬇▼→➡▶←⬅◀])$/,
  );
  if (trailing) {
    const arrow = trailing[2]!;
    if (/[→➡▶←⬅◀]/.test(arrow)) {
      return "flat";
    }
    if (/[↑⬆▲]/.test(arrow)) {
      return Number.parseFloat(trailing[1]!) === 0 ? "flat" : "up";
    }
    return Number.parseFloat(trailing[1]!) === 0 ? "flat" : "down";
  }

  // Bare 0% with no arrow — treat as flat when it's the whole cell.
  if (/^0+(?:\.0+)?\s*%$/.test(t)) {
    return "flat";
  }

  return null;
}

function deltaClassName(direction: DeltaDirection | null): string | undefined {
  if (direction === "up") {
    return "brief-delta-up";
  }
  if (direction === "down") {
    return "brief-delta-down";
  }
  if (direction === "flat") {
    return "brief-delta-flat";
  }
  return undefined;
}

function splitTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  // Require a leading pipe so prose like "A | B" is not treated as a table.
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function isTableSeparator(line: string): boolean {
  if (!isTableRow(line)) {
    return false;
  }
  const cells = splitTableCells(line);
  return (
    cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell))
  );
}

function isBlockBoundary(line: string): boolean {
  const next = line.trim();
  return (
    next === "" ||
    next === "---" ||
    next === "***" ||
    next === "___" ||
    /^#{3,4}\s+/.test(next) ||
    /^!!!\s+/.test(next) ||
    /^[-*]\s+/.test(next) ||
    /^\d+\.\s+/.test(next) ||
    isTableRow(next)
  );
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i]!.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const urgent = trimmed.match(/^!!!\s+(.+)$/);
    if (urgent) {
      blocks.push({ type: "urgent", parts: parseInlines(urgent[1]!) });
      i += 1;
      continue;
    }

    const h4 = trimmed.match(/^####\s+(.+)$/);
    if (h4) {
      blocks.push({ type: "h4", parts: parseInlines(h4[1]!) });
      i += 1;
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      blocks.push({ type: "h3", parts: parseInlines(h3[1]!) });
      i += 1;
      continue;
    }

    if (
      isTableRow(trimmed) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]!.trim())
    ) {
      const headers = splitTableCells(trimmed).map(parseInlines);
      i += 2;
      const rows: InlinePart[][][] = [];
      while (i < lines.length && isTableRow(lines[i]!.trim())) {
        if (isTableSeparator(lines[i]!.trim())) {
          i += 1;
          continue;
        }
        rows.push(splitTableCells(lines[i]!.trim()).map(parseInlines));
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      const items: InlinePart[][] = [];
      while (i < lines.length) {
        const itemMatch = lines[i]!.trim().match(/^[-*]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(parseInlines(itemMatch[1]!));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      const items: InlinePart[][] = [];
      while (i < lines.length) {
        const itemMatch = lines[i]!.trim().match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(parseInlines(itemMatch[1]!));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const next = lines[i]!.trim();
      if (paraLines.length > 0 && isBlockBoundary(next)) {
        break;
      }
      if (next === "") {
        break;
      }
      paraLines.push(next);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "p", parts: parseInlines(paraLines.join(" ")) });
    }
  }

  return blocks;
}

export function BriefProse({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h3":
            return <h3 key={i}>{renderInlines(block.parts)}</h3>;
          case "h4":
            return <h4 key={i}>{renderInlines(block.parts)}</h4>;
          case "hr":
            return <hr key={i} />;
          case "urgent":
            return (
              <p key={i} className="brief-urgent" role="status">
                {renderInlines(block.parts)}
              </p>
            );
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInlines(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInlines(item)}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={i} className="brief-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {block.headers.map((cell, j) => (
                        <th key={j}>{renderInlines(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className={deltaClassName(
                              detectDeltaDirection(cellPlainText(cell)),
                            )}
                          >
                            {renderInlines(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "p":
            return <p key={i}>{renderInlines(block.parts)}</p>;
        }
      })}
    </>
  );
}
