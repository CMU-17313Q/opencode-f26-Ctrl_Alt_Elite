import { describe, expect, test } from "bun:test"
import { questionFeedback } from "../src/routes/session/question-feedback"

const quizQuestion = {
  question: "Why was the bounds check changed?",
  header: "Question 1",
  options: [
    { label: "Allow index 0", description: "Index 0 is a valid position" },
    { label: "Grow the array", description: "The array needs more room" },
  ],
  correctAnswer: "Allow index 0",
  explanation: "The bounds check was changed to allow index 0 as a valid position.",
  multiple: false,
  custom: false,
}

describe("questionFeedback", () => {
  test("marks the correct choice as correct and includes the explanation", () => {
    expect(questionFeedback(quizQuestion, ["Allow index 0"])).toEqual({
      correct: true,
      correctAnswer: "Allow index 0",
      explanation: "The bounds check was changed to allow index 0 as a valid position.",
    })
  })

  test("marks a wrong choice as incorrect and still reveals the correct answer", () => {
    expect(questionFeedback(quizQuestion, ["Grow the array"])).toEqual({
      correct: false,
      correctAnswer: "Allow index 0",
      explanation: "The bounds check was changed to allow index 0 as a valid position.",
    })
  })

  test("compares labels exactly", () => {
    expect(questionFeedback(quizQuestion, ["allow index 0"])?.correct).toBe(false)
    expect(questionFeedback(quizQuestion, ["Allow index 0 "])?.correct).toBe(false)
  })

  test("gives no feedback before the user has picked an answer", () => {
    expect(questionFeedback(quizQuestion, undefined)).toBeUndefined()
    expect(questionFeedback(quizQuestion, [])).toBeUndefined()
  })

  test("gives no feedback for regular agent questions without a correct answer", () => {
    expect(
      questionFeedback({ question: "Which database?", header: "Database", options: quizQuestion.options }, [
        "Allow index 0",
      ]),
    ).toBeUndefined()
  })

  test("gives no feedback when there is no current question", () => {
    expect(questionFeedback(undefined, ["Allow index 0"])).toBeUndefined()
  })

  test("falls back to an empty explanation when none was provided", () => {
    expect(questionFeedback({ ...quizQuestion, explanation: undefined }, ["Allow index 0"])?.explanation).toBe("")
  })
})
