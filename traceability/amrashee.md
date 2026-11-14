# Traceability — Quiz Mode: Feedback and Explanations

**Name:** Alfajer Al-Rasheed · **Andrew ID:** amrashee · **Team:** Ctrl-Alt-Elite
**Target feature:** Quiz Mode: Feedback and Explanations
**Branch:** `amrashee/properties`
**Status:** five requirements tested with properties (R1, R2, R4, R5, R6), 20 properties in total, all passing. R4's acceptance criteria were revised in P4B. R3 was reviewed and kept unchanged, but is not implemented or tested. R7 is not implemented.

## Implementation under test

| Module | Role |
| --- | --- |
| [`packages/opencode/src/quiz/generator.ts`](../packages/opencode/src/quiz/generator.ts) | Generates quizzes; `validateQuiz` rejects inconsistent answer keys and empty explanations, and `generate` calls it before returning, so a rejected quiz never reaches the quiz tool; `checkAnswer` grades a selection |
| [`packages/opencode/src/tool/quiz.ts`](../packages/opencode/src/tool/quiz.ts) | Passes `correctAnswer` and `explanation` through to the TUI question unchanged |
| [`packages/tui/src/routes/session/question-feedback.ts`](../packages/tui/src/routes/session/question-feedback.ts) | `questionFeedback` builds the result shown after submission (including the "Explanation unavailable" fallback); `selectAnswer` records a single-choice pick |
| [`packages/tui/src/routes/session/question.tsx`](../packages/tui/src/routes/session/question.tsx) | Renders the question, calls `selectAnswer` from `pick()`, and shows "✓ Correct!" / "✗ Incorrect", the correct answer, and the feedback explanation |

## Requirements

Requirements, acceptance criteria, and interview evidence are copied from my final Project 4A workbook. The only change is R4's acceptance criteria, revised in P4B (see "Requirement changes"); the original wording is kept there. Interview evidence IDs refer to the classmate (C), staff (S), and outside (O) interview notes.

- **Changed in P4B?** says whether the requirement or acceptance criteria text was revised.
- **P4B status** says what was implemented and tested.

