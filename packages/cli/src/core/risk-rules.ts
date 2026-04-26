export type RiskLevel = "low" | "medium" | "high";

export interface RiskRule {
  readonly id: string;
  readonly level: RiskLevel;
  readonly description: string;
}

export const initialRiskRules: readonly RiskRule[] = [
  {
    id: "shell.curl-pipe-shell",
    level: "high",
    description: "Flags commands that pipe remote downloads directly into a shell."
  },
  {
    id: "shell.rm-rf",
    level: "high",
    description: "Flags recursive force deletion patterns."
  },
  {
    id: "secrets.environment-dump",
    level: "high",
    description: "Flags attempts to dump or expose environment secrets."
  },
  {
    id: "filesystem.path-traversal",
    level: "medium",
    description: "Flags paths that may escape the repository root."
  }
];
