import { describe, expect, test } from "bun:test"
import * as fc from "fast-check"
import { validateQuiz, checkAnswer, Quiz, QuizQuestion, QuizOption } from "@/quiz/generator"
import { Parameters } from "@/tool/quiz"
import { Schema } from "effect"

const nonEmptyNonWs = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)
const nonEmptyNonWs200 = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0)
const nonEmptyNonWs500 = fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0)

const twoUniqueLabels = fc.tuple(nonEmptyNonWs, nonEmptyNonWs).filter(([a, b]) => a !== b)

describe("QuizGenerator fuzz tests", () => {
  test("validateQuiz never crashes on arbitrary input", () => {
    fc.assert(
      fc.property(fc.array(fc.anything()), (input: unknown[]) => {
        try {
          validateQuiz({ questions: input as any })
        } catch (e) {
          expect(e).toBeInstanceOf(Error)
        }
      }),
      { numRuns: 1000 }
    )
  })

  test("checkAnswer is deterministic and returns boolean", () => {
    const arbitraryQuestion = fc.record({
      question: fc.string({ maxLength: 500 }),
      options: fc.array(
        fc.record({ label: fc.string({ maxLength: 200 }), description: fc.string({ maxLength: 500 }) }),
        { minLength: 0, maxLength: 10 }
      ),
      correctAnswer: fc.string({ maxLength: 200 }),
      explanation: fc.string({ maxLength: 500 }),
    })

    fc.assert(
      fc.property(arbitraryQuestion, fc.string({ maxLength: 200 }), (question, selected) => {
        const result = checkAnswer(question as any, selected)
        expect(typeof result).toBe("boolean")
        expect(checkAnswer(question as any, selected)).toBe(result)
      }),
      { numRuns: 1000 }
    )
  })

  test("QuizQuestion schema decoding never throws defects", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = Schema.decodeUnknownOption(QuizQuestion)(input)
        expect(typeof result._tag).toBe("string")
        expect(["Some", "None"]).toContain(result._tag)
      }),
      { numRuns: 1000 }
    )
  })

  test("Quiz schema decoding never throws defects", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = Schema.decodeUnknownOption(Quiz)(input)
        expect(typeof result._tag).toBe("string")
        expect(["Some", "None"]).toContain(result._tag)
      }),
      { numRuns: 1000 }
    )
  })

  test("Parameters schema handles arbitrary analysis strings without defects", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 10000 }), (analysis) => {
        const result = Schema.decodeUnknownOption(Parameters)({ analysis })
        expect(typeof result._tag).toBe("string")
        expect(["Some", "None"]).toContain(result._tag)
      }),
      { numRuns: 500 }
    )
  })

  test("validateQuiz rejects questions with < 2 options", () => {
    fc.assert(
      fc.property(
        nonEmptyNonWs,
        nonEmptyNonWs,
        nonEmptyNonWs500,
        (label, correctAnswer, explanation) => {
          const quiz = {
            questions: [
              {
                question: "test",
                options: [{ label, description: "desc" }],
                correctAnswer,
                explanation,
              },
            ],
          }
          expect(() => validateQuiz(quiz)).toThrow("at least two answer choices")
        }
      ),
      { numRuns: 200 }
    )
  })

  test("validateQuiz rejects when correctAnswer matches zero options", () => {
    const gen = fc.tuple(nonEmptyNonWs, nonEmptyNonWs, nonEmptyNonWs, nonEmptyNonWs200, nonEmptyNonWs500)
      .filter(([l1, l2, ca]) => l1 !== l2 && ca !== l1 && ca !== l2)
      .map(([l1, l2, ca, desc, expl]) => ({ l1, l2, ca, desc, expl }))

    fc.assert(
      fc.property(gen, ({ l1, l2, ca, desc, expl }) => {
        const quiz = {
          questions: [
            {
              question: "test",
              options: [
                { label: l1, description: desc },
                { label: l2, description: desc },
              ],
              correctAnswer: ca,
              explanation: expl,
            },
          ]
        }
        expect(() => validateQuiz(quiz)).toThrow("exactly one correct answer")
      }),
      { numRuns: 500 }
    )
  })

  test("validateQuiz rejects when correctAnswer matches multiple options (duplicate labels)", () => {
    fc.assert(
      fc.property(
        nonEmptyNonWs,
        nonEmptyNonWs200,
        nonEmptyNonWs500,
        (label, description, explanation) => {
          const quiz = {
            questions: [
              {
                question: "test",
                options: [
                  { label, description },
                  { label, description },
                ],
                correctAnswer: label,
                explanation,
              },
            ],
          }
          expect(() => validateQuiz(quiz)).toThrow("exactly one correct answer")
        }
      ),
      { numRuns: 200 }
    )
  })

  test("validateQuiz rejects only empty string explanation", () => {
    const gen = fc.tuple(nonEmptyNonWs200, twoUniqueLabels, fc.integer({ min: 0, max: 1 }))
      .map(([question, [l1, l2], idx]) => ({
        question,
        options: [
          { label: l1, description: "desc" },
          { label: l2, description: "desc" },
        ],
        correctAnswer: idx === 0 ? l1 : l2,
        explanation: "",
      }))

    fc.assert(
      fc.property(gen, (q) => {
        const quiz = { questions: [q] }
        expect(() => validateQuiz(quiz)).toThrow("explanation")
      }),
      { numRuns: 200 }
    )
  })

  test("validateQuiz accepts whitespace-only explanation (current behavior)", () => {
    const gen = fc.tuple(nonEmptyNonWs200, twoUniqueLabels, fc.integer({ min: 0, max: 1 }))
      .map(([question, [l1, l2], idx]) => ({
        question,
        options: [
          { label: l1, description: "desc" },
          { label: l2, description: "desc" },
        ],
        correctAnswer: idx === 0 ? l1 : l2,
        explanation: "   ",
      }))

    fc.assert(
      fc.property(gen, (q) => {
        const quiz = { questions: [q] }
        expect(() => validateQuiz(quiz)).not.toThrow()
      }),
      { numRuns: 200 }
    )
  })

  test("validateQuiz accepts valid quizzes with unique labels and non-empty fields", () => {
    const validQuestion = fc.tuple(
      nonEmptyNonWs200,
      fc.integer({ min: 2, max: 4 }).chain((n) => fc.array(nonEmptyNonWs, { minLength: n, maxLength: n }).filter((arr) => new Set(arr).size === n)),
      fc.integer({ min: 0, max: 3 }),
      nonEmptyNonWs200,
      nonEmptyNonWs500,
    ).map(([question, labels, correctIdx, description, explanation]) => ({
      question,
      options: labels.map((l) => ({ label: l, description })),
      correctAnswer: labels[correctIdx % labels.length],
      explanation,
    }))

    fc.assert(
      fc.property(
        fc.array(validQuestion, { minLength: 1, maxLength: 3 }),
        (questions) => {
          const quiz = { questions }
          expect(() => validateQuiz(quiz)).not.toThrow()
        }
      ),
      { numRuns: 200 }
    )
  })
})