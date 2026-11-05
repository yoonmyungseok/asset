import { Fragment, type ReactNode } from "react";

// 모델이 생성한 텍스트는 HTML로 삽입하지 않고 안전한 React 요소로 변환한다.
function inline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-slate-100 px-1">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer noopener" className="text-blue-700 underline">{link[1]}</a>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

// 보고서에서 사용하는 제목, 문단, 목록, 표, 인용문과 코드 블록을 표시한다.
export function RunningMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const isSpecial = (line: string) => /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|```|(?:---+|\*\*\*+)\s*$)/.test(line);
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const key = i;
    if (/^\s*```/.test(line)) {
      const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<pre key={key} className="overflow-x-auto rounded bg-slate-100 p-3"><code>{code.join("\n")}</code></pre>); continue;
    }
    if (i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = cells(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(cells(lines[i++]));
      blocks.push(<div key={key} className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr>{header.map((cell, n) => <th key={n} className="border border-slate-200 bg-slate-50 p-2">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, n) => <tr key={n}>{header.map((_, j) => <td key={j} className="border border-slate-200 p-2">{inline(row[j] ?? "")}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const title = inline(heading[2]); const style = "font-bold text-slate-900";
      blocks.push(heading[1].length === 1 ? <h3 key={key} className={`text-lg ${style}`}>{title}</h3> : heading[1].length === 2 ? <h4 key={key} className={`text-base ${style}`}>{title}</h4> : <h5 key={key} className={style}>{title}</h5>); i++; continue;
    }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { blocks.push(<hr key={key} className="border-slate-200" />); i++; continue; }
    const list = line.match(/^\s*([-*+]|\d+[.)])\s+(.+)/);
    if (list) {
      const ordered = /^\d/.test(list[1]); const items: string[] = [];
      const pattern = ordered ? /^\s*\d+[.)]\s+(.+)/ : /^\s*[-*+]\s+(.+)/;
      let match: RegExpMatchArray | null;
      while (i < lines.length && (match = lines[i].match(pattern))) { items.push(match[1]); i++; }
      const children = items.map((item, n) => <li key={n}>{inline(item)}</li>);
      blocks.push(ordered ? <ol key={key} className="list-decimal space-y-1 pl-6">{children}</ol> : <ul key={key} className="list-disc space-y-1 pl-6">{children}</ul>); continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={key} className="border-l-4 border-slate-300 pl-3 text-slate-600">{inline(quote.join(" "))}</blockquote>); continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i]) && !(i + 1 < lines.length && isTableSeparator(lines[i + 1]))) paragraph.push(lines[i++].trim());
    // 인식하지 못한 마크다운도 텍스트로 남겨 반복을 방지한다.
    if (!paragraph.length) paragraph.push(lines[i++]);
    blocks.push(<p key={key} className="whitespace-pre-line">{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="space-y-3 break-words text-sm leading-6 text-slate-700">{blocks}</div>;
}