| ID | Interview evidence | Requirement | Acceptance criteria | Changed in P4B? | P4B status | Property type | Test name(s) | Test location |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R1** Accurate Answer Evaluation | C-3, S-3 | Quiz Mode must evaluate answers against the correct answer and display the appropriate result. | Given a question with correct answer B, submitting B displays "Correct," while submitting A displays "Incorrect." | No | **Tested, all properties pass.** No code change needed. | Invariant | "R1: feedback is 'correct' exactly when the submitted option is the stored correct answer"; "R1: across all options of a question, exactly one is graded correct"; "R1: near misses of the correct answer (case, whitespace, unicode form) are never graded correct" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| | | | | | | Invariant | "R1: in every validated question, checkAnswer accepts exactly the correct option and rejects all others"; "R1: any answer that is not exactly the correct label is graded incorrect" | [`packages/opencode/test/quiz/generator.property.test.ts`](../packages/opencode/test/quiz/generator.property.test.ts) |
| **R2** Final Answer Selection | C-5, C-6, S-5, O-5 | Quiz Mode must preserve the user's latest answer selection before submission. | If a student selects A, changes to B, and changes back to A before submitting, A remains selected and is the answer evaluated. | No | **Tested, all properties pass.** Selection logic was extracted into `selectAnswer` for testability; behavior is unchanged. | Round-trip | "R2: select A, change through any sequence of other picks, select A again -> same state as selecting A once"; "R2: only the final selection is evaluated, regardless of earlier picks"; "R2: changing the selection on one question never alters other questions' answers or the input state" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| **R3** Personalized Feedback | C-7, S-7, O-7 | Quiz Mode must provide feedback that addresses the specific incorrect answer selected by the student. | Given a question where B is correct, selecting A produces feedback explaining why A is incorrect, while selecting C produces feedback explaining why C is incorrect. Both responses identify B as the correct answer. | No | **Not implemented, not tested.** Reviewed in P4B and not selected for property-based testing. The current Quiz Mode generates one shared explanation per question, not a personalized explanation for each incorrect option, so this requirement is not satisfied. Implementing it is beyond the scope of this testing assignment (see the review table). | — | None (not selected) | — |
| **R4** Handling Unavailable Explanations | C-4, S-4, O-4 | Quiz Mode must handle failed explanation generation without presenting unreliable information as fact. | **Revised in P4B:** If quiz generation fails, including when a generated explanation is missing or empty, no quiz is displayed. If a question reaches the feedback display with an unavailable explanation (missing, empty, or whitespace-only), the interface displays "Explanation unavailable" rather than an unsupported explanation. | **Yes** (acceptance criteria only; see "Requirement changes") | **Tested, all properties pass.** The properties found a bug: a missing, empty, or whitespace-only explanation that reached the feedback display was shown as a blank line. It is fixed. In the normal `/quiz` flow, only whitespace-only explanations reach the feedback display: a missing explanation fails the generator's schema and an empty one is rejected by `validateQuiz`, so in both cases no quiz is shown. | Invariant | "R4 (invariant): a missing, empty, or whitespace-only explanation is shown as 'Explanation unavailable'"; "R4 (invariant): an available explanation is shown exactly as generated, never replaced" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| | | | | | | Metamorphic | "R4 (metamorphic): making only the explanation unavailable keeps the result and correct answer unchanged" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| | | | | | | Metamorphic | "R4: emptying one question's explanation turns an accepted quiz into a rejected one" | [`packages/opencode/test/quiz/generator.property.test.ts`](../packages/opencode/test/quiz/generator.property.test.ts) |
| **R5** Consistent Correct Answers | C-9, S-9, O-9 | Quiz Mode must keep the displayed correct answer consistent with the answer used for grading. | If B is stored as the correct answer, the feedback identifies B as correct regardless of which answer the student submits. | No | **Tested, all properties pass.** No code change needed. | Invariant | "R5: the displayed correct answer is always the stored correct answer, whatever is submitted"; "R5: the result shown agrees with the displayed correct answer (correct iff selected === displayed answer)"; "R5: every option a student can pick yields the same displayed correct answer" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| | | | | | | Invariant | "R5: validateQuiz accepts a question only when its correct answer matches exactly one option"; "R5: one inconsistent question makes the whole quiz rejected, so it is never shown" | [`packages/opencode/test/quiz/generator.property.test.ts`](../packages/opencode/test/quiz/generator.property.test.ts) |
| **R6** Explanation Alongside Results | C-1, S-1, O-1 | Quiz Mode must provide an explanation alongside the correct/incorrect result when a valid explanation is available. | After submitting an answer, the feedback displays the result and a nonempty explanation describing the reasoning behind the correct answer. | No | **Tested, all properties pass.** No code change needed. Whether an explanation actually *describes the reasoning* needs human judgment and is not checked by a property. | Invariant | "R6 (invariant): every pick shows its result together with the generated explanation" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| | | | | | | Metamorphic | "R6 (metamorphic): replacing a valid explanation with another changes only the explanation shown" | [`packages/tui/test/question-feedback.property.test.ts`](../packages/tui/test/question-feedback.property.test.ts) |
| | | | | | | Invariant | "R6: every quiz validateQuiz accepts has a nonempty explanation for every question" | [`packages/opencode/test/quiz/generator.property.test.ts`](../packages/opencode/test/quiz/generator.property.test.ts) |
| **R7** Reporting Incorrect Feedback | S-10, O-10 | Quiz Mode should allow users to report incorrect or misleading feedback. | When a student clicks "Report feedback," the system records the question ID, selected answer, and explanation being reported, and displays a confirmation message. | No | **Not implemented, not tested.** No reporting control or storage exists. | — | Not yet written | — |

