import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { answeredCount, pickAnswer, replyAnswers } from "../src/routes/session/question-answers"
import { questionFeedback } from "../src/routes/session/question-feedback"

// Generators
// - total: 1..6 questions. 1 is the boundary (single question); small totals make picks collide on the same
//   question often, which is exactly the "changed my mind" case the interviewees described.
// - label: non-empty, trimmed strings, so two different labels are really different options.
// - picks: 0..30 (question, option) pairs in any order, including repeated picks on one question. Questions can be
//   answered, re-answered, and revisited in any order, like a user moving back and forth between tabs.
const totalArb = fc.integer({ min: 1, max: 6 })
const labelArb = fc.string({ minLength: 1, maxLength: 12 }).filter((value) => value.trim() === value && value !== "")
const picksArb = (total: number) =>
  fc.array(fc.record({ tab: fc.integer({ min: 0, max: total - 1 }), label: labelArb }), { maxLength: 30 })
const quizArb = fc
  .uniqueArray(labelArb, { minLength: 2, maxLength: 5 })
  .chain((labels) =>
    fc.record({
      labels: fc.constant(labels),
      correct: fc.constantFrom(...labels),
      explanation: fc.string({ maxLength: 40 }),
    }),
  )

const makeQuestion = (quiz: { labels: string[]; correct: string; explanation: string }) => ({
  question: "Why was the bounds check changed?",
  header: "Question 1",
  options: quiz.labels.map((label) => ({ label, description: `${label} description` })),
  correctAnswer: quiz.correct,
  explanation: quiz.explanation,
  multiple: false,
  custom: false,
})

describe("quiz interaction properties", () => {
  // R1: Selecting a different option on an answered question replaces the previous selection immediately,
  // with no extra confirmation step, until the question has been submitted for feedback.
  // Kind: invariant
  test("R1: the latest pick replaces the previous one, and a locked question does not change", () => {
    fc.assert(
      fc.property(totalArb.chain((total) => fc.tuple(fc.constant(total), picksArb(total))), ([total, picks]) => {
        const final = picks.reduce<(string[] | undefined)[]>((answers, pick) => pickAnswer(answers, pick.tab, pick.label), [])
        // Exactly one selected option per answered question, and it is the last one picked for it.
        picks.forEach((pick) => expect(final[pick.tab]?.length).toBe(1))
        const last = picks.at(-1)
        if (last) expect(final[last.tab]).toEqual([last.label])
        // Once feedback has been shown (locked), further picks are ignored.
        const locked = picks.reduce((answers, pick) => pickAnswer(answers, pick.tab, pick.label, true), final)
        expect(replyAnswers(locked, total)).toEqual(replyAnswers(final, total))
      }),
      { numRuns: 300 },
    )
  })

  // R2: Returning to an answered question shows the most recent selection.
  // Kind: model / oracle (compared with a Map that simply remembers the last label picked per question)
  test("R2: every question shows its most recent pick, whatever order the user visited them in", () => {
    fc.assert(
      fc.property(totalArb.chain((total) => fc.tuple(fc.constant(total), picksArb(total))), ([total, picks]) => {
        const oracle = new Map(picks.map((pick) => [pick.tab, pick.label]))
        const final = picks.reduce<(string[] | undefined)[]>((answers, pick) => pickAnswer(answers, pick.tab, pick.label), [])
        replyAnswers(final, total).forEach((answer, tab) => {
          const expected = oracle.get(tab)
          expect(answer).toEqual(expected === undefined ? [] : [expected])
        })
      }),
      { numRuns: 300 },
    )
  })

  // R3: Changing the answer to one question never changes or clears the answers to other questions.
  // Kind: metamorphic (change one answer, every other answer must stay exactly the same)
  test("R3: changing one answer leaves all other answers untouched", () => {
    fc.assert(
      fc.property(
        totalArb.chain((total) =>
          fc.tuple(fc.constant(total), picksArb(total), fc.integer({ min: 0, max: total - 1 }), labelArb),
        ),
        ([total, picks, tab, label]) => {
          const before = picks.reduce<(string[] | undefined)[]>((answers, pick) => pickAnswer(answers, pick.tab, pick.label), [])
          const after = pickAnswer(before, tab, label)
          const unchanged = replyAnswers(before, total).map((answer, i) => (i === tab ? [label] : answer))
          expect(replyAnswers(after, total)).toEqual(unchanged)
        },
      ),
      { numRuns: 300 },
    )
  })

  // R4: The progress indicator counts answered questions, and changing an existing answer does not change or reset it.
  // Kind: metamorphic (re-answering an answered question keeps the count; answering a new one adds exactly one)
  test("R4: answered count only grows when a new question is answered", () => {
    fc.assert(
      fc.property(
        totalArb.chain((total) =>
          fc.tuple(fc.constant(total), picksArb(total), fc.integer({ min: 0, max: total - 1 }), labelArb),
        ),
        ([total, picks, tab, label]) => {
          const before = picks.reduce<(string[] | undefined)[]>((answers, pick) => pickAnswer(answers, pick.tab, pick.label), [])
          const count = answeredCount(before, total)
          expect(count).toBe(new Set(picks.map((pick) => pick.tab)).size)
          const wasAnswered = (before[tab]?.length ?? 0) > 0
          expect(answeredCount(pickAnswer(before, tab, label), total)).toBe(wasAnswered ? count : count + 1)
        },
      ),
      { numRuns: 300 },
    )
  })

  // R6: After a question is submitted for feedback, the quiz shows whether the pick was correct and what the
  // correct answer is, so the user can tell their own mistake from a quiz bug.
  // Kind: model / oracle (the simple oracle is plain string equality against the answer key)
  test("R6: feedback reports correctness and the correct answer for any pick", () => {
    fc.assert(
      fc.property(quizArb, fc.nat(), (quiz, index) => {
        const picked = quiz.labels[index % quiz.labels.length]
        const feedback = questionFeedback(makeQuestion(quiz), [picked])
        expect(feedback?.correct).toBe(picked === quiz.correct)
        expect(feedback?.correctAnswer).toBe(quiz.correct)
        expect(feedback?.explanation).toBe(quiz.explanation)
      }),
      { numRuns: 300 },
    )
  })

  // R7: After the user submits a question for feedback, the result is available in the same interaction,
  // with no further step needed.
  // Kind: invariant (any selected option immediately produces feedback; no selection produces none)
  test("R7: feedback exists as soon as an option is selected, and not before", () => {
    fc.assert(
      fc.property(quizArb, fc.nat(), (quiz, index) => {
        const question = makeQuestion(quiz)
        expect(questionFeedback(question, undefined)).toBeUndefined()
        expect(questionFeedback(question, [])).toBeUndefined()
        const picked = quiz.labels[index % quiz.labels.length]
        const answers = pickAnswer([], 0, picked)
        expect(questionFeedback(question, answers[0])).toBeDefined()
      }),
      { numRuns: 300 },
    )
  })
})
