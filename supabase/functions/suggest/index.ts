import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 100_000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { code, analysis } = body;
    if (!code || !analysis) {
      return new Response(JSON.stringify({ error: "Missing code or analysis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct one credit before invoking the paid AI gateway
    const { error: creditErr } = await supa.rpc("deduct_user_credit");
    if (creditErr) {
      return new Response(JSON.stringify({ error: "No credits remaining" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cap = <T,>(arr: T[] | undefined): T[] => (Array.isArray(arr) ? arr.slice(0, 10) : []);
    const safeAnalysis = {
      goal: typeof analysis.goal === "string" ? analysis.goal.slice(0, 500) : "Unknown",
      language: typeof analysis.language === "string" ? analysis.language.slice(0, 50) : "Unknown",
      next_steps: cap<string>(analysis.next_steps).map((s) => String(s).slice(0, 500)),
      risks: cap<string>(analysis.risks).map((s) => String(s).slice(0, 500)),
      issues: cap<{ type?: string; message?: string }>(analysis.issues),
      architectural_improvements: cap<string>(analysis.architectural_improvements).map((s) =>
        String(s).slice(0, 500),
      ),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior code reviewer. Given source code and its analysis results, generate 2-4 concrete, actionable code fix suggestions.

For each suggestion:
- Give a short title (what it fixes/improves)
- Provide the improved code snippet (ready to copy-paste)
- Briefly explain why this change matters (1 sentence)

Return suggestions using the suggest_fixes tool.`;

    const userPrompt = `## Code
\`\`\`
${code.slice(0, 6000)}
\`\`\`

## Analysis
- Goal: ${safeAnalysis.goal}
- Language: ${safeAnalysis.language}
- Next steps: ${safeAnalysis.next_steps.join("; ")}
- Risks: ${safeAnalysis.risks.join("; ")}
- Issues: ${safeAnalysis.issues.map((i) => `${i?.type}: ${i?.message}`).join("; ")}
- Architectural improvements: ${safeAnalysis.architectural_improvements.join("; ")}

Generate fix suggestions based on the above analysis.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              name: "suggest_fixes",
              description: "Return 2-4 code fix suggestions.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short title of the fix" },
                        code: { type: "string", description: "The improved code snippet" },
                        explanation: { type: "string", description: "One-sentence explanation" },
                      },
                      required: ["title", "code", "explanation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_fixes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
