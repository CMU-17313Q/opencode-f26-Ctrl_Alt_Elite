const DIFF_DETAILS_PROMPT =
  "Summarize the current project's changes for later self-quizzing. Inspect the staged and unstaged git diffs and any untracked changed files. For each changed file, write 2-3 concise sentences in plain English explaining what changed and why it matters. Do not reproduce the raw diff, give a line-by-line recap, or turn this into a full code review."

export function promptTextWithDiffDetails(input: string) {
  if (input.trim() === "/diff --details") return DIFF_DETAILS_PROMPT
  return input
}
