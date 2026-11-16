
# Project 4B Requirement Traceability — Farida Abouelnaga (faboueln)

## Target feature

**Quiz Answer Checking and Validation**

Implementation:
- `packages/opencode/src/tool/quiz.ts`
- `packages/opencode/src/quiz/generator.ts`

Property tests: `packages/opencode/test/quiz/faboueln.property.test.ts`

## Traceability matrix

| ID | Interview evidence | Requirement | Acceptance criteria | Changed in P4B? | Property | Test | Kind | AI-assisted? |
|---|---|---|---|---|---|---|---|---|
| R1 | C-3, S-3, O-3: Answers must be checked correctly. | The system must accurately evaluate answers against the correct option. | Given a valid question with one correct answer, selecting the correct option is marked correct, while selecting any other option is marked incorrect. | No | For generated questions with unique option labels, `checkAnswer` returns `true` exactly for the label matching `correctAnswer`. | `faboueln.property.test.ts` — R1 | invariant | Yes |
| R2 | C-5, S-5, O-5: Only the final submitted answer should count. | The system must evaluate only the final selected answer, regardless of previous selections. | If a user selects A, changes to B, and submits B, only B is evaluated. | No | For generated selection histories ending in a final choice, calling `checkAnswer` with that last choice agrees with checking the final choice directly. This tests the answer-checking boundary, **not** the interactive selection-state implementation. | `faboueln.property.test.ts` — R2 | metamorphic | Yes |
| R3 | C-7, S-7, O-7: Rearranging answer options should not change correctness. | The system must recognize the correct answer regardless of its position. | Moving the correct answer to a different position must not change whether that answer is marked correct. | No | Reordering the options while keeping their labels and `correctAnswer` unchanged preserves the result of `checkAnswer` for every option. | `faboueln.property.test.ts` — R3 | metamorphic | Yes |
| R4 | C-2, S-2, O-2: Interviewees reported incorrect feedback when their original study context was ignored. | The checker must use the correct-answer label stored in the validated quiz question rather than independently inventing a different answer during checking. | Given a validated quiz question, checking a selected label uses its recorded `correctAnswer`; a correct answer is not inferred again from unrelated information. | Yes | Not independently tested under R4. R1 exercises the same local comparison, but does not verify that quiz generation faithfully reflects source materials. | — | — | No |
| R5 | C-1, S-10, O-1: Users want explanations for both correct and incorrect answers. | The system must provide an explanation after checking both correct and incorrect answers. | After a submission, the quiz shows correctness and a short explanation of the correct answer. | No | For generated valid questions, `validateQuiz` accepts a nonblank explanation and rejects a blank explanation. This checks **explanation validation only**, not whether the UI displays feedback after submission. | `faboueln.property.test.ts` — R5 | invariant | Yes |
| R6 | C-4, S-4, O-9: Users want to verify or question an incorrect evaluation. | Checking the same submitted answer against the same unchanged validated question must produce a consistent correctness result. | Repeating the same answer check without changing the question or answer produces the same correctness result. | Yes | Two calls to `checkAnswer` with identical inputs agree, for both correct and incorrect selected answers. This does **not** implement a user-triggered recheck against original materials. | `faboueln.property.test.ts` — R6 | invariant | Yes |

## Requirement changes

| Requirement ID | Original wording (P4A) | Revised wording (P4B) | Why it changed |
|---|---|---|---|
| R4 | The system must use the provided materials and question requirements when checking answers. | The checker must use the correct-answer label stored in the validated quiz question rather than independently inventing a different answer during checking. | The existing deterministic `checkAnswer` function receives a question and selected label, not the uploaded lecture materials. It can reliably check against the question's answer key, but cannot itself prove that the key matches the original materials. This revision makes the local checking rule feasible and testable while acknowledging the original interview concern remains only partly addressed. |
| R6 | The system must allow users to request a recheck of their answers. | Checking the same submitted answer against the same unchanged validated question must produce a consistent correctness result. | The inspected `checkAnswer` function supports repeated deterministic evaluations, but the inspected quiz implementation did not establish a separate user-requested, source-based recheck workflow. The revision is implementable and checkable, though narrower than what users asked for; a full recheck feature remains future work. |

## Property tests and generator rationale

The shared `questionArbitrary` generator creates questions with 2–5 unique, nonempty option labels, picks a correct option from those labels, and supplies a nonempty explanation. This exercises multiple answer positions, correct and incorrect choices, and different valid question sizes rather than relying on one hard-coded example.

- **R1 (invariant):** Check all option labels in each generated question against the correct-answer label.
- **R2 (metamorphic):** Generate earlier selection histories and a final submitted choice; check the final choice. Because earlier selections are not accepted by `checkAnswer`, this is a **unit-level approximation**, not an end-to-end UI test.
- **R3 (metamorphic):** Shuffle the options while preserving their labels and answer key; compare all answer-checking results before and after.
- **R5 (invariant):** Validate a question with an explanation, then change its explanation to whitespace and verify the validator rejects it.
- **R6 (invariant):** Repeat checking an unchanged question and selected option, covering both correct and incorrect selections.

The generator avoids duplicate option labels so the correct answer is unambiguous. The R5 test explicitly explores the empty/whitespace explanation boundary. These tests check the deterministic quiz implementation, not the quality of AI-generated questions or the UI's full feedback and recheck experience.

## Test execution and triage

Local command (run from `packages/opencode`):

```bash
bun test test/quiz/
```

Observed local result: **28 passed, 0 failed, 11,471 assertions across 4 files**. The five tests in `faboueln.property.test.ts` also passed individually. No failures were observed in these runs, so no code-bug triage was required. GitHub Actions results must be verified separately after opening the pull request.

## AI assistance disclosure

ChatGPT assisted with drafting the traceability matrix, proposing requirement revisions, and writing or suggesting the R1, R2, R3, R5, and R6 property tests and generators. The six original requirements and interview evidence came from my Project 4A workbook. I ran the tests locally and checked their results. The documented limitations distinguish the behavior actually tested from UI or source-grounding behavior that has not been tested.
