import type { QuestionAnswer, QuestionInfo } from "@opencode-ai/sdk/v2"

// Only quiz questions carry a correctAnswer; regular agent questions never produce feedback.
export function questionFeedback(question: QuestionInfo | undefined, answer: QuestionAnswer | undefined) {
  if (question?.correctAnswer === undefined) return
  const selected = answer?.[0]
  if (selected === undefined) return
  return {
    correct: selected === question.correctAnswer,
    correctAnswer: question.correctAnswer,
    // A missing or blank explanation is labelled unavailable instead of rendering an empty line (R4).
    explanation: question.explanation?.trim() ? question.explanation : "Explanation unavailable",
  }
}

export type QuestionFeedback = NonNullable<ReturnType<typeof questionFeedback>>

// Single-choice selection: the newest pick replaces the previous one for that question, so only the
// latest selection is ever graded. Other questions' answers are left untouched.
export function selectAnswer(answers: readonly QuestionAnswer[], tab: number, answer: string) {
  const next = [...answers]
  next[tab] = [answer]
  return next
}
