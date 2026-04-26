import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const verificationCommandSchema = z.object({
  run: z.string().min(1),
  timeoutSeconds: z.number().int().positive().optional()
});

export const benchmarkTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  agent: z
    .object({
      command: z.string().min(1).optional()
    })
    .optional(),
  verify: z.array(verificationCommandSchema).default([])
});

export type BenchmarkTask = z.infer<typeof benchmarkTaskSchema>;

export function parseBenchmarkTaskYaml(source: string): BenchmarkTask {
  return benchmarkTaskSchema.parse(parseYaml(source));
}
