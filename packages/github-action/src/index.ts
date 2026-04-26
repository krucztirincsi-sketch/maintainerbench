import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function run(): Promise<void> {
  const command = process.env["INPUT_COMMAND"] ?? "lint";

  console.log(`MaintainerBench GitHub Action placeholder: would run ${command}`);
  console.log("Agent execution and PR approval are not implemented.");
}

function isDirectRun(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];

  if (entrypoint === undefined) {
    return false;
  }

  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return pathToFileURL(entrypoint).href === moduleUrl;
  }
}

if (isDirectRun(import.meta.url)) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
