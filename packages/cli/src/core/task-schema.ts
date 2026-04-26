import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const verificationCommandSchema = z.object({
  run: z.string().min(1),
  timeoutSeconds: z.number().int().positive().optional()
});

const commandSchema = z.union([
  z.string().min(1).transform((run) => ({ run })),
  verificationCommandSchema
]);

const commandListSchema = z.array(commandSchema).default([]);

const commandSectionSchema = z
  .union([
    commandListSchema,
    z.object({
      commands: commandListSchema
    })
  ])
  .transform((value) => (Array.isArray(value) ? value : value.commands));

const riskConfigSchema = z.object({
  forbidden_paths: z.array(z.string().min(1)).default([]),
  max_files_changed: z.number().int().positive().optional(),
  require_tests: z.boolean().default(false)
});

export const benchmarkTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  setup: commandSectionSchema.default([]),
  agent: z
    .object({
      command: z.string().min(1).optional()
    })
    .optional(),
  verify: commandSectionSchema.default([]),
  risk: riskConfigSchema.default({
    forbidden_paths: [],
    require_tests: false
  })
});

export type BenchmarkTask = z.infer<typeof benchmarkTaskSchema>;

export function parseBenchmarkTaskYaml(source: string): BenchmarkTask {
  return benchmarkTaskSchema.parse(parseYaml(source));
}
