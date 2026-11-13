import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import {
  checkAnswer,
  isQuizQuestionGrounded,
  isTrivialChange,
  validateQuiz,
} from "@/quiz/generator"

const nonEmptyLabelArb = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter(
    (value) =>
      value.trim().length > 0 &&
      value.trim() === value &&
      !/(?:^|[^a-z0-9_])(?:always|never|only)(?=$|[^a-z0-9_])/i.test(value),
  )

const identifierArb = fc.stringMatching(/[A-Za-z][A-Za-z0-9_]*/).filter((value) => value.length <= 24)
const validLabelsArb = fc.uniqueArray(nonEmptyLabelArb, { minLength: 2, maxLength: 5 })
const explanationArb = fc.string({ minLength: 1, maxLength: 80 }).filter((value) => value.trim().length > 0)

const makeQuiz = (labels: readonly string[], correctAnswer: string, questionText: string, explanation: string) => ({
  questions: [
    {
      question: questionText,
      options: labels.map((label) => ({
        label,
        description: `${label} description`,
      })),
      correctAnswer,
      explanation,
    },
  ],
})

describe("Quiz property-based validation", () => {
  // R1: Every quiz question must have at least two answer choices and exactly one correct answer, and the answer key must match an option label exactly.
  // Kind: invariant
  test("R1 accepts only valid answer sets and rejects mismatched keys", () => {
    fc.assert(
      fc.property(validLabelsArb, explanationArb, (labels, explanation) => {
        const questionText = "Why was the code changed?"
        const quiz = makeQuiz(labels, labels[0], questionText, explanation)
        expect(() => validateQuiz(quiz)).not.toThrow()
      }),
      { numRuns: 200 },
    )

    fc.assert(
      fc.property(validLabelsArb, explanationArb, (labels, explanation) => {
        const wrongAnswer = `${labels[0]}!`
        const quiz = makeQuiz(labels, wrongAnswer, "Why was the code changed?", explanation)
        expect(() => validateQuiz(quiz)).toThrow("exactly one correct answer")
      }),
      { numRuns: 200 },
    )
  })

  // R2: Questions must be about code changed in the diff, not untouched code.
  // Kind: invariant
  test("R2 rejects question text that names untouched identifiers from the diff", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("parseDate", "normalizePath", "renderUser"),
        fc.constantFrom("formatName", "saveConfig", "applyTheme"),
        explanationArb,
        (changedSymbol, untouchedSymbol, explanation) => {
          // fc.pre(changedSymbol !== untouchedSymbol)

          const diffAnalysis = `${changedSymbol} changed in utils.ts; ${untouchedSymbol} was untouched.`
          const groundedQuestion = {
            question: `What changed in ${changedSymbol}?`,
            options: [
              { label: `${changedSymbol} updated`, description: "The changed symbol was updated" },
              { label: `${untouchedSymbol} updated`, description: "The untouched symbol was updated" },
            ],
            correctAnswer: `${changedSymbol} updated`,
            explanation,
          }

          const ungroundedQuestion = {
            question: `What changed in ${untouchedSymbol}?`,
            options: [
              { label: `${changedSymbol} updated`, description: "The changed symbol was updated" },
              { label: `${untouchedSymbol} updated`, description: "The untouched symbol was updated" },
            ],
            correctAnswer: `${changedSymbol} updated`,
            explanation,
          }

          expect(isQuizQuestionGrounded(groundedQuestion, diffAnalysis)).toBe(true)
          expect(isQuizQuestionGrounded(ungroundedQuestion, diffAnalysis)).toBe(false)
        },
      ),
      { numRuns: 200 },
    )
  })

  // R3: If a change is fully reverted (no net difference from baseline), the quiz must not ask about the reverted code and reports there is nothing to quiz on.
  // Kind: model/oracle
  test("R3 treats empty and rename-only diffs as trivial and not quiz-worthy", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(""),
          fc.string({ minLength: 1, maxLength: 24 }).filter((value) => value.trim() === ""),
          fc.tuple(identifierArb, identifierArb).filter(([before, after]) => before !== after).map(([before, after]) => `${before} renamed to ${after}`),
        ),
        (analysis) => {
          expect(isTrivialChange(analysis)).toBe(true)
        },
      ),
      { numRuns: 200 },
    )
  })

  // R5: Changes that are only a variable rename, whitespace or formatting must not generate quiz questions (exception: a repo style rule).
  // Kind: metamorphic
  test("R5 rename-only changes stay trivial under a small, semantics-preserving edit", () => {
    fc.assert(
      fc.property(fc.tuple(identifierArb, identifierArb).filter(([before, after]) => before !== after), ([before, after]) => {
        const base = `${before} -> ${after}`
        const variant = `${before} => ${after}`
        expect(isTrivialChange(base)).toBe(true)
        expect(isTrivialChange(variant)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  // R7: The correct answer and feedback must match what the code actually does and use specific names from the diff. checkAnswer must mark only the key as correct.
  // Kind: invariant
  test("R7 preserves exact match semantics for checkAnswer", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 60 }), fc.string({ minLength: 0, maxLength: 60 }), (correctAnswer, selectedAnswer) => {
        const question = {
          question: "Which branch was used?",
          options: [
            { label: correctAnswer, description: "The right choice" },
            { label: "other option", description: "A distractor" },
          ],
          correctAnswer,
          explanation: "This matches the code path exactly.",
        }

        expect(checkAnswer(question, correctAnswer)).toBe(true)
        expect(checkAnswer(question, selectedAnswer)).toBe(selectedAnswer === correctAnswer)
      }),
      { numRuns: 200 },
    )
  })

  // R8: Questions must be multiple choice with plausible distractors and must not give away the answer: question text must not contain the correct answer, and no option may use extreme words (always, never, only).
  // Kind: invariant
  test("R8 rejects answer leaks and extreme wording in question text or options", () => {
    fc.assert(
      fc.property(nonEmptyLabelArb, explanationArb, (answer, explanation) => {
        const question = {
          question: `Why was ${answer} changed?`,
          options: [
            { label: answer, description: "The correct answer" },
            { label: "Alternative path", description: "A plausible distractor" },
          ],
          correctAnswer: answer,
          explanation,
        }

        expect(() => validateQuiz({ questions: [question] })).toThrow("must not contain the correct answer label")
      }),
      { numRuns: 200 },
    )

    fc.assert(
      fc.property(fc.constantFrom("always", "never", "only"), nonEmptyLabelArb, explanationArb, (extremeWord, label, explanation) => {
        const quiz = makeQuiz([`${extremeWord} ${label}`, "Second option"], `${extremeWord} ${label}`, "Why was the logic changed?", explanation)
        expect(() => validateQuiz(quiz)).toThrow("extreme wording")
      }),
      { numRuns: 200 },
    )
  })
})
