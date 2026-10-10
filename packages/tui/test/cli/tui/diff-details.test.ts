import { expect, test } from "bun:test"
import { promptTextWithDiffDetails } from "../../../src/prompt/diff-details"

test("leaves /diff unchanged when --details is omitted", () => {
  expect(promptTextWithDiffDetails("/diff")).toBe("/diff")
})

test("turns /diff --details into a concise per-file explanation request", () => {
  const prompt = promptTextWithDiffDetails("/diff --details")

  expect(prompt).toContain("staged and unstaged git diffs")
  expect(prompt).toContain("untracked changed files")
  expect(prompt).toContain("2-3 concise sentences in plain English")
  expect(prompt).toContain("why it matters")
  expect(prompt).toContain("Do not reproduce the raw diff")
  expect(prompt).toContain("line-by-line recap")
})

test("leaves other /diff arguments unchanged", () => {
  expect(promptTextWithDiffDetails("/diff --other")).toBe("/diff --other")
})
