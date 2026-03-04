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
    keywords: [/\bdef\b/, /\bclass\b/, /\bimport\b/, /\bself\b/, /\bprint\s*\(/],
    patterns: [/:\s*$/, /^\s*#/, /\bNone\b/, /\bTrue\b/, /\bFalse\b/],
  },
  {
    name: "TypeScript",
    keywords: [/\binterface\b/, /\btype\b.*=/, /:\s*(string|number|boolean)\b/],
    patterns: [/\bconst\b/, /\blet\b/, /=>\s*{/, /import.*from/],
  },
  {
    name: "JavaScript",
    keywords: [/\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/],
    patterns: [/=>\s*{/, /console\.log/, /require\(/, /module\.exports/],
  },
  {
    name: "Java",
    keywords: [/\bpublic\b/, /\bprivate\b/, /\bclass\b/, /\bstatic\b/],
    patterns: [/System\.out/, /\bvoid\b/, /\bString\b/, /\bnew\b.*\(/],
  },
  {
    name: "C++",
    keywords: [/\b#include\b/, /\bstd::/, /\bcout\b/, /\bnamespace\b/],
    patterns: [/\bint\s+main/, /\bvector</, /\btemplate\b/],
  },
  {
    name: "Go",
    keywords: [/\bfunc\b/, /\bpackage\b/, /\bfmt\./, /\bgo\b/],
    patterns: [/:=/, /\bdefer\b/, /\bchan\b/, /\bgoroutine\b/],
  },
  {
    name: "Rust",
    keywords: [/\bfn\b/, /\blet\s+mut\b/, /\bimpl\b/, /\bstruct\b/],
    patterns: [/->/, /\bmatch\b/, /\bOption</, /\bResult</],
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
  type: "todo" | "stub" | "security" | "syntax" | "missing_return" | "empty_function";
  message: string;
  severity: "info" | "warning" | "error";
}

function staticAnalyze(code: string, language: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = code.split("\n");

  // TODOs
  const todoMatches = code.match(/#\s*TODO:?\s*(.*)/gi) || code.match(/\/\/\s*TODO:?\s*(.*)/gi) || [];
  for (const t of todoMatches) {
    const task = t.replace(/[#/]*\s*TODO:?\s*/i, "").trim();
    issues.push({ type: "todo", message: task || "Unspecified TODO", severity: "warning" });
  }

  // Stubs / empty blocks
  const passCount = (code.match(/\bpass\b/g) || []).length;
  const emptyBodies = (code.match(/{\s*}/g) || []).length;
  if (passCount > 0) issues.push({ type: "stub", message: `${passCount} pass statement(s) — unimplemented logic`, severity: "warning" });
  if (emptyBodies > 0) issues.push({ type: "empty_function", message: `${emptyBodies} empty block(s)`, severity: "warning" });

  // Security patterns
  if (/secret|api_key|password|token/i.test(code) && /["']\w{8,}["']/.test(code)) {
    issues.push({ type: "security", message: "Possible hardcoded secret or credential", severity: "error" });
  }
  if (/eval\s*\(/.test(code)) {
    issues.push({ type: "security", message: "Use of eval() detected — potential code injection", severity: "error" });
  }

  // Unmatched brackets (simple heuristic)
  const opens = (code.match(/[({[]/g) || []).length;
  const closes = (code.match(/[)}\]]/g) || []).length;
  if (Math.abs(opens - closes) > 1) {
    issues.push({ type: "syntax", message: `Bracket imbalance detected (${opens} open vs ${closes} close)`, severity: "error" });
  }

  // Missing returns (heuristic for JS/TS/Java)
  if (["JavaScript", "TypeScript", "Java"].includes(language)) {
    const funcBlocks = code.match(/function\s+\w+[^{]*{[^}]*}/gs) || [];
    for (const block of funcBlocks) {
      if (!/\breturn\b/.test(block) && !/\bvoid\b/.test(block)) {
        const name = block.match(/function\s+(\w+)/)?.[1] || "anonymous";
        issues.push({ type: "missing_return", message: `Function '${name}' may be missing a return statement`, severity: "info" });
      }
    }
  }

  // Questions in comments
  const questions = (code.match(/[#/]{1,2}.*\?/g) || []).length;
  if (questions > 0) {
    issues.push({ type: "todo", message: `${questions} unresolved question(s) in comments`, severity: "info" });
  }

  return issues;
}

// ─── Momentum Score ───────────────────────────────────────────────────
function calculateMomentum(code: string, issues: StaticIssue[]): number {
  const lines = code.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("//"));
  const totalLines = Math.max(lines.length, 1);

  const todoCount = issues.filter((i) => i.type === "todo").length;
  const stubCount = issues.filter((i) => i.type === "stub" || i.type === "empty_function").length;
  const errorCount = issues.filter((i) => i.severity === "error").length;

  // Functions/methods defined
  const funcsDefined = (code.match(/\b(def|function|func|fn)\s+\w+/g) || []).length;
  const classesCount = (code.match(/\bclass\s+\w+/g) || []).length;
  const structureScore = Math.min(30, (funcsDefined + classesCount) * 5);

  // Penalty
  const todoPenalty = Math.min(25, todoCount * 5);
  const stubPenalty = Math.min(20, stubCount * 7);
  const errorPenalty = Math.min(15, errorCount * 5);

  // Base from lines of actual code
  const lineScore = Math.min(30, Math.round((totalLines / 50) * 30));

  const raw = lineScore + structureScore - todoPenalty - stubPenalty - errorPenalty;
  return Math.max(5, Math.min(95, raw));
}

// ─── Main Handler ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, language, explanation_level } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code field is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (code.length > 50000) {
      return new Response(JSON.stringify({ error: "Code exceeds 50KB limit" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedLang = language || detectLanguage(code);
    const issues = staticAnalyze(code, detectedLang);
    const momentum = calculateMomentum(code, issues);
    const level = explanation_level || "Intermediate";

    // Extract structural info
    const classMatch = code.match(/class\s+(\w+)/);
    const funcMatches = code.match(/\b(?:def|function|func|fn)\s+(\w+)/g) || [];
    const goalHint = classMatch
      ? `Build ${classMatch[1]} with ${funcMatches.length} method(s)`
      : funcMatches.length > 0
      ? `Implement ${funcMatches.length} function(s)`
      : "Complete the code module";

    // Build LLM prompt
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to deterministic analysis without LLM
      const nextSteps: string[] = [];
      for (const issue of issues) {
        if (issue.type === "todo") nextSteps.push(issue.message);
        if (issue.type === "stub") nextSteps.push(issue.message);
      }
      if (nextSteps.length === 0) nextSteps.push("Review and refactor existing logic");

      return new Response(
        JSON.stringify({
          goal: goalHint,
          language: detectedLang,
          current_state: `${issues.length} issue(s) detected`,
          completion_percentage: momentum,
          effort_level: momentum > 60 ? "Low" : momentum > 30 ? "Medium" : "High",
          next_steps: nextSteps.slice(0, 5),
          risks: issues.filter((i) => i.severity === "error").map((i) => i.message).slice(0, 4),
          issues,
          confidence_score: 0.7,
          architectural_improvements: [],
          source: "static-analysis",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LLM-enhanced analysis
    const systemPrompt = `You are DevResume AI, a senior code analysis engine. Analyze the provided code context and return ONLY a JSON object with this exact schema — no markdown, no explanation outside JSON:
{
  "goal": "string — what the code is trying to accomplish",
  "explanation": "string — ${level}-level summary of current state",
  "completion_percentage": number (0-100, use ${momentum} as baseline, adjust ±15 max),
  "effort_level": "Low | Medium | High",
  "next_steps": ["string array — 3-5 actionable steps"],
  "risks": ["string array — 1-4 risks or issues"],
  "architectural_improvements": ["string array — 0-3 suggestions"]
}
Be precise. Do not hallucinate features not in the code.`;

    const userPrompt = `Language: ${detectedLang}
Static Analysis Issues: ${JSON.stringify(issues)}
Momentum Score: ${momentum}%
Goal Hint: ${goalHint}

Code:
\`\`\`
${code.slice(0, 8000)}
\`\`\``;

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
        tools: [
          {
            type: "function",
            function: {
              name: "return_analysis",
              description: "Return the structured code analysis result",
              parameters: {
                type: "object",
                properties: {
                  goal: { type: "string" },
                  explanation: { type: "string" },
                  completion_percentage: { type: "number" },
                  effort_level: { type: "string", enum: ["Low", "Medium", "High"] },
                  next_steps: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  architectural_improvements: { type: "array", items: { type: "string" } },
                },
                required: ["goal", "explanation", "completion_percentage", "effort_level", "next_steps", "risks", "architectural_improvements"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_analysis" } },
      }),
    });

    if (!llmResponse.ok) {
      const status = llmResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("LLM error:", status, await llmResponse.text());
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
      // Fallback: try parsing content as JSON
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
        completion_percentage: analysis.completion_percentage ?? momentum,
        effort_level: analysis.effort_level || "Medium",
        next_steps: analysis.next_steps || [],
        risks: analysis.risks || [],
        issues,
        confidence_score: 0.92,
        architectural_improvements: analysis.architectural_improvements || [],
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
