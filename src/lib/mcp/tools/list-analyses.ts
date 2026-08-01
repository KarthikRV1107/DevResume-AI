import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_analyses",
  title: "List code analyses",
  description:
    "List the signed-in user's saved code analyses, newest first, with summary metrics (project name, language, completion, confidence).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many analyses to return."),
    language: z.string().trim().min(1).optional().describe("Filter by detected language, e.g. TypeScript."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, language }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("analyses")
      .select(
        "id, project_name, language, goal, source, completion_percentage, effort_level, confidence_score, total_files, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (language) query = query.ilike("language", language);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { analyses: data ?? [] },
    };
  },
});