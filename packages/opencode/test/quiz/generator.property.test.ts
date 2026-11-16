// Project 4B property-based tests for Quiz Mode: Feedback and Explanations (amrashee).
// Traceability: traceability/amrashee.md
//
// These properties exercise the real backend quiz logic in src/quiz/generator.ts:
//   - validateQuiz(): the gate every generated quiz passes through before the quiz tool shows it
//   - checkAnswer(): grades a selected answer against the stored correct answer
import { describe, expect, test } from "bun:test"
import { FastCheck } from "effect/testing"
import { checkAnswer, validateQuiz } from "@/quiz/generator"

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// Labels mix arbitrary unicode with confusable edge cases (case, surrounding whitespace, empty string,
// unicode normalization variants) so grading and validation see answers that look alike but differ.
const edgeLabel = FastCheck.constantFrom("A", "a", "B", "", " ", "A ", " A", "é", "é", "true", "0")
const label = FastCheck.oneof(
  { weight: 3, arbitrary: FastCheck.string({ unit: "grapheme", maxLength: 40 }) },
  { weight: 1, arbitrary: edgeLabel },
)
const explanation = FastCheck.string({ minLength: 1, maxLength: 200 })

// A valid generated question: 2-8 unique labels and the correct answer at any position.
const validQuestion = FastCheck.record({
  labels: FastCheck.uniqueArray(label, { minLength: 2, maxLength: 8 }),
  correctIndex: FastCheck.nat(),
  explanation,
}).map((input) => ({
  question: "What changed in this diff?",
  options: input.labels.map((item) => ({ label: item, description: `Option ${item}` })),
  correctAnswer: input.labels[input.correctIndex % input.labels.length],
  explanation: input.explanation,
}))

// A possibly-invalid model response: labels drawn from a tiny pool so duplicates are common, and a
// correctAnswer drawn from the same pool so it matches zero, one, or several options. This explores the
// "LLM returned an inconsistent answer key" cases that R5 must guard against.
const pool = FastCheck.constantFrom("A", "B", "C", "a", "A ")
const looseQuestion = FastCheck.record({
  question: FastCheck.constant("What changed in this diff?"),
  options: FastCheck.array(
    pool.map((item) => ({ label: item, description: "desc" })),
    { minLength: 2, maxLength: 5 },
  ),
  correctAnswer: pool,
  explanation,
})

// ---------------------------------------------------------------------------
// R1 — Accurate Answer Evaluation
// "Quiz Mode must evaluate answers against the correct answer and display the appropriate result."
// Property type: INVARIANT
// ---------------------------------------------------------------------------
describe("R1 Accurate Answer Evaluation (invariant)", () => {
  test("R1: in every validated question, checkAnswer accepts exactly the correct option and rejects all others", () => {
    FastCheck.assert(
      FastCheck.property(validQuestion, (question) => {
        validateQuiz({ questions: [question] })
        const accepted = question.options.filter((option) => checkAnswer(question, option.label))
        expect(accepted.map((option) => option.label)).toEqual([question.correctAnswer])
      }),
      { numRuns: 1000 },
    )
  })

  test("R1: any answer that is not exactly the correct label is graded incorrect", () => {
    FastCheck.assert(
      FastCheck.property(validQuestion, label, (question, selected) => {
        expect(checkAnswer(question, selected)).toBe(selected === question.correctAnswer)
      }),
      { numRuns: 1000 },
    )
  })
})

