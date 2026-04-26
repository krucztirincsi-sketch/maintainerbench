export interface WorktreePlanOptions {
  readonly repoRoot: string;
  readonly taskId: string;
}

export interface WorktreePlan {
  readonly repoRoot: string;
  readonly branchName: string;
  readonly worktreePath: string;
}

export function createWorktreePlan(options: WorktreePlanOptions): WorktreePlan {
  const safeTaskId = options.taskId.replace(/[^a-zA-Z0-9._-]/g, "-");
  const branchName = `maintainerbench/${safeTaskId}`;

  return {
    repoRoot: options.repoRoot,
    branchName,
    worktreePath: `.maintainerbench/worktrees/${safeTaskId}`
  };
}
