import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAnalysesTool from "./tools/list-analyses";
import getAnalysisTool from "./tools/get-analysis";
import searchAnalysesTool from "./tools/search-analyses";
import getSecurityReportTool from "./tools/get-security-report";
import deleteAnalysisTool from "./tools/delete-analysis";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "code-context-guardian",
  title: "Code Context Guardian",
  version: "0.1.0",
  instructions:
    "Tools for DevResume AI / Code Context Guardian. Use `list_analyses` or `search_analyses` to find the signed-in user's saved code analyses, `get_analysis` for full details of one, `get_security_report` for aggregated security, dependency and compliance findings, and `delete_analysis` to remove one.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listAnalysesTool,
    getAnalysisTool,
    searchAnalysesTool,
    getSecurityReportTool,
    deleteAnalysisTool,
  ],
});