// ---------------------------------------------------------------------------
// R5 — Consistent Correct Answers
// "Quiz Mode must keep the displayed correct answer consistent with the answer used for grading."
// Property type: INVARIANT
// ---------------------------------------------------------------------------
describe("R5 Consistent Correct Answers (invariant)", () => {
  test("R5: validateQuiz accepts a question only when its correct answer matches exactly one option", () => {
    FastCheck.assert(
      FastCheck.property(looseQuestion, (question) => {
        const matches = question.options.filter((option) => option.label === question.correctAnswer).length
        if (matches !== 1) {
          expect(() => validateQuiz({ questions: [question] })).toThrow("exactly one correct answer")
          return
        }
        expect(() => validateQuiz({ questions: [question] })).not.toThrow()
        // Once accepted, the answer used for grading is exactly the single displayed option it names.
        const graded = question.options.filter((option) => checkAnswer(question, option.label))
        expect(graded).toHaveLength(1)
        expect(graded[0].label).toBe(question.correctAnswer)
      }),
      { numRuns: 1000 },
    )
  })

  test("R5: one inconsistent question makes the whole quiz rejected, so it is never shown", () => {
    const quiz = FastCheck.tuple(
      FastCheck.array(validQuestion, { maxLength: 3 }),
      looseQuestion.filter(
        (question) => question.options.filter((option) => option.label === question.correctAnswer).length !== 1,
      ),
      FastCheck.nat(),
    ).map(([valid, bad, position]) => valid.toSpliced(position % (valid.length + 1), 0, bad))
    FastCheck.assert(
      FastCheck.property(quiz, (questions) => {
        expect(() => validateQuiz({ questions })).toThrow("exactly one correct answer")
      }),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// R4 — Handling Unavailable Explanations (revised in P4B, see traceability/amrashee.md)
// "If quiz generation fails, no quiz is displayed." The explanation is generated in the same model response
// as the questions, so an empty explanation is a failed generation: validateQuiz must reject the quiz.
// Property type: METAMORPHIC
// ---------------------------------------------------------------------------
describe("R4 Handling Unavailable Explanations (metamorphic)", () => {
  // 1-4 valid questions, and the position of the one question whose explanation will be emptied.
  const validQuiz = FastCheck.tuple(FastCheck.array(validQuestion, { minLength: 1, maxLength: 4 }), FastCheck.nat())

  test("R4: emptying one question's explanation turns an accepted quiz into a rejected one", () => {
    FastCheck.assert(
      FastCheck.property(validQuiz, ([questions, position]) => {
        expect(() => validateQuiz({ questions })).not.toThrow()
        const target = position % questions.length
        const failed = questions.map((question, index) =>
          index === target ? { ...question, explanation: "" } : question,
        )
        expect(() => validateQuiz({ questions: failed })).toThrow("Each quiz question must have an explanation")
      }),
      { numRuns: 1000 },
    )
  })
})

// ---------------------------------------------------------------------------
// R6 — Explanation Alongside Results
// "Quiz Mode must provide an explanation alongside the correct/incorrect result when a valid explanation is
// available." Acceptance: the feedback displays the result and a nonempty explanation.
// Property type: INVARIANT
// ---------------------------------------------------------------------------
describe("R6 Explanation Alongside Results (invariant)", () => {
  // Explanations as a model might return them: empty, whitespace-only, or real text. Mixed into otherwise
  // valid quizzes so validateQuiz sees every shape at every question position.
  const anyExplanation = FastCheck.oneof(
    FastCheck.constant(""),
    FastCheck.constantFrom(" ", "\t", "\n"),
    FastCheck.string({ unit: "grapheme", minLength: 1, maxLength: 200 }),
  )
  const mixedQuiz = FastCheck.array(
    FastCheck.tuple(validQuestion, anyExplanation).map(([question, value]) => ({ ...question, explanation: value })),
    { minLength: 1, maxLength: 4 },
  )

  test("R6: every quiz validateQuiz accepts has a nonempty explanation for every question", () => {
    FastCheck.assert(
      FastCheck.property(mixedQuiz, (questions) => {
        if (questions.some((question) => question.explanation.length === 0)) {
          expect(() => validateQuiz({ questions })).toThrow("Each quiz question must have an explanation")
          return
        }
        expect(() => validateQuiz({ questions })).not.toThrow()
      }),
      { numRuns: 1000 },
    )
  })
})
