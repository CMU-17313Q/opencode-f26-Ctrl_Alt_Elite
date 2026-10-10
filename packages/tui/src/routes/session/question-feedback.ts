import type { QuestionAnswer, QuestionInfo } from "@opencode-ai/sdk/v2"

// Only quiz questions carry a correctAnswer; regular agent questions never produce feedback.
export function questionFeedback(question: QuestionInfo | undefined, answer: QuestionAnswer | undefined) {
  if (question?.correctAnswer === undefined) return
  const selected = answer?.[0]
  if (selected === undefined) return
  return {
    correct: selected === question.correctAnswer,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation ?? "",
  }
}

export type QuestionFeedback = NonNullable<ReturnType<typeof questionFeedback>>
