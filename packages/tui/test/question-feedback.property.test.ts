// Project 4B property-based tests for Quiz Mode: Feedback and Explanations (amrashee).
// Traceability: traceability/amrashee.md
//
// These properties exercise the real TUI logic used by question.tsx:
//   - questionFeedback(): grades the submitted answer and builds the feedback shown to the student
//   - selectAnswer(): the state transition question.tsx's pick() uses to record a single-choice selection
import { describe, expect, test } from "bun:test"
import { FastCheck } from "effect/testing"
import { questionFeedback, selectAnswer } from "../src/routes/session/question-feedback"

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// Option labels mix arbitrary unicode text with hand-picked edge cases that are easy to confuse:
// single letters ("A"/"a"), the empty string, whitespace-only labels, and labels that differ only by a
// trailing space or by unicode normalization ("é" precomposed vs "e" + combining accent). Grading must
// treat every one of these as a distinct answer.
const edgeLabel = FastCheck.constantFrom("A", "a", "B", "", " ", "A ", " A", "é", "é", "true", "0")
const label = FastCheck.oneof(
  { weight: 3, arbitrary: FastCheck.string({ unit: "grapheme", maxLength: 40 }) },
  { weight: 1, arbitrary: edgeLabel },
)

// A quiz question as the quiz tool sends it to the TUI (see packages/opencode/src/tool/quiz.ts):
// 2-8 options with distinct labels (validateQuiz guarantees uniqueness of the correct label), a correct
// answer drawn from any position (first, middle, last), and an explanation that may be empty/missing.
const quizQuestion = FastCheck.record({
  labels: FastCheck.uniqueArray(label, { minLength: 2, maxLength: 8 }),
  correctIndex: FastCheck.nat(),
  explanation: FastCheck.option(FastCheck.string({ maxLength: 200 }), { nil: undefined }),
}).map((input) => ({
  question: "What changed in this diff?",
  header: "Question 1",
  options: input.labels.map((item) => ({ label: item, description: `Option ${item}` })),
  correctAnswer: input.labels[input.correctIndex % input.labels.length],
  explanation: input.explanation,
  multiple: false,
  custom: false,
}))

// A question plus an index into its options, so selections are always real choices the student could make.
const questionWithChoice = quizQuestion.chain((question) =>
  FastCheck.record({
    question: FastCheck.constant(question),
    choice: FastCheck.integer({ min: 0, max: question.options.length - 1 }),
  }),
)

// "Near misses" of the correct answer: the same text with different case, extra whitespace, or a different
// unicode normalization form. A student (or a custom answer) can produce these, and none of them is the
// stored correct label unless the transformation happens to be a no-op (filtered out in the property).
const nearMiss = (value: string) =>
  FastCheck.constantFrom(
    value.toUpperCase(),
    value.toLowerCase(),
    `${value} `,
    ` ${value}`,
    value.trim(),
    value.normalize("NFD"),
    value.normalize("NFC"),
  )

