import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_foods",
  title: "Search the food database",
  description:
    "Search Gymie's Bangladeshi and general food database by English or Bangla name and return per-serving macros.",
  inputSchema: {
    query: z.string().describe("Food name to look for, English or Bangla."),
    limit: z.number().optional().describe("Max results. Defaults to 8."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const term = query.trim().replace(/[%,]/g, " ");
    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .or(`name.ilike.%${term}%,name_bn.ilike.%${term}%`)
      .limit(Math.max(1, Math.min(25, Math.round(limit ?? 8))));
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? []) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
