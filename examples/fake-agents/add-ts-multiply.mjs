import { writeFileSync } from "node:fs";

writeFileSync(
  "examples/ts-library/src/index.ts",
  `export function add(left: number, right: number): number {
  return left + right;
}

export function multiply(left: number, right: number): number {
  return left * right;
}
`
);

writeFileSync(
  "examples/ts-library/test/index.test.ts",
  `import { describe, expect, it } from "vitest";
import { add, multiply } from "../src/index.js";

describe("math helpers", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("multiplies two numbers", () => {
    expect(multiply(2, 3)).toBe(6);
  });
});
`
);
