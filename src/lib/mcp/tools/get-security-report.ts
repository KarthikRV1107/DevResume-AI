import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_security_report",
  title: "Get security report",
  description:
    "Aggregate security issues, dependency audit findings and compliance checks across the signed-in user's recent analyses.",
  inputSchema: {
    analysis_id: z
      .string()
      .uuid()
      .optional()
      .describe("Limit the report to one analysis. Omit to aggregate recent analyses."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(5)
      .describe("How many recent analyses to aggregate when analysis_id is omitted."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ analysis_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("analyses")
      .select("id, project_name, language, security_issues, dependency_audit, compliance_checks, created_at")
      .order("created_at", { ascending: false });
    query = analysis_id ? query.eq("id", analysis_id) : query.limit(limit ?? 5);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const count = (value: unknown) => (Array.isArray(value) ? value.length : 0);
    const report = {
      analyses: rows,
      totals: {
        security_issues: rows.reduce((sum, r) => sum + count(r.security_issues), 0),
        dependency_findings: rows.reduce((sum, r) => sum + count(r.dependency_audit), 0),
        compliance_checks: rows.reduce((sum, r) => sum + count(r.compliance_checks), 0),
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      structuredContent: report,
    };
  },
});