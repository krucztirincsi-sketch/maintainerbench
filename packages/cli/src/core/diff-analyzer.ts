import type { RiskLevel } from "./risk-rules.js";

export interface DiffRiskFinding {
  readonly ruleId: string;
  readonly level: RiskLevel;
  readonly message: string;
}

export interface DiffAnalysis {
  readonly findings: readonly DiffRiskFinding[];
  readonly skipped: readonly string[];
}

export function analyzeDiff(diff: string): DiffAnalysis {
  void diff;

  return {
    findings: [],
    skipped: ["Diff analysis is not implemented yet."]
  };
}
