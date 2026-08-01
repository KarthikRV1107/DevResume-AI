import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_analyses",
  title: "Search analyses",
  description:
    "Search the signed-in user's analyses by project name, goal or current state text.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to search for."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum results to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const escaped = query.replace(/[%,()]/g, " ").trim();
    const { data, error } = await supabase
      .from("analyses")
      .select("id, project_name, language, goal, current_state, completion_percentage, created_at")
      .or(
        `project_name.ilike.%${escaped}%,goal.ilike.%${escaped}%,current_state.ilike.%${escaped}%`,
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});