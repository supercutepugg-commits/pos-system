import { readFileSync } from "node:fs";

const PREFIXES = ["feat", "fix", "refactor", "docs", "style", "chore", "test", "design"];
const [, , msgPath] = process.argv;
const firstLine = readFileSync(msgPath, "utf8").split("\n")[0].trim();

const pattern = new RegExp(`^(${PREFIXES.join("|")}): .+`);

if (!pattern.test(firstLine)) {
  console.error(
    `\n커밋 메시지 형식이 올바르지 않습니다: "${firstLine}"\n` +
      `형식: <prefix>: <요약>  (prefix: ${PREFIXES.join(", ")})\n` +
      `자세한 내용은 docs/commit-convention.md 참고\n`,
  );
  process.exit(1);
}
