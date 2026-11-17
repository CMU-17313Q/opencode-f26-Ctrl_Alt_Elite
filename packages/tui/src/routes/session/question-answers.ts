import type { QuestionAnswer } from "@opencode-ai/sdk/v2"

// Single-choice pick: the new selection replaces the previous one for that question only.
// `locked` is true once feedback has been shown for the question; the answer can no longer change.
export function pickAnswer(answers: readonly (QuestionAnswer | undefined)[], tab: number, answer: string, locked = false) {
  const next = Array.from(answers, (existing) => existing ?? [])
  if (locked) return next
  next[tab] = [answer]
  return next
}

// Number of questions (out of `total`) that currently have at least one selected answer.
export function answeredCount(answers: readonly (QuestionAnswer | undefined)[], total: number) {
  return Array.from({ length: total }, (_, i) => (answers[i]?.length ?? 0) > 0).filter(Boolean).length
}

// The payload sent when the whole quiz is submitted: one entry per question, [] when unanswered.
export function replyAnswers(answers: readonly (QuestionAnswer | undefined)[], total: number) {
  return Array.from({ length: total }, (_, i) => answers[i] ?? [])
}