**AI-suggested properties:** all 20 properties in this table were suggested and written by Claude Code (Anthropic's AI coding assistant). See "AI assistance disclosure" for details.

## Requirements review (feasibility, testability, consistency)

| ID | Feasible? | Testable against current code? | Notes |
| --- | --- | --- | --- |
| R1 | Yes | Yes | `checkAnswer` (backend) and `questionFeedback(...).correct` (TUI) both grade by exact label match. Directly testable. |
| R2 | Yes | Yes, after a small extraction | The selection update was inline inside the `pick()` handler of the `question.tsx` Solid component, reachable only by rendering the TUI. It is now a plain `selectAnswer` function in `question-feedback.ts`, and `pick()` calls it, so the tests drive the same code the UI runs (see "Code and CI changes"). |
| R3 | Yes, but needs new functionality | **No, not as written** | Each generated question carries **one** `explanation` for the whole question (`QuizQuestion.explanation` in `generator.ts`, `QuestionInfo.explanation` in the TUI). Selecting A and selecting C therefore produce identical explanation text, so the acceptance criterion "feedback explaining why A is incorrect … why C is incorrect" cannot hold today. A metamorphic test written to the original wording would fail against the current implementation. Meeting R3 as written would need per-option explanations from the generator, schema changes to the shared `Question` type, an SDK regeneration, and UI changes. **Decision:** kept as written, but not selected for property-based testing and not implemented. A property written to the original wording would only confirm that the requirement is not met, and the implementation work above goes beyond the scope of this testing assignment. |
| R4 | Yes, after revising the acceptance criteria | Yes | **As written in P4A, not fully feasible.** The original criterion covers two cases. **"No valid explanation":** testable, and it was not met before P4B. `questionFeedback` used `question.explanation ?? ""`, so missing, empty, and whitespace-only explanations were shown as a blank line. Fixed in P4B (see "Run, triage, and fixes"). **"Explanation generation returns an error":** not feasible as written. The explanation is produced in the same model response as the questions, not by a separate step. If that response fails or is invalid, `QuizGenerator.generate` fails before any question exists, so there is no question on which to display "Explanation unavailable." The acceptance criteria were therefore revised (see "Requirement changes"), and both revised cases are tested. |
| R5 | Yes | Yes | `questionFeedback` returns `question.correctAnswer` unchanged, and `validateQuiz` guarantees it names exactly one displayed option. Directly testable. |
| R6 | Yes | Yes | `questionFeedback` returns the result and the explanation together, and `validateQuiz` requires a nonempty explanation before a quiz can be shown. Both are directly testable. A whitespace-only explanation still passes `validateQuiz`; it is not a valid explanation, so R6 does not apply and R4 displays "Explanation unavailable" instead. Whether an explanation actually *describes the reasoning* needs human judgment and cannot be checked by a property. R4 and R6 are consistent with each other: R6 covers the "valid explanation available" case and R4 the "unavailable" case. |
| R7 | Yes, as new functionality | No | No reporting control or storage exists yet. It is a "should" requirement, so it does not conflict with the others. |

**Consistency:** No two requirements contradict each other. Two places needed care to avoid over-specifying:

- **R5 vs. R3.** The R5 properties compare only the correct answer and the grading result, not the explanation text, because the original R3 asks for explanations that differ per wrong answer.
- **R4 vs. R6.** The R4 properties require that an *available* explanation is shown exactly as generated. That way the fallback cannot hide or rewrite a valid explanation, which would violate R6.

## Requirement changes

| ID | Original requirement (P4A) | Revised requirement | Why it changed |
| --- | --- | --- | --- |
| R4 | **Requirement:** Quiz Mode must handle failed explanation generation without presenting unreliable information as fact. **Acceptance criteria:** If explanation generation returns an error or no valid explanation, the interface displays "Explanation unavailable" rather than generating an unsupported explanation. | **Requirement:** unchanged. **Acceptance criteria:** If quiz generation fails, including when a generated explanation is missing or empty, no quiz is displayed. If a question reaches the feedback display with an unavailable explanation (missing, empty, or whitespace-only), the interface displays "Explanation unavailable" rather than an unsupported explanation. | **Feasibility.** The explanation is generated in the same model response as the questions and answer choices. There is no separate explanation step whose error could be caught while still showing the question. When generation fails, no question exists, so "Explanation unavailable" cannot be displayed. Meeting the original wording would need a separate model call per explanation (new latency, cost, and failure modes) or changes to the quiz schema and validation, which belong to a teammate's feature. The revision keeps the requirement's intent (no unsupported explanation is ever presented as fact) and states two behaviors that can each be checked. |

Exact changes to R4's acceptance criteria:

- "If explanation generation returns an error" became "If quiz generation fails, including when a generated explanation is missing or empty, no quiz is displayed."
- "or no valid explanation" became "If a question reaches the feedback display with an unavailable explanation (missing, empty, or whitespace-only)." This limits the fallback to questions that are actually shown and defines "no valid explanation."
- "rather than generating an unsupported explanation" became "rather than an unsupported explanation," because the feedback display only shows text and never generates it.
- The requirement statement and the interview evidence (C-4, S-4, O-4) are unchanged, so the revision still traces to the same interviews.

The need for this change was found while writing and running the R4 properties: the generation-error case could not be reached by any property, because a failed generation never produces a question (see "Run, triage, and fixes").

All other requirements (R1, R2, R3, R5, R6, R7) were kept as written:

- R1, R2, R5, and R6 are feasible, consistent with each other, and directly checked by passing properties.
- R3 is kept unchanged, but it is **not implemented and not tested**. It was reviewed and not selected for property-based testing: the current Quiz Mode generates one shared explanation per question rather than a personalized explanation for each incorrect option, and implementing per-option explanations would need changes to the quiz generator, the shared `Question` schema, the generated SDK, and the UI, which are beyond the scope of this testing assignment (see the review table). Its wording was not revised, because the requirement still reflects what interviewees asked for (C-7, S-7, O-7).
- R7 is a "should" requirement for new functionality; it does not conflict with the others and is kept for future work.

## Property-based tests

All properties use fast-check through Effect's bundled re-export (`import { FastCheck } from "effect/testing"`), the same import the team's existing `generator.fuzz.test.ts` uses. Both `packages/opencode` and `packages/tui` already depend on `effect`, so no dependency files changed. The tests call the real application functions (`checkAnswer`, `validateQuiz`, `questionFeedback`, `selectAnswer`). Nothing is mocked or reimplemented in the tests.

### Generator choices

- **Option labels** come 75% from arbitrary unicode strings (`unit: "grapheme"`) and 25% from hand-picked confusable values: `"A"`/`"a"`, `""`, `" "`, `"A "`/`" A"`, precomposed `"é"` vs. `"é"`, `"true"`, `"0"`. This makes grading see labels that look alike but are different strings.
- **Questions** have 2–8 *unique* labels (matching what `validateQuiz` allows), with the correct answer drawn from any position (first, middle, last). Explanations may be empty or missing, so R1/R5 are shown not to depend on the explanation.
- **Near misses** (R1) transform the correct answer by upper/lower case, a leading or trailing space, trimming, or NFC/NFD normalization. Transformations that leave the string unchanged are filtered out.
- **Selection sessions** (R2) cover 1–5 questions, a random current tab, existing answers on other questions (including "unanswered" = `[]`, which is how `submit()` reports it), a first pick A, and a detour of 0–10 further picks. The detour can repeat options and can include A itself.
- **Loose answer keys** (R5, backend) draw both option labels and `correctAnswer` from a tiny pool (`"A"`, `"B"`, `"C"`, `"a"`, `"A "`). Duplicate labels and missing or ambiguous correct answers therefore come up often, mimicking an inconsistent LLM response.
- **Arbitrary selections** (R5, TUI) mix real option labels with free-text strings, because the displayed correct answer must not depend on what was submitted.
- **Unavailable explanations** (R4) take the three shapes a blank explanation can have after crossing the quiz tool:
  - a missing field (`undefined`);
  - the empty string `""`;
  - a run of 1–20 whitespace characters mixing ASCII (space, `\t`, `\n`, `\r\n`) and unicode spaces an LLM may emit (no-break space ` `, em space ` `, ideographic space `　`, line separator ` `, BOM `﻿`).
- **Available explanations** (R4) are arbitrary unicode text with at least one non-whitespace character. They are optionally padded with 0–3 whitespace characters on each side, which tests that padding neither makes a real explanation look unavailable nor gets stripped.
- **R4 selections** are any option of the generated question, so both the "Correct" and "Incorrect" result paths are checked.
- **R4 failed generations** (backend) start from 1–4 valid questions, each with a nonempty explanation, and empty the explanation of one question at a random position (first, middle, or last). Each run also checks that the unmodified quiz is accepted, so the rejection is caused by the emptied explanation alone.
- **R6 explanations** reuse the R4 "available explanation" generator (real unicode text, optionally padded with whitespace). The TUI invariant submits *every* option of each question, so both the "Correct" and "Incorrect" paths are checked in every run. The TUI metamorphic property swaps in a second, independently generated explanation.
- **R6 mixed quizzes** (backend) give each of 1–4 otherwise valid questions an explanation that is empty, whitespace-only (`" "`, `"\t"`, `"\n"`), or real text, so `validateQuiz` sees every shape at every question position.

### Property summary

| Req | Property type | What is checked |
| --- | --- | --- |
| R1 | Invariant | For every generated question and every option, the result is "correct" ⇔ the option is the stored correct answer. Exactly one option per question is graded correct. Case, whitespace, and unicode-form near misses are always "incorrect." Holds both in the backend `checkAnswer` and in the TUI `questionFeedback`. |
| R2 | Round-trip | Selecting A, going through any sequence of other picks, and selecting A again gives exactly the same answer state as selecting A once. The feedback after any pick sequence equals the feedback for the last pick alone. Changing one question's selection never changes other questions' answers or mutates the previous state. |
| R4 | Invariant | A missing, empty, or whitespace-only explanation is always displayed as "Explanation unavailable," for correct and incorrect submissions alike. Any explanation with real content is displayed exactly as generated, neither replaced nor trimmed. |
| R4 | Metamorphic | Take a question with a real explanation and replace only its explanation with an unavailable one. The feedback then keeps the same result (correct/incorrect) and correct answer, and only the explanation becomes "Explanation unavailable." |
| R4 | Metamorphic | Take a quiz `validateQuiz` accepts and empty the explanation of only one question. The quiz is then rejected with "Each quiz question must have an explanation," so a failed explanation never produces a displayed quiz. |
| R5 | Invariant | For any submission, the displayed correct answer equals the stored correct answer, and "correct" ⇔ submission equals the displayed answer. `validateQuiz` accepts a question exactly when its correct answer matches one option. One bad question rejects the whole quiz, so an inconsistent answer key never reaches the student. |
| R6 | Invariant | For a question with a real explanation, every option a student can pick produces feedback with a result and exactly the generated explanation, never the placeholder and never blank. Exactly one pick is "correct" and at least one is "incorrect," so both result paths are covered. Every quiz `validateQuiz` accepts has a nonempty explanation for every question. |
| R6 | Metamorphic | Replacing a real explanation with another real explanation keeps the result and the correct answer unchanged, and the new explanation is shown exactly. |

### Specification notes and known limitations

- **Exact label equality is part of the specification.** R1 and R5 require grading "against the correct answer," and the quiz stores that answer as the exact label of one option (`correctAnswer` must match exactly one option label in `validateQuiz`). Several properties therefore use exact string equality as their oracle:
  - "R1: feedback is 'correct' exactly when…";
  - "R1: any answer that is not exactly the correct label…";
  - "R5: the result shown agrees with the displayed correct answer…";
  - the R5 `validateQuiz` property, which counts exactly matching labels.

  This is intentional and is the required behavior, not a reimplementation of it. Other properties do not rely on that oracle and check the same behavior from different angles: exactly one option graded correct per question, near misses always rejected, the R2 round-trip, and the R4 metamorphic relation.
- **Correctness flag, not rendered text.** The R1 and R5 properties check the `correct` flag and the `correctAnswer` value returned by `questionFeedback`, not the final text drawn on screen. `question.tsx` turns the flag into "✓ Correct!" / "✗ Incorrect" (slightly different from the acceptance criterion's "Correct" / "Incorrect"). That mapping in the Solid component is not covered by these properties. The R4 and R6 properties do check the displayed explanation string, because `question.tsx` renders `feedback.explanation` without transforming it.
- **Zero-width characters are not treated as blank.** The R4 fallback detects blank explanations with `String.prototype.trim()`. `trim()` does not remove zero-width characters such as the zero-width space `​`, so an explanation made only of those characters would be treated as available and displayed as an apparently empty line. The R4 generator deliberately uses only characters `trim()` removes. This limitation is documented, not fixed.
- **From `validateQuiz` to "no quiz is displayed" (R4).** The backend R4 property shows that `validateQuiz` rejects a quiz with an empty explanation. That a rejected quiz is never displayed follows from the code, not from a property: `generate` calls `validateQuiz` before returning, and the quiz tool calls `question.ask` only after `generate` succeeds. The existing `test/tool/quiz.test.ts` covers the successful path and a dismissed quiz, not a failed generation.
- **Nonempty, not non-blank (R6, backend).** The backend R6 property checks that accepted explanations are nonempty, which is the rule `validateQuiz` enforces. A whitespace-only explanation is accepted by `validateQuiz` (the team's `generator.fuzz.test.ts` records this), and the TUI then shows "Explanation unavailable" for it (R4). Making `validateQuiz` reject it was out of scope, because it would change a teammate's validation behavior.

## Run, triage, and fixes

### R1, R2, R5

- **First run:** all 13 properties passed on the first test run. No code bugs were found.
- **Later typecheck issue (incorrect test, fixed):** `bun typecheck` in `packages/tui` then reported type errors in the first R2 generator, which modelled unanswered questions as `undefined`. The component's state is typed `QuestionAnswer[]`, and `submit()` reports an unanswered question as `[]`, so the generator now uses `[]`. The properties still pass after the change, and they are more faithful to the real state, not weaker.

### R4: failures found before the fix

The R4 properties were run against the unmodified implementation first. 2 of the 3 failed:

| Property | Before fix | Shrunk counterexample |
| --- | --- | --- |
| R4 (invariant): missing/empty/whitespace → "Explanation unavailable" | **Failed** | `explanation: undefined` → displayed `""` |
| R4 (metamorphic): only the explanation changes | **Failed** | `explanation: "!"` replaced with `undefined` → displayed `""` instead of the placeholder |
| R4 (invariant): available explanation shown exactly | Passed | — |

I also called `questionFeedback` directly with each unavailable shape, to show the failure is not limited to `undefined`:

| Explanation | Displayed before fix |
| --- | --- |
| `undefined` | `""` |
| `""` | `""` |
| `"   "` | `"   "` |
| `"\t\n"` | `"\t\n"` |
| `" "` | `" "` |

- **Classification:** a genuine **code bug** for the "no valid explanation" part of R4. The tests match that part of the acceptance criterion.
- **Root cause:** `questionFeedback` set `explanation: question.explanation ?? ""`. The `??` operator only replaces `undefined`/`null`, and it replaced it with an empty string rather than a message. Empty and whitespace-only strings passed through untouched. On the backend, `validateQuiz` rejects only the exact empty string (`!question.explanation`), so whitespace-only explanations from the model reach the TUI. `question.tsx` renders `feedback.explanation` directly, so the student saw a blank line under the result instead of being told that no explanation was available.
- **Fix:** in [`question-feedback.ts`](../packages/tui/src/routes/session/question-feedback.ts), `explanation: question.explanation?.trim() ? question.explanation : "Explanation unavailable"`.
  - Blank explanations are detected with `trim()`, but a real explanation is returned **untrimmed**, so its content is never altered.
  - The fix lives in the TUI because R4 is about what the *interface* displays. The backend `validateQuiz` was intentionally left unchanged. Making it reject whitespace would discard the whole quiz instead of showing "Explanation unavailable." It would also break the team's existing characterization test `validateQuiz currently accepts a whitespace-only explanation` in `generator.fuzz.test.ts`.
  - This fix does not cover the "generation returns an error" case. That case was handled as a requirement problem (next section).
- **Outdated existing test updated:** `packages/tui/test/question-feedback.test.ts` had a unit test `falls back to an empty explanation when none was provided`, which asserted the old `""` output. That behavior is exactly what R4 forbids, so the test was renamed to `shows 'Explanation unavailable' when no explanation was provided` and now expects `"Explanation unavailable"`. No property was weakened.
- **After the fix:** all 3 R4 properties pass.
- **Check that the R4 tests can fail:** two deliberately broken versions of the fix were tried and reverted. In both, "an available explanation is shown exactly as generated" failed:
  - always showing the placeholder;
  - trimming real explanations.

### R4: generation errors (requirement problem) and new R4/R6 properties

- **Classification:** a **requirement problem**, not a code bug or a wrong test. While writing the R4 properties, no generator could produce a question for the original "explanation generation returns an error" case. A failed generation never produces a question, so there is nothing to display "Explanation unavailable" on.
- **Action:** following Step 1, R4's acceptance criteria were revised (see "Requirement changes"), and one property was added for the new "generation fails → no quiz is displayed" case: "R4: emptying one question's explanation turns an accepted quiz into a rejected one" (backend, metamorphic).
- **R6:** two TUI properties (invariant, metamorphic) and one backend property (invariant) were added, so R6 is tested as its own requirement.
- **First run:** all 4 new properties passed on the first run against the unmodified code. No code was changed for them.
- **Correction while writing the R6 backend property:** the first draft compared the result of a `try`/`catch` around `validateQuiz` with a boolean. It was rewritten to assert the specific error message with `toThrow`, in the same style as the existing R5 property, so it checks *why* a quiz is rejected. The property was not weakened.
- **Order of checks:** the R4 backend property expects the explanation error message specifically. This relies on the generated questions being otherwise valid (at least two options, exactly one matching correct answer), because `validateQuiz` checks those first.


### Checks that the tests can fail

Each property was run against deliberately broken copies of the code, which were then reverted:

- `selectAnswer` keeping the first pick: 2 R2 properties failed.
- Grading by case- and whitespace-insensitive comparison: 3 R1 properties and 1 R5 property failed.
- `validateQuiz` accepting a correct answer that matches several options: 2 R5 properties failed.
- `validateQuiz` with its explanation check removed: the backend R4 and R6 properties failed (2 properties).
- `questionFeedback` always showing "Explanation unavailable": 1 R4 property and both R6 TUI properties failed.
- `questionFeedback` trimming real explanations: 1 R4 property and both R6 TUI properties failed.
- Grading that depends on the explanation's length: 2 R1, 1 R5, 1 R4, and both R6 TUI properties failed.

### Final results

- **Commands:** `bun test test/question-feedback.property.test.ts` (in `packages/tui`) and `bun test test/quiz/` (in `packages/opencode`).
- **Property tests:** all 20 pass (14 in `packages/tui`, 6 in `packages/opencode`).
- **Regressions:** the full `packages/tui` suite passed (217 pass, 1 skip, 0 fail; the skipped test is an existing one). The `packages/opencode` quiz tests passed (`test/quiz/` and `test/tool/quiz.test.ts`, 26 pass). `bun typecheck` passed in both `packages/tui` and `packages/opencode`.

## Code and CI changes

- **Refactor for testability (R2), behavior unchanged:** `selectAnswer(answers, tab, answer)` was extracted into `question-feedback.ts`. `pick()` in `question.tsx` now calls it in place of its previous three inline lines. The `isSubmitted()` lock, custom-answer handling, and tab advance stay in `pick()` as before.
- **R4 fix:** `questionFeedback` returns "Explanation unavailable" for a missing, empty, or whitespace-only explanation. `question.tsx` needed no change because it already renders `feedback.explanation`. Generation errors are covered by the revised acceptance criteria instead ("no quiz is displayed"); no code was changed for them.
- **CI:** `turbo.json` previously had no `@opencode-ai/tui#test` task. `bun turbo test` in `.github/workflows/test.yml` therefore skipped every TUI test, including the existing `question-feedback.test.ts` and all the new TUI property tests (R1, R2, R4, R5).
  - Following `TESTING.md`, I added that one entry, and updated the `turbo.json` snippet in `TESTING.md` to match.
  - A `bun turbo test --dry-run` confirms `@opencode-ai/tui#test` is now scheduled. The opencode property tests are covered by the existing `opencode#test` entry.
- **CI log visibility:** both package `test` scripts run `bun test --only-failures`, which hides the names of passing tests, so the `bun turbo test` step only prints pass/fail counts. I added a step, "Run Quiz Mode property tests," to `.github/workflows/test.yml` after "Run unit tests". It runs `generator.property.test.ts` and `question-feedback.property.test.ts` without `--only-failures`, so the log lists all 20 properties by name. The existing test commands are unchanged.
  - Running this step's commands locally printed a `(pass)` line for each of the 20 properties. Note: recent Bun versions also hide passing tests when they detect an AI coding agent's environment variables (such as `CLAUDECODE`), so the check was run with those variables unset, as they are in GitHub Actions.

## AI assistance disclosure

I used Claude Code (Anthropic's AI coding assistant) for Project 4B. Claude Code's contributions were:

- **Property tests.** It suggested and wrote all 20 property-based tests listed above (R1, R2, R4, R5, R6), including their generators and comments.
- **Code changes.** It suggested and wrote:
  - the `selectAnswer` extraction in `question-feedback.ts` and the matching call in `question.tsx`;
  - the R4 fallback fix in `questionFeedback`;
  - the update to the outdated unit test in `question-feedback.test.ts`;
  - the `@opencode-ai/tui#test` entry in `turbo.json` and the matching `TESTING.md` snippet;
  - the "Run Quiz Mode property tests" step in `.github/workflows/test.yml`.
- **Running and triage.** It ran the properties (including the R4 run before the fix), the regression suites, the typechecks, and the deliberate broken-code checks. It drafted the triage, root-cause, and fix write-ups.
- **Documentation.** It drafted the requirements review, the wording of the R4 revision (from my instructions on what the revised criteria must say), the specification notes and limitations, and this traceability document.

The original requirement text, acceptance criteria, and interview evidence come from my Project 4A workbook and were not written by Claude Code. Decisions on what to do were mine:

- which requirements to test (R1, R2, R4, R5, R6);
- keeping R3 unchanged and not selecting it for property-based testing;
- revising R4's acceptance criteria (what the revised criteria must say) instead of changing the quiz generator.

## Remaining work

- [ ] R7: decide on and document any revision.
- [ ] Open the PR to `main`, get a teammate review, and confirm the `test` check passes and its "Run Quiz Mode property tests" step lists all 20 properties.
