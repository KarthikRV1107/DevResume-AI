import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Language Detection ───────────────────────────────────────────────
interface LangSignature {
  keywords: RegExp[];
  patterns: RegExp[];
  name: string;
}

const LANG_SIGNATURES: LangSignature[] = [
  {
    name: "Python",
    keywords: [/\bdef\b/, /\bclass\b/, /\bimport\b/, /\bself\b/, /\bprint\s*\(/, /\basync\s+def\b/],
    patterns: [/:\s*$/, /^\s*#/, /\bNone\b/, /\bTrue\b/, /\bFalse\b/, /\bif\s+__name__\s*==/, /\bwith\b.*\bas\b/],
  },
  {
    name: "TypeScript",
    keywords: [/\binterface\b/, /\btype\b.*=/, /:\s*(string|number|boolean)\b/, /\benum\b/, /\bas\s+\w+/],
    patterns: [/\bconst\b/, /\blet\b/, /=>\s*{/, /import.*from/, /\.tsx?$/, /\bReact\b/, /\bPromise</],
  },
  {
    name: "JavaScript",
    keywords: [/\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/, /\basync\b/],
    patterns: [/=>\s*{/, /console\.log/, /require\(/, /module\.exports/, /\.then\(/, /\.catch\(/],
  },
  {
    name: "Java",
    keywords: [/\bpublic\b/, /\bprivate\b/, /\bclass\b/, /\bstatic\b/, /\bfinal\b/, /\babstract\b/],
    patterns: [/System\.out/, /\bvoid\b/, /\bString\b/, /\bnew\b.*\(/, /\@Override/, /\bextends\b/, /\bimplements\b/],
  },
  {
    name: "C++",
    keywords: [/\b#include\b/, /\bstd::/, /\bcout\b/, /\bnamespace\b/, /\bvirtual\b/],
    patterns: [/\bint\s+main/, /\bvector</, /\btemplate\b/, /\bconst\s+\w+\s*&/, /\bstd::unique_ptr/],
  },
  {
    name: "Go",
    keywords: [/\bfunc\b/, /\bpackage\b/, /\bfmt\./, /\bgo\b/, /\bdefer\b/],
    patterns: [/:=/, /\bchan\b/, /\bgoroutine\b/, /\berror\b/, /\binterface\s*{/],
  },
  {
    name: "Rust",
    keywords: [/\bfn\b/, /\blet\s+mut\b/, /\bimpl\b/, /\bstruct\b/, /\btrait\b/],
    patterns: [/->/, /\bmatch\b/, /\bOption</, /\bResult</, /\bpub\s+fn\b/, /\blifetime\b|'\w/],
  },
  {
    name: "C#",
    keywords: [/\busing\b/, /\bnamespace\b/, /\bclass\b/, /\bpublic\b/, /\basync\s+Task/],
    patterns: [/\bvar\b/, /\bawait\b/, /\bLINQ\b/, /\bIEnumerable/, /\bstring\./, /Console\.Write/],
  },
  {
    name: "PHP",
    keywords: [/\<\?php/, /\bfunction\b/, /\$\w+/, /\becho\b/],
    patterns: [/->/, /\barray\(/, /\bnew\b/, /\bclass\b/],
  },
  {
    name: "Ruby",
    keywords: [/\bdef\b/, /\bend\b/, /\bclass\b/, /\brequire\b/],
    patterns: [/\bdo\b.*\|/, /\battr_/, /\bputs\b/, /\byield\b/],
  },
  {
    name: "Swift",
    keywords: [/\bfunc\b/, /\bvar\b/, /\blet\b/, /\bguard\b/, /\bstruct\b/],
    patterns: [/\boptional\b/i, /\bif let\b/, /\bswitch\b/, /\bprotocol\b/],
  },
  {
    name: "Kotlin",
    keywords: [/\bfun\b/, /\bval\b/, /\bvar\b/, /\bdata\s+class\b/],
    patterns: [/\bwhen\b/, /\bcompanion\s+object\b/, /\bsuspend\b/, /\bcoroutine/i],
  },
];

function detectLanguage(code: string): string {
  let best = "Unknown";
  let bestScore = 0;
  for (const sig of LANG_SIGNATURES) {
    let score = 0;
    for (const kw of sig.keywords) if (kw.test(code)) score += 2;
    for (const p of sig.patterns) if (p.test(code)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = sig.name;
    }
  }
  return best;
}

// ─── Static Analysis ──────────────────────────────────────────────────
interface StaticIssue {
  type: "todo" | "stub" | "security" | "syntax" | "missing_return" | "empty_function" | "complexity" | "naming" | "error_handling" | "performance" | "dead_code" | "documentation";
  message: string;
  severity: "info" | "warning" | "error";
  line?: number;
}

function staticAnalyze(code: string, language: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = code.split("\n");

  // ── TODOs / FIXMEs / HACKs ──
  const todoRegex = /(?:#|\/\/|\/\*)\s*(TODO|FIXME|HACK|XXX|BUG):?\s*(.*)/gi;
  let match;
  while ((match = todoRegex.exec(code)) !== null) {
    const tag = match[1].toUpperCase();
    const task = match[2]?.trim() || `Unspecified ${tag}`;
    const lineNum = code.slice(0, match.index).split("\n").length;
    issues.push({
      type: "todo",
      message: `[${tag}] ${task}`,
      severity: tag === "FIXME" || tag === "BUG" ? "error" : "warning",
      line: lineNum,
    });
  }

  // ── Stubs & empty blocks ──
  const passCount = (code.match(/\bpass\b/g) || []).length;
  const emptyBodies = (code.match(/{\s*}/g) || []).length;
  const notImplemented = (code.match(/raise\s+NotImplementedError|throw\s+new\s+Error\(['"]not implemented/gi) || []).length;
  if (passCount > 0) issues.push({ type: "stub", message: `${passCount} pass statement(s) — unimplemented logic`, severity: "warning" });
  if (emptyBodies > 0) issues.push({ type: "empty_function", message: `${emptyBodies} empty block(s) — possible stub`, severity: "warning" });
  if (notImplemented > 0) issues.push({ type: "stub", message: `${notImplemented} NotImplementedError / throw — placeholder logic`, severity: "warning" });

  // ── Security ──
  if (/(?:secret|api_key|password|token|private_key|access_key)/i.test(code) && /["']\w{8,}["']/.test(code)) {
    issues.push({ type: "security", message: "Possible hardcoded secret or credential", severity: "error" });
  }
  if (/eval\s*\(/.test(code)) {
    issues.push({ type: "security", message: "Use of eval() — potential code injection risk", severity: "error" });
  }
  if (/innerHTML\s*=/.test(code)) {
    issues.push({ type: "security", message: "Direct innerHTML assignment — XSS risk", severity: "error" });
  }
  if (/\bexec\s*\(/.test(code) && language === "Python") {
    issues.push({ type: "security", message: "Use of exec() — arbitrary code execution risk", severity: "error" });
  }
  if (/dangerouslySetInnerHTML/.test(code)) {
    issues.push({ type: "security", message: "dangerouslySetInnerHTML used — ensure content is sanitized", severity: "warning" });
  }
  if (/\bhttp:\/\//.test(code) && !/localhost|127\.0\.0\.1/.test(code)) {
    issues.push({ type: "security", message: "Non-HTTPS URL detected — data may be transmitted insecurely", severity: "warning" });
  }

  // ── Syntax / Bracket Balance ──
  const opens = (code.match(/[({[]/g) || []).length;
  const closes = (code.match(/[)}\]]/g) || []).length;
  if (Math.abs(opens - closes) > 1) {
    issues.push({ type: "syntax", message: `Bracket imbalance (${opens} open vs ${closes} close)`, severity: "error" });
  }

  // ── Missing return statements ──
  if (["JavaScript", "TypeScript", "Java"].includes(language)) {
    const funcBlocks = code.match(/function\s+\w+[^{]*{[^}]*}/gs) || [];
    for (const block of funcBlocks) {
      if (!/\breturn\b/.test(block) && !/\bvoid\b/.test(block)) {
        const name = block.match(/function\s+(\w+)/)?.[1] || "anonymous";
        issues.push({ type: "missing_return", message: `Function '${name}' may be missing a return statement`, severity: "info" });
      }
    }
  }

  // ── Complexity: deeply nested code ──
  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;
    currentNesting += openBraces - closeBraces;
    if (currentNesting > maxNesting) maxNesting = currentNesting;
  }
  if (maxNesting > 5) {
    issues.push({ type: "complexity", message: `Deep nesting detected (${maxNesting} levels) — consider refactoring`, severity: "warning" });
  }

  // ── Long functions ──
  const funcStarts = [...code.matchAll(/\b(?:function|def|func|fn|fun)\s+\w+/g)];
  if (funcStarts.length > 0) {
    const avgFuncLen = Math.round(lines.length / funcStarts.length);
    if (avgFuncLen > 50) {
      issues.push({ type: "complexity", message: `Functions average ${avgFuncLen} lines — consider breaking into smaller units`, severity: "warning" });
    }
  }

  // ── Error handling ──
  const hasTryCatch = /\btry\b/.test(code);
  const hasThrow = /\bthrow\b|\braise\b/.test(code);
  const hasPromise = /\.then\(|async\s|await\s/.test(code);
  const hasCatch = /\.catch\(|\bcatch\b|\bexcept\b/.test(code);
  if (hasPromise && !hasCatch) {
    issues.push({ type: "error_handling", message: "Async code without error handling (.catch / try-catch)", severity: "warning" });
  }
  if (!hasTryCatch && lines.length > 30 && (language === "JavaScript" || language === "TypeScript")) {
    issues.push({ type: "error_handling", message: "No try-catch blocks — consider adding error boundaries", severity: "info" });
  }

  // ── Naming issues ──
  const singleCharVars = code.match(/\b(?:let|const|var|int|float|double)\s+([a-z])\b/g) || [];
  if (singleCharVars.length > 3) {
    issues.push({ type: "naming", message: `${singleCharVars.length} single-character variable names — hurts readability`, severity: "info" });
  }

  // ── Console / debug statements ──
  const consoleCount = (code.match(/console\.(log|debug|warn|info)\s*\(/g) || []).length;
  const printCount = language === "Python" ? (code.match(/\bprint\s*\(/g) || []).length : 0;
  const debugStmts = consoleCount + printCount;
  if (debugStmts > 5) {
    issues.push({ type: "dead_code", message: `${debugStmts} debug/print statements — remove before production`, severity: "info" });
  }

  // ── Commented-out code ──
  const commentedCode = lines.filter(l => {
    const t = l.trim();
    return (t.startsWith("//") || t.startsWith("#")) && 
           (/[=;{()}]/.test(t)) && 
           (!/TODO|FIXME|HACK|NOTE|XXX/i.test(t));
  }).length;
  if (commentedCode > 5) {
    issues.push({ type: "dead_code", message: `~${commentedCode} lines of commented-out code — consider removing`, severity: "info" });
  }

  // ── Documentation ──
  const docstrings = (code.match(/"""|'''|\/\*\*/g) || []).length;
  const jsdoc = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
  if (funcStarts.length > 3 && docstrings + jsdoc === 0) {
    issues.push({ type: "documentation", message: `${funcStarts.length} functions with no documentation — add docstrings/JSDoc`, severity: "info" });
  }

  // ── Performance ──
  if (/\bfor\b.*\bfor\b/s.test(code)) {
    issues.push({ type: "performance", message: "Nested loops detected — may cause O(n²) performance", severity: "info" });
  }
  if (/\.forEach\(.*\.forEach\(/s.test(code)) {
    issues.push({ type: "performance", message: "Nested forEach calls — consider restructuring for efficiency", severity: "info" });
  }
  if (/document\.querySelector|document\.getElementById/g.test(code)) {
    const domQueries = (code.match(/document\.(querySelector|getElementById|getElementsBy)/g) || []).length;
    if (domQueries > 5) {
      issues.push({ type: "performance", message: `${domQueries} direct DOM queries — consider caching or using a framework`, severity: "info" });
    }
  }

  // ── Unresolved questions in comments ──
  const questions = (code.match(/[#/]{1,2}.*\?/g) || []).length;
  if (questions > 0) {
    issues.push({ type: "todo", message: `${questions} unresolved question(s) in comments`, severity: "info" });
  }

  // ── Duplicate code detection (simple) ──
  const normalizedLines = lines.map(l => l.trim()).filter(l => l.length > 20 && !l.startsWith("//") && !l.startsWith("#") && !l.startsWith("import") && !l.startsWith("from"));
  const lineCounts: Record<string, number> = {};
  for (const l of normalizedLines) {
    lineCounts[l] = (lineCounts[l] || 0) + 1;
  }
  const duplicateLines = Object.entries(lineCounts).filter(([, c]) => c >= 3).length;
  if (duplicateLines > 0) {
    issues.push({ type: "complexity", message: `${duplicateLines} code pattern(s) repeated 3+ times — possible duplication`, severity: "warning" });
  }

  return issues;
}

// ─── Momentum Score (Enhanced) ────────────────────────────────────────
function calculateMomentum(code: string, issues: StaticIssue[]): number {
  const lines = code.split("\n");
  const codeLines = lines.filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("//"));
  const totalLines = Math.max(codeLines.length, 1);

  const todoCount = issues.filter((i) => i.type === "todo").length;
  const stubCount = issues.filter((i) => i.type === "stub" || i.type === "empty_function").length;
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const funcsDefined = (code.match(/\b(def|function|func|fn|fun)\s+\w+/g) || []).length;
  const classesCount = (code.match(/\bclass\s+\w+/g) || []).length;
  const structureScore = Math.min(25, (funcsDefined + classesCount) * 4);

  // Error handling bonus
  const hasTryCatch = /\btry\b/.test(code);
  const hasCatch = /\.catch\(|\bcatch\b|\bexcept\b/.test(code);
  const errorHandlingBonus = (hasTryCatch ? 5 : 0) + (hasCatch ? 3 : 0);

  // Documentation bonus
  const docstrings = (code.match(/"""|'''|\/\*\*/g) || []).length;
  const docBonus = Math.min(8, docstrings * 3);

  // Import/dependency organization
  const hasImports = /\bimport\b|\brequire\b|\b#include\b|\busing\b/.test(code);
  const importBonus = hasImports ? 3 : 0;

  // Test presence
  const hasTests = /\b(test|it|describe|expect|assert)\s*\(/.test(code);
  const testBonus = hasTests ? 8 : 0;

  // Type safety (TS/Java/Rust)
  const hasTypes = /:\s*(string|number|boolean|int|float|i32|u64)\b|\binterface\b|\btype\b.*=/.test(code);
  const typeBonus = hasTypes ? 5 : 0;

  // Penalties
  const todoPenalty = Math.min(20, todoCount * 4);
  const stubPenalty = Math.min(15, stubCount * 6);
  const errorPenalty = Math.min(15, errorCount * 5);
  const warningPenalty = Math.min(10, warningCount * 2);

  const lineScore = Math.min(25, Math.round((totalLines / 50) * 25));

  const raw = lineScore + structureScore + errorHandlingBonus + docBonus + importBonus + testBonus + typeBonus
    - todoPenalty - stubPenalty - errorPenalty - warningPenalty;
  return Math.max(5, Math.min(95, raw));
}

// ─── Code Metrics ─────────────────────────────────────────────────────
function computeMetrics(code: string, language: string) {
  const lines = code.split("\n");
  const totalLines = lines.length;
  const blankLines = lines.filter(l => l.trim() === "").length;
  const commentLines = lines.filter(l => {
    const t = l.trim();
    return t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("'''") || t.startsWith('"""');
  }).length;
  const codeLines = totalLines - blankLines - commentLines;

  const funcCount = (code.match(/\b(?:def|function|func|fn|fun)\s+\w+/g) || []).length;
  const classCount = (code.match(/\bclass\s+\w+/g) || []).length;
  const importCount = (code.match(/\b(?:import|require|#include|using)\b/g) || []).length;

  const commentRatio = totalLines > 0 ? Math.round((commentLines / totalLines) * 100) : 0;

  return {
    total_lines: totalLines,
    code_lines: codeLines,
    blank_lines: blankLines,
    comment_lines: commentLines,
    comment_ratio: commentRatio,
    functions: funcCount,
    classes: classCount,
    imports: importCount,
  };
}

// ─── SSE Helper ───────────────────────────────────────────────────────
function sseMessage(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Main Handler ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, language, explanation_level, stream } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code field is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (code.length > 500000) {
      return new Response(JSON.stringify({ error: "Code exceeds 500KB limit. Try uploading fewer files." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedLang = language || detectLanguage(code);
    const issues = staticAnalyze(code, detectedLang);
    const momentum = calculateMomentum(code, issues);
    const metrics = computeMetrics(code, detectedLang);
    const level = explanation_level || "Intermediate";

    // Smarter goal hint
    const classMatch = code.match(/class\s+(\w+)/);
    const funcMatches = code.match(/\b(?:def|function|func|fn|fun)\s+(\w+)/g) || [];
    const exportMatches = code.match(/export\s+(?:default\s+)?(?:function|class|const)\s+(\w+)/g) || [];
    const goalHint = classMatch
      ? `Build ${classMatch[1]} (${funcMatches.length} method(s), ${metrics.code_lines} lines)`
      : funcMatches.length > 0
      ? `Implement ${funcMatches.length} function(s) across ${metrics.code_lines} lines`
      : exportMatches.length > 0
      ? `Module with ${exportMatches.length} export(s)`
      : "Complete the code module";

    // Issue summary for AI
    const issueSummary = {
      errors: issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      info: issues.filter(i => i.severity === "info").length,
      types: [...new Set(issues.map(i => i.type))],
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const buildStaticResult = () => ({
      goal: goalHint,
      language: detectedLang,
      current_state: `${issues.length} issue(s) detected (${issueSummary.errors} errors, ${issueSummary.warnings} warnings)`,
      completion_percentage: momentum,
      effort_level: momentum > 65 ? "Low" : momentum > 35 ? "Medium" : "High",
      next_steps: [
        ...issues.filter(i => i.severity === "error").map(i => `🔴 Fix: ${i.message}`).slice(0, 3),
        ...issues.filter(i => i.severity === "warning").map(i => `🟡 Address: ${i.message}`).slice(0, 3),
        ...issues.filter(i => i.severity === "info").map(i => `💡 Consider: ${i.message}`).slice(0, 2),
      ].slice(0, 6) || ["Review and refactor existing logic"],
      risks: issues.filter(i => i.severity === "error").map(i => i.message).slice(0, 5),
      issues,
      confidence_score: 0.75,
      architectural_improvements: [],
      metrics,
      source: "static-analysis",
    });

    const systemPrompt = `You are DevResume AI, an elite-level code analysis engine used by senior engineers. Perform deep, precise analysis.

RULES:
- Be surgical — reference actual code patterns, variable names, and line-level issues
- Don't hallucinate features or patterns not present in the code
- Calibrate completion_percentage carefully: use ${momentum}% as baseline, adjust ±20 based on code quality
- Severity matters: prioritize errors > warnings > suggestions
- Consider: architecture, maintainability, testability, security, performance, and readability
- For next_steps: be specific and actionable (e.g. "Extract the validation logic in handleSubmit into a validateForm() helper")
- For risks: identify actual vulnerabilities, not generic advice
- architectural_improvements should suggest design pattern changes, not just code style

CONTEXT:
Language: ${detectedLang}
Code Lines: ${metrics.code_lines} | Functions: ${metrics.functions} | Classes: ${metrics.classes}
Comment Ratio: ${metrics.comment_ratio}%
Static Issues: ${issueSummary.errors} errors, ${issueSummary.warnings} warnings, ${issueSummary.info} info
Issue Types Found: ${issueSummary.types.join(", ")}
Detailed Issues: ${JSON.stringify(issues.slice(0, 15))}
Explanation Level: ${level}`;

    const userPrompt = `Analyze this ${detectedLang} code thoroughly:

\`\`\`${detectedLang.toLowerCase()}
${code.slice(0, 15000)}
\`\`\``;

    const toolSchema = {
      type: "function" as const,
      function: {
        name: "return_analysis",
        description: "Return the structured code analysis result with deep insights",
        parameters: {
          type: "object",
          properties: {
            goal: { type: "string", description: "What the code is trying to accomplish — be specific about the domain/feature" },
            explanation: { type: "string", description: "Detailed current state assessment (2-4 sentences)" },
            completion_percentage: { type: "number", description: `0-100 score. Baseline: ${momentum}%. Adjust ±20 based on code quality, completeness, and robustness` },
            effort_level: { type: "string", enum: ["Low", "Medium", "High"], description: "Effort to reach production-ready state" },
            next_steps: {
              type: "array",
              items: { type: "string" },
              description: "4-7 specific, actionable steps referencing actual code. Prefix with priority emoji: 🔴 critical, 🟡 important, 💡 nice-to-have",
            },
            risks: {
              type: "array",
              items: { type: "string" },
              description: "2-5 specific risks — security vulnerabilities, edge cases, scalability issues, breaking changes",
            },
            architectural_improvements: {
              type: "array",
              items: { type: "string" },
              description: "1-4 design pattern or architecture suggestions — e.g. 'Extract API layer', 'Add repository pattern', 'Introduce error boundary'",
            },
            code_quality_grade: {
              type: "string",
              enum: ["A", "B", "C", "D", "F"],
              description: "Overall code quality grade based on readability, maintainability, and best practices",
            },
            highlights: {
              type: "array",
              items: { type: "string" },
              description: "1-3 things the code does well — positive feedback",
            },
          },
          required: ["goal", "explanation", "completion_percentage", "effort_level", "next_steps", "risks", "architectural_improvements", "code_quality_grade", "highlights"],
          additionalProperties: false,
        },
      },
    };

    // ── Streaming path ──
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `Detected language: ${detectedLang}` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `${metrics.code_lines} code lines | ${metrics.functions} functions | ${metrics.classes} classes` })));
            controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: `Found ${issues.length} issue(s) — momentum ${momentum}%` })));

            if (!LOVABLE_API_KEY) {
              controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: "Running deep static analysis..." })));
              controller.enqueue(encoder.encode(sseMessage({ type: "result", data: buildStaticResult() })));
            } else {
              controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: "AI is analyzing patterns, architecture & code quality..." })));

              const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  tools: [toolSchema],
                  tool_choice: { type: "function", function: { name: "return_analysis" } },
                }),
              });

              if (!llmResponse.ok) {
                const status = llmResponse.status;
                controller.enqueue(encoder.encode(sseMessage({
                  type: "progress",
                  message: status === 429 ? "Rate limited — falling back to static analysis" : `AI error (${status}) — using static analysis`,
                })));
                controller.enqueue(encoder.encode(sseMessage({ type: "result", data: buildStaticResult() })));
              } else {
                controller.enqueue(encoder.encode(sseMessage({ type: "progress", message: "Processing AI insights..." })));

                const llmData = await llmResponse.json();
                const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
                let analysis: any;

                if (toolCall?.function?.arguments) {
                  analysis = typeof toolCall.function.arguments === "string"
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function.arguments;
                } else {
                  const content = llmData.choices?.[0]?.message?.content || "";
                  const jsonMatch = content.match(/\{[\s\S]*\}/);
                  analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
                }

                if (analysis) {
                  controller.enqueue(encoder.encode(sseMessage({
                    type: "result",
                    data: {
                      goal: analysis.goal || goalHint,
                      language: detectedLang,
                      current_state: analysis.explanation || `${issues.length} issue(s) detected`,
                      completion_percentage: Math.max(5, Math.min(95, analysis.completion_percentage ?? momentum)),
                      effort_level: analysis.effort_level || "Medium",
                      next_steps: analysis.next_steps || [],
                      risks: analysis.risks || [],
                      issues,
                      confidence_score: 0.94,
                      architectural_improvements: analysis.architectural_improvements || [],
                      code_quality_grade: analysis.code_quality_grade || null,
                      highlights: analysis.highlights || [],
                      metrics,
                      source: "llm-enhanced",
                    },
                  })));
                } else {
                  controller.enqueue(encoder.encode(sseMessage({ type: "result", data: buildStaticResult() })));
                }
              }
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            console.error("Stream error:", e);
            controller.enqueue(encoder.encode(sseMessage({ type: "error", message: e instanceof Error ? e.message : "Unknown error" })));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // ── Non-streaming path ──
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify(buildStaticResult()), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "return_analysis" } },
      }),
    });

    if (!llmResponse.ok) {
      const status = llmResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("LLM analysis failed");
    }

    const llmData = await llmResponse.json();
    const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: any;

    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = llmData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!analysis) throw new Error("Failed to parse LLM response");

    return new Response(
      JSON.stringify({
        goal: analysis.goal || goalHint,
        language: detectedLang,
        current_state: analysis.explanation || `${issues.length} issue(s) detected`,
        completion_percentage: Math.max(5, Math.min(95, analysis.completion_percentage ?? momentum)),
        effort_level: analysis.effort_level || "Medium",
        next_steps: analysis.next_steps || [],
        risks: analysis.risks || [],
        issues,
        confidence_score: 0.94,
        architectural_improvements: analysis.architectural_improvements || [],
        code_quality_grade: analysis.code_quality_grade || null,
        highlights: analysis.highlights || [],
        metrics,
        source: "llm-enhanced",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
