
import { test, expect } from "bun:test"
import fc from "fast-check"
import {
    checkAnswer,
    validateQuiz,
    type QuizQuestion,
  } from "../../src/quiz/generator"

// Generates valid questions with unique answer labels.
// This lets us test both correct and incorrect selections.
const questionArbitrary = fc
  .uniqueArray(
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,10}$/),
    { minLength: 2, maxLength: 5 },
  )
  .chain((labels) =>
    fc.integer({ min: 0, max: labels.length - 1 }).map(
      (correctIndex): QuizQuestion => ({
        question: "Which option is correct?",
        options: labels.map((label) => ({
          label,
          description: `Description for ${label}`,
        })),
        correctAnswer: labels[correctIndex],
        explanation: "This is the correct answer.",
      }),
    ),
  )

// R1: The system must accurately evaluate answers against the correct option.
// Kind: invariant
test("R1: only the correct answer is marked correct", () => {
  fc.assert(
    fc.property(questionArbitrary, (question) => {
      for (const option of question.options) {
        const result = checkAnswer(question, option.label)
        expect(result).toBe(option.label === question.correctAnswer)
      }
    }),
    { numRuns: 100 },
  )
})


// R2: The system must evaluate only the final selected answer,
// regardless of previous selections.
// Kind: metamorphic
test("R2: only the final selected answer affects the result", () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        fc.array(fc.nat(), { minLength: 1, maxLength: 10 }),
        fc.nat(),
        (question, historyIndices, finalIndex) => {
          const options = question.options
  
          const history = historyIndices.map(
            (index) => options[index % options.length]!.label,
          )
  
          const finalAnswer =
            options[finalIndex % options.length]!.label
  
          // Simulate changing selections before submitting.
          const selections = [...history, finalAnswer]
  
          // Only the last selection is submitted to checkAnswer.
          const submittedAnswer = selections[selections.length - 1]!
  
          const result = checkAnswer(question, submittedAnswer)
  
          expect(result).toBe(
            finalAnswer === question.correctAnswer,
          )
  
          // Earlier selections should not change the final result.
          expect(result).toBe(checkAnswer(question, finalAnswer))
        },
      ),
      { numRuns: 100 },
    )
  })
  

// R3: The system must recognize the correct answer regardless of its position.
// Kind: metamorphic
test("R3: reordering options does not change correctness", () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        fc.integer(),
        (question, seed) => {
          const reorderedOptions = fc.sample(
            fc.shuffledSubarray([...question.options], {
              minLength: question.options.length,
              maxLength: question.options.length,
            }),
            { seed, numRuns: 1 },
          )[0]!
  
          const reorderedQuestion = {
            ...question,
            options: reorderedOptions,
          }
  
          for (const option of question.options) {
            expect(checkAnswer(reorderedQuestion, option.label)).toBe(
              checkAnswer(question, option.label),
            )
          }
        },
      ),
      { numRuns: 100 },
    )
  })


// R5: The system must provide an explanation after checking
// both correct and incorrect answers.
// Kind: invariant
test("R5: quiz questions must have non-empty explanations", () => {
    fc.assert(
      fc.property(questionArbitrary, (question) => {
        const quiz = { questions: [question] }
  
        // A valid question with an explanation should be accepted.
        expect(() => validateQuiz(quiz)).not.toThrow()
  
        // Removing the explanation should make the question invalid.
        const invalidQuiz = {
          questions: [{ ...question, explanation: "   " }],
        }
  
        expect(() => validateQuiz(invalidQuiz)).toThrow(
          "Each quiz question must have an explanation",
        )
      }),
      { numRuns: 100 },
    )
  })
  
  

// R6: Rechecking the same answer against the same validated question
// must produce a consistent correctness result.
// Kind: invariant
test("R6: rechecking an answer gives the same result", () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        fc.boolean(),
        (question, chooseCorrect) => {
          const selectedAnswer = chooseCorrect
            ? question.correctAnswer
            : question.options.find(
                (option) => option.label !== question.correctAnswer,
              )!.label
  
          const firstResult = checkAnswer(question, selectedAnswer)
          const secondResult = checkAnswer(question, selectedAnswer)
  
          expect(secondResult).toBe(firstResult)
          expect(secondResult).toBe(
            selectedAnswer === question.correctAnswer,
          )
        },
      ),
      { numRuns: 100 },
    )
  })
  