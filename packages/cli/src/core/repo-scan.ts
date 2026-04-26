export interface RepoScanOptions {
  readonly root: string;
  readonly include?: readonly string[];
}

export interface RepoScanResult {
  readonly root: string;
  readonly files: readonly string[];
  readonly skipped: readonly string[];
}

export async function scanRepository(options: RepoScanOptions): Promise<RepoScanResult> {
  return {
    root: options.root,
    files: [],
    skipped: ["Repository scanning is not implemented yet."]
  };
}
