import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { FastCheck } from "effect/testing"
import { checkAnswer, validateQuiz, Quiz, QuizQuestion } from "@/quiz/generator"
import { Parameters } from "@/tool/quiz"

const text = (maxLength: number) =>
  FastCheck.string({ minLength: 1, maxLength }).filter((value) => value.trim().length > 0)

const label = text(100)
const description = text(200)
const explanation = text(500)
const twoUniqueLabels = FastCheck.tuple(label, label).filter(([a, b]) => a !== b)

// A question with two distinct labels where one of them is the correct answer.
const twoOptionQuestion = (explanation: string) =>
  FastCheck.tuple(description, twoUniqueLabels, FastCheck.boolean()).map(([question, [first, second], pickFirst]) => ({
    question,
    options: [
      { label: first, description: "desc" },
      { label: second, description: "desc" },
    ],
    correctAnswer: pickFirst ? first : second,
    explanation,
  }))

describe("QuizGenerator fuzz tests", () => {
  test("validateQuiz only ever throws Error instances on arbitrary input", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.array(FastCheck.anything()), (questions) => {
        // Deliberately bypass the type to simulate a malformed model response.
        expect(() => {
          try {
            validateQuiz({ questions } as unknown as Quiz)
          } catch (error) {
            if (!(error instanceof Error)) throw new Error("validateQuiz threw a non-Error value")
          }
        }).not.toThrow()
      }),
      { numRuns: 1000 },
    )
  })

  test("checkAnswer is deterministic and returns a boolean", () => {
    const question = FastCheck.record({
      question: FastCheck.string({ maxLength: 500 }),
      options: FastCheck.array(
        FastCheck.record({
          label: FastCheck.string({ maxLength: 200 }),
          description: FastCheck.string({ maxLength: 500 }),
        }),
        { maxLength: 10 },
      ),
      correctAnswer: FastCheck.string({ maxLength: 200 }),
      explanation: FastCheck.string({ maxLength: 500 }),
    })

    FastCheck.assert(
      FastCheck.property(question, FastCheck.string({ maxLength: 200 }), (item, selected) => {
        const result = checkAnswer(item, selected)
        expect(typeof result).toBe("boolean")
        expect(checkAnswer(item, selected)).toBe(result)
        expect(result).toBe(selected === item.correctAnswer)
      }),
      { numRuns: 1000 },
    )
  })

  test("QuizQuestion and Quiz schema decoding never throws on arbitrary input", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.anything(), (input) => {
        expect(["Some", "None"]).toContain(Schema.decodeUnknownOption(QuizQuestion)(input)._tag)
        expect(["Some", "None"]).toContain(Schema.decodeUnknownOption(Quiz)(input)._tag)
      }),
      { numRuns: 1000 },
    )
  })

  test("quiz tool Parameters accept any analysis string", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.string({ maxLength: 10000 }), (analysis) => {
        expect(Schema.decodeUnknownOption(Parameters)({ analysis })._tag).toBe("Some")
      }),
      { numRuns: 500 },
    )
  })

  test("validateQuiz rejects questions with fewer than two options", () => {
    FastCheck.assert(
      FastCheck.property(label, label, explanation, (only, correctAnswer, explanation) => {
        const quiz = {
          questions: [
            { question: "test", options: [{ label: only, description: "desc" }], correctAnswer, explanation },
          ],
        }
        expect(() => validateQuiz(quiz)).toThrow("at least two answer choices")
      }),
      { numRuns: 200 },
    )
  })

  test("validateQuiz rejects a correctAnswer that matches no option", () => {
    const input = FastCheck.tuple(label, label, label, description, explanation).filter(
      ([first, second, correctAnswer]) => first !== second && correctAnswer !== first && correctAnswer !== second,
    )

    FastCheck.assert(
      FastCheck.property(input, ([first, second, correctAnswer, description, explanation]) => {
        const quiz = {
          questions: [
            {
              question: "test",
              options: [
                { label: first, description },
                { label: second, description },
              ],
              correctAnswer,
              explanation,
            },
          ],
        }
        expect(() => validateQuiz(quiz)).toThrow("exactly one correct answer")
      }),
      { numRuns: 500 },
    )
  })

  test("validateQuiz rejects a correctAnswer that matches duplicate option labels", () => {
    FastCheck.assert(
      FastCheck.property(label, description, explanation, (duplicate, description, explanation) => {
        const quiz = {
          questions: [
            {
              question: "test",
              options: [
                { label: duplicate, description },
                { label: duplicate, description },
              ],
              correctAnswer: duplicate,
              explanation,
            },
          ],
        }
        expect(() => validateQuiz(quiz)).toThrow("exactly one correct answer")
      }),
      { numRuns: 200 },
    )
  })

  test("validateQuiz rejects an empty explanation", () => {
    FastCheck.assert(
      FastCheck.property(twoOptionQuestion(""), (question) => {
        expect(() => validateQuiz({ questions: [question] })).toThrow("explanation")
      }),
      { numRuns: 200 },
    )
  })

  // Documents a gap found by fuzzing: only the empty string is rejected, so a
  // whitespace-only explanation still passes validation.
  test("validateQuiz currently accepts a whitespace-only explanation", () => {
    FastCheck.assert(
      FastCheck.property(twoOptionQuestion("   "), (question) => {
        expect(() => validateQuiz({ questions: [question] })).not.toThrow()
      }),
      { numRuns: 200 },
    )
  })

  test("validateQuiz accepts valid quizzes with unique labels and one correct answer", () => {
    const question = FastCheck.tuple(
      description,
      FastCheck.uniqueArray(label, { minLength: 2, maxLength: 4 }),
      FastCheck.nat(),
      description,
      explanation,
    ).map(([question, labels, index, description, explanation]) => ({
      question,
      options: labels.map((item) => ({ label: item, description })),
      correctAnswer: labels[index % labels.length],
      explanation,
    }))

    FastCheck.assert(
      FastCheck.property(FastCheck.array(question, { minLength: 1, maxLength: 3 }), (questions) => {
        expect(() => validateQuiz({ questions })).not.toThrow()
      }),
      { numRuns: 200 },
    )
  })
})
