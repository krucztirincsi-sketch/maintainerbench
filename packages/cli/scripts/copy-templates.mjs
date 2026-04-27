import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const sourceDirectory = path.join(repositoryRoot, "templates");
const destinationDirectory = path.join(packageRoot, "dist", "templates");

await rm(destinationDirectory, { recursive: true, force: true });
await mkdir(path.dirname(destinationDirectory), { recursive: true });
await cp(sourceDirectory, destinationDirectory, { recursive: true });

console.log(`Copied templates to ${path.relative(packageRoot, destinationDirectory)}`);
