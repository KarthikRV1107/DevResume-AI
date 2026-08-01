import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_analysis",
  title: "Get analysis details",
  description:
    "Fetch one saved analysis by id, including next steps, risks, issues, security issues, dependency audit and compliance checks.",
  inputSchema: {
    id: z.string().uuid().describe("The analysis id returned by list_analyses."),
    include_code: z
      .boolean()
      .default(false)
      .describe("Include the analyzed source snapshot (can be very large)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, include_code }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const columns =
      "id, project_name, language, goal, source, current_state, completion_percentage, effort_level, confidence_score, next_steps, risks, issues, architectural_improvements, security_issues, dependency_audit, compliance_checks, total_files, total_size_bytes, created_at" +
      (include_code ? ", code" : "");

    const { data, error } = await supabase.from("analyses").select(columns).eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No analysis found with that id." }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { analysis: data },
    };
  },
});