// ---------------------------------------------------------------------------
// R1 — Accurate Answer Evaluation
// "Quiz Mode must evaluate answers against the correct answer and display the appropriate result."
// Property type: INVARIANT
// ---------------------------------------------------------------------------
describe("R1 Accurate Answer Evaluation (invariant)", () => {
  test("R1: feedback is 'correct' exactly when the submitted option is the stored correct answer", () => {
    FastCheck.assert(
      FastCheck.property(questionWithChoice, (input) => {
        const selected = input.question.options[input.choice].label
        const feedback = questionFeedback(input.question, [selected])
        expect(feedback).toBeDefined()
        expect(feedback?.correct).toBe(selected === input.question.correctAnswer)
      }),
      { numRuns: 1000 },
    )
  })

  test("R1: across all options of a question, exactly one is graded correct", () => {
    FastCheck.assert(
      FastCheck.property(quizQuestion, (question) => {
        const graded = question.options.filter((option) => questionFeedback(question, [option.label])?.correct)
        expect(graded.map((option) => option.label)).toEqual([question.correctAnswer])
      }),
      { numRuns: 500 },
    )
  })

  test("R1: near misses of the correct answer (case, whitespace, unicode form) are never graded correct", () => {
    const input = quizQuestion.chain((question) =>
      FastCheck.record({ question: FastCheck.constant(question), selected: nearMiss(question.correctAnswer) }),
    )
    FastCheck.assert(
      FastCheck.property(
        input.filter((item) => item.selected !== item.question.correctAnswer),
        (item) => {
          expect(questionFeedback(item.question, [item.selected])?.correct).toBe(false)
        },
      ),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// R2 — Final Answer Selection
// "Quiz Mode must preserve the user's latest answer selection before submission."
// Property type: ROUND-TRIP
// ---------------------------------------------------------------------------

// A multi-question quiz session: several questions, the tab the student is on, answers already recorded for
// other questions (possibly none), and an arbitrary "detour" of intermediate picks on the current question.
const selectionSession = FastCheck.array(quizQuestion, { minLength: 1, maxLength: 5 }).chain((questions) =>
  FastCheck.record({
    questions: FastCheck.constant(questions),
    tab: FastCheck.integer({ min: 0, max: questions.length - 1 }),
    // Pre-existing answers per question; `[]` models a question not yet answered (how question.tsx's
    // submit() reports unanswered questions).
    prior: FastCheck.tuple(
      ...questions.map((question) =>
        FastCheck.constantFrom<string[]>([], ...question.options.map((option) => [option.label])),
      ),
    ),
    first: FastCheck.nat(),
    // Detour picks may repeat, include the first choice itself, or be empty (pick A then A again).
    detour: FastCheck.array(FastCheck.nat(), { maxLength: 10 }),
  }),
)

describe("R2 Final Answer Selection (round-trip)", () => {
  test("R2: select A, change through any sequence of other picks, select A again -> same state as selecting A once", () => {
    FastCheck.assert(
      FastCheck.property(selectionSession, (session) => {
        const options = session.questions[session.tab].options
        const a = options[session.first % options.length].label
        const once = selectAnswer(session.prior, session.tab, a)
        const roundTrip = [...session.detour.map((index) => options[index % options.length].label), a].reduce(
          (answers, label) => selectAnswer(answers, session.tab, label),
          once,
        )
        expect(roundTrip).toEqual(once)
        expect(roundTrip[session.tab]).toEqual([a])
      }),
      { numRuns: 1000 },
    )
  })

  test("R2: only the final selection is evaluated, regardless of earlier picks", () => {
    FastCheck.assert(
      FastCheck.property(selectionSession, (session) => {
        const question = session.questions[session.tab]
        const picks = [session.first, ...session.detour].map(
          (index) => question.options[index % question.options.length].label,
        )
        const answers = picks.reduce((state, label) => selectAnswer(state, session.tab, label), session.prior)
        const last = picks[picks.length - 1]
        expect(questionFeedback(question, answers[session.tab])).toEqual(questionFeedback(question, [last]))
      }),
      { numRuns: 1000 },
    )
  })

  test("R2: changing the selection on one question never alters other questions' answers or the input state", () => {
    FastCheck.assert(
      FastCheck.property(selectionSession, (session) => {
        const options = session.questions[session.tab].options
        const before = structuredClone(session.prior)
        const after = selectAnswer(session.prior, session.tab, options[session.first % options.length].label)
        expect(session.prior).toEqual(before)
        session.questions.forEach((_, index) => {
          if (index !== session.tab) expect(after[index]).toEqual(session.prior[index])
        })
      }),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// R5 — Consistent Correct Answers
// "Quiz Mode must keep the displayed correct answer consistent with the answer used for grading."
// Property type: INVARIANT
// ---------------------------------------------------------------------------
describe("R5 Consistent Correct Answers (invariant)", () => {
  // Selections include both real options and arbitrary strings (e.g. a custom/free-text answer), since the
  // displayed correct answer must not depend on what was submitted.
  const anySelection = (question: { options: { label: string }[] }) =>
    FastCheck.oneof(FastCheck.constantFrom(...question.options.map((option) => option.label)), label)

  test("R5: the displayed correct answer is always the stored correct answer, whatever is submitted", () => {
    const input = quizQuestion.chain((question) =>
      FastCheck.record({ question: FastCheck.constant(question), selected: anySelection(question) }),
    )
    FastCheck.assert(
      FastCheck.property(input, (item) => {
        expect(questionFeedback(item.question, [item.selected])?.correctAnswer).toBe(item.question.correctAnswer)
      }),
      { numRuns: 1000 },
    )
  })

  test("R5: the result shown agrees with the displayed correct answer (correct iff selected === displayed answer)", () => {
    const input = quizQuestion.chain((question) =>
      FastCheck.record({ question: FastCheck.constant(question), selected: anySelection(question) }),
    )
    FastCheck.assert(
      FastCheck.property(input, (item) => {
        const feedback = questionFeedback(item.question, [item.selected])
        expect(feedback?.correct).toBe(item.selected === feedback?.correctAnswer)
      }),
      { numRuns: 1000 },
    )
  })

  // Only the correct answer is required to stay identical across picks. The explanation is deliberately not
  // compared here: the original R3 asks for explanations that differ per wrong answer.
  test("R5: every option a student can pick yields the same displayed correct answer", () => {
    FastCheck.assert(
      FastCheck.property(quizQuestion, (question) => {
        const shown = question.options.map((option) => questionFeedback(question, [option.label])?.correctAnswer)
        expect(new Set(shown)).toEqual(new Set([question.correctAnswer]))
      }),
      { numRuns: 500 },
    )
  })
})

// ---------------------------------------------------------------------------
// R4 — Handling Unavailable Explanations
// "Quiz Mode must handle failed explanation generation without presenting unreliable information as fact."
// Acceptance: no valid explanation -> the interface displays "Explanation unavailable".
// Property types: INVARIANT (unavailable -> placeholder; available -> shown verbatim) and
// METAMORPHIC (making only the explanation unavailable changes only the explanation in the feedback)
// ---------------------------------------------------------------------------

// The text the acceptance criterion requires; question.tsx renders feedback.explanation directly.
const UNAVAILABLE = "Explanation unavailable"

// Whitespace characters that String.prototype.trim removes, covering ASCII (space, tab, newlines, CRLF)
// and unicode spaces an LLM might emit (no-break space, em space, ideographic space, line separator, BOM).
const whitespace = FastCheck.constantFrom(" ", "\t", "\n", "\r\n", " ", " ", "　", " ", "﻿")

// "No valid explanation": the field missing entirely, the empty string, or any non-empty run of whitespace.
// These are the three shapes a failed or blank explanation can take after crossing the quiz tool.
const unavailableExplanation = FastCheck.oneof(
  FastCheck.constant(undefined),
  FastCheck.constant(""),
  FastCheck.array(whitespace, { minLength: 1, maxLength: 20 }).map((parts) => parts.join("")),
)

// A real explanation: arbitrary unicode text with at least one non-whitespace character, optionally padded
// with whitespace on either side (padding must not make it look unavailable or get stripped).
const availableExplanation = FastCheck.tuple(
  FastCheck.array(whitespace, { maxLength: 3 }),
  FastCheck.string({ unit: "grapheme", minLength: 1, maxLength: 200 }).filter((text) => text.trim().length > 0),
  FastCheck.array(whitespace, { maxLength: 3 }),
).map(([before, text, after]) => `${before.join("")}${text}${after.join("")}`)

// Any choice the student could submit: correct or incorrect, so R4 is checked on both result paths.
const withExplanation = (explanation: FastCheck.Arbitrary<string | undefined>) =>
  FastCheck.tuple(questionWithChoice, explanation).map(([input, value]) => ({
    question: { ...input.question, explanation: value },
    selected: input.question.options[input.choice].label,
  }))

describe("R4 Handling Unavailable Explanations", () => {
  test("R4 (invariant): a missing, empty, or whitespace-only explanation is shown as 'Explanation unavailable'", () => {
    FastCheck.assert(
      FastCheck.property(withExplanation(unavailableExplanation), (item) => {
        expect(questionFeedback(item.question, [item.selected])?.explanation).toBe(UNAVAILABLE)
      }),
      { numRuns: 1000 },
    )
  })

  test("R4 (invariant): an available explanation is shown exactly as generated, never replaced", () => {
    FastCheck.assert(
      FastCheck.property(withExplanation(availableExplanation), (item) => {
        expect(questionFeedback(item.question, [item.selected])?.explanation).toBe(item.question.explanation)
      }),
      { numRuns: 1000 },
    )
  })

  test("R4 (metamorphic): making only the explanation unavailable keeps the result and correct answer unchanged", () => {
    FastCheck.assert(
      FastCheck.property(withExplanation(availableExplanation), unavailableExplanation, (item, missing) => {
        const original = questionFeedback(item.question, [item.selected])
        const degraded = questionFeedback({ ...item.question, explanation: missing }, [item.selected])
        expect(original).toBeDefined()
        expect(degraded?.correct).toBe(original?.correct)
        expect(degraded?.correctAnswer).toBe(original?.correctAnswer)
        expect(degraded?.explanation).toBe(UNAVAILABLE)
      }),
      { numRuns: 1000 },
    )
  })
})

// ---------------------------------------------------------------------------
// R6 — Explanation Alongside Results
// "Quiz Mode must provide an explanation alongside the correct/incorrect result when a valid explanation is
// available." Acceptance: the feedback displays the result and a nonempty explanation.
// Property types: INVARIANT (result and explanation shown together on every pick) and
// METAMORPHIC (changing only the explanation changes only the explanation shown)
// The explanation is compared to the question's own explanation for each pick, never across picks: the
// original R3 asks for explanations that differ per wrong answer.
// ---------------------------------------------------------------------------

// A question with a real (non-blank) explanation, reusing the R4 generator for explanation text.
const explainedQuestion = FastCheck.tuple(quizQuestion, availableExplanation).map(([question, value]) => ({
  ...question,
  explanation: value,
}))

describe("R6 Explanation Alongside Results", () => {
  test("R6 (invariant): every pick shows its result together with the generated explanation", () => {
    FastCheck.assert(
      FastCheck.property(explainedQuestion, (question) => {
        // Every option is submitted, so both the "Correct" and "Incorrect" paths are checked in each run.
        const results = question.options.map((option) => questionFeedback(question, [option.label]))
        results.forEach((feedback) => {
          expect(typeof feedback?.correct).toBe("boolean")
          expect(feedback?.explanation).toBe(question.explanation)
          expect(feedback?.explanation).not.toBe(UNAVAILABLE)
          expect(feedback?.explanation?.trim().length).toBeGreaterThan(0)
        })
        expect(results.filter((feedback) => feedback?.correct)).toHaveLength(1)
        expect(results.some((feedback) => feedback?.correct === false)).toBe(true)
      }),
      { numRuns: 500 },
    )
  })

  test("R6 (metamorphic): replacing a valid explanation with another changes only the explanation shown", () => {
    FastCheck.assert(
      FastCheck.property(withExplanation(availableExplanation), availableExplanation, (item, replacement) => {
        const original = questionFeedback(item.question, [item.selected])
        const changed = questionFeedback({ ...item.question, explanation: replacement }, [item.selected])
        expect(changed?.correct).toBe(original?.correct)
        expect(changed?.correctAnswer).toBe(original?.correctAnswer)
        expect(changed?.explanation).toBe(replacement)
      }),
      { numRuns: 1000 },
    )
  })
})
