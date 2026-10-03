import { describe, expect, test } from "bun:test"
import { checkAnswer, validateQuiz } from "@/quiz/generator"

describe("QuizGenerator validation", () => {
  test("accepts a quiz with multiple choices and one matching correct answer", () => {
    expect(() =>
      validateQuiz({
        questions: [
          {
            question: "Why was the bounds check changed?",
            options: [
              {
                label: "Allow index 0",
                description: "Index 0 is a valid position",
              },
              {
                label: "Increase array size",
                description: "Changes the array size",
              },
            ],
            correctAnswer: "Allow index 0",
            explanation: "The bounds check was changed to allow index 0 as a valid position.",
          },
        ],
      }),
    ).not.toThrow()
  })

  test("rejects a question with fewer than two choices", () => {
    expect(() =>
      validateQuiz({
        questions: [
          {
            question: "What changed?",
            options: [
              {
                label: "One choice",
                description: "Only one option exists",
              },
            ],
            correctAnswer: "One choice",
            explanation: "Only one choice provided.",
          },
        ],
      }),
    ).toThrow("Quiz questions must contain at least two answer choices")
  })

  test("rejects a question when the correct answer does not match an option", () => {
    expect(() =>
      validateQuiz({
        questions: [
          {
            question: "What changed?",
            options: [
              {
                label: "Choice A",
                description: "First option",
              },
              {
                label: "Choice B",
                description: "Second option",
              },
            ],
            correctAnswer: "Choice C",
            explanation: "This should fail.",
          },
        ],
      }),
    ).toThrow(
      "Each quiz question must have exactly one correct answer matching an option label",
    )
  })

  test("rejects a question with more than one matching correct answer", () => {
    expect(() =>
      validateQuiz({
        questions: [
          {
            question: "Why was the bounds check changed?",
            options: [
              {
                label: "Allow index 0",
                description: "Index 0 is a valid position",
              },
              {
                label: "Allow index 0",
                description: "Duplicate correct answer",
              },
            ],
            correctAnswer: "Allow index 0",
            explanation: "This question contains duplicate matching answers.",
          },
        ],
      }),
    ).toThrow(
      "Each quiz question must have exactly one correct answer matching an option label",
    )
  })

  test("returns true when the selected answer is correct", () => {
    const question = {
      question: "Why was the bounds check changed?",
      options: [
        {
          label: "Allow index 0",
          description: "Index 0 is a valid position",
        },
        {
          label: "Increase array size",
          description: "Changes the array size",
        },
      ],
      correctAnswer: "Allow index 0",
      explanation: "The bounds check was changed to allow index 0 as a valid position.",
    }

    expect(checkAnswer(question, "Allow index 0")).toBe(true)
  })

  test("returns false when the selected answer is incorrect", () => {
    const question = {
      question: "Why was the bounds check changed?",
      options: [
        {
          label: "Allow index 0",
          description: "Index 0 is a valid position",
        },
        {
          label: "Increase array size",
          description: "Changes the array size",
        },
      ],
      correctAnswer: "Allow index 0",
      explanation: "The bounds check was changed to allow index 0 as a valid position.",
    }

    expect(checkAnswer(question, "Increase array size")).toBe(false)
  })
})