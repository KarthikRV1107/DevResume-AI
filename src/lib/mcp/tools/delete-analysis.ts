import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_analysis",
  title: "Delete analysis",
  description: "Permanently delete one of the signed-in user's saved analyses by id.",
  inputSchema: { id: z.string().uuid().describe("The analysis id to delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("analyses").delete().eq("id", id).select("id");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) {
      return { content: [{ type: "text", text: "No analysis was deleted (not found)." }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Deleted analysis ${id}.` }],
      structuredContent: { deleted_id: id },
    };
  },
});