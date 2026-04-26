import { z } from "zod";

export const agentCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional()
});

export type AgentCommand = z.infer<typeof agentCommandSchema>;
