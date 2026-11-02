import { readFileSync, appendFileSync } from "node:fs"

const file = process.argv[2] ?? "packages/opencode/coverage/lcov.info"
const threshold = Number(process.argv[3] ?? process.env.COVERAGE_THRESHOLD ?? 0)

// Exclude test files, dependencies, and generated code from the percentage
const ignore = [/(^|\/)test\//, /\.test\.[cm]?[jt]sx?$/, /node_modules/, /generated/, /\.gen\./]

let found = 0
let hit = 0
let files = 0
let skip = false

for (const line of readFileSync(file, "utf8").split("\n")) {
  if (line.startsWith("SF:")) {
    skip = ignore.some((r) => r.test(line.slice(3)))
    if (!skip) files++
  } else if (!skip && line.startsWith("LF:")) found += Number(line.slice(3))
  else if (!skip && line.startsWith("LH:")) hit += Number(line.slice(3))
}

const pct = found === 0 ? 0 : (hit / found) * 100
const ok = pct >= threshold
const msg = `Line coverage: ${pct.toFixed(2)}% (${hit}/${found} lines, ${files} source files). Threshold: ${threshold}%. ${ok ? "PASS" : "FAIL"}`
console.log(msg)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Coverage Gate\n\n${msg}\n`)
}
process.exit(ok ? 0 : 1)
