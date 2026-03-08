interface ExportableAnalysis {
  goal?: string | null;
  language?: string | null;
  current_state?: string | null;
  completion_percentage?: number | null;
  effort_level?: string | null;
  confidence_score?: number | null;
  next_steps?: string[];
  risks?: string[];
  issues?: { type: string; message: string; severity: string }[];
  architectural_improvements?: string[];
  code?: string;
  created_at?: string;
}

function toMarkdown(a: ExportableAnalysis): string {
  const lines: string[] = [];
  lines.push("# Code Analysis Report");
  if (a.created_at) lines.push(`> Generated: ${new Date(a.created_at).toLocaleString()}`);
  lines.push("");

  if (a.language) lines.push(`**Language:** ${a.language}`);
  if (a.confidence_score != null) lines.push(`**Confidence:** ${Math.round(Number(a.confidence_score) * 100)}%`);
  if (a.completion_percentage != null) lines.push(`**Completion:** ${a.completion_percentage}%`);
  if (a.effort_level) lines.push(`**Effort:** ${a.effort_level}`);
  lines.push("");

  if (a.goal) {
    lines.push("## Goal");
    lines.push(a.goal);
    lines.push("");
  }

  if (a.current_state) {
    lines.push("## Current State");
    lines.push(a.current_state);
    lines.push("");
  }

  if (a.next_steps && a.next_steps.length > 0) {
    lines.push("## Next Steps");
    a.next_steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push("");
  }

  if (a.risks && a.risks.length > 0) {
    lines.push("## Risks");
    a.risks.forEach((r) => lines.push(`- ⚠ ${r}`));
    lines.push("");
  }

  if (a.architectural_improvements && a.architectural_improvements.length > 0) {
    lines.push("## Architectural Improvements");
    a.architectural_improvements.forEach((imp) => lines.push(`- ${imp}`));
    lines.push("");
  }

  if (a.issues && a.issues.length > 0) {
    lines.push("## Issues");
    a.issues.forEach((issue) => lines.push(`- [${issue.severity}] ${issue.type}: ${issue.message}`));
    lines.push("");
  }

  if (a.code) {
    lines.push("## Code");
    lines.push("```");
    lines.push(a.code);
    lines.push("```");
  }

  return lines.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsMarkdown(analysis: ExportableAnalysis) {
  const md = toMarkdown(analysis);
  const name = (analysis.goal || "analysis").slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-");
  download(md, `${name}.md`, "text/markdown");
}

export function exportAsPDF(analysis: ExportableAnalysis) {
  const md = toMarkdown(analysis);
  // Build a styled HTML document for print-to-PDF
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Analysis Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { border-bottom: 2px solid #22c55e; padding-bottom: 8px; }
  h2 { color: #16a34a; margin-top: 24px; }
  blockquote { color: #666; border-left: 3px solid #22c55e; padding-left: 12px; margin-left: 0; }
  code, pre { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  pre { padding: 16px; overflow-x: auto; }
  ul, ol { padding-left: 20px; }
  li { margin-bottom: 4px; }
  strong { color: #0a0a0a; }
</style></head><body>${markdownToHtml(md)}</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^```\n?([\s\S]*?)```$/gm, "<pre><code>$1</code></pre>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      const isOrdered = /^\d/.test(md.slice(md.indexOf(match.trim().slice(4, 20)) - 3, md.indexOf(match.trim().slice(4, 20))));
      const tag = isOrdered ? "ol" : "ul";
      return `<${tag}>${match}</${tag}>`;
    })
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "\n");
}
