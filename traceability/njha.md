# Project 4B requirement traceability — Nancy Jha (njha / Ctrl+Alt_Elite)

## Traceability matrix

| ID | Interview evidence | Requirement | Acceptance criteria | Changed in P4B? | Property | Test | Kind | AI-assisted? |
|---|---|---|---|---|---|---|---|---|
| R1 | S-2, C-2 | Every quiz question must have at least two answer choices and exactly one correct answer, and the answer key must match an option label exactly. | A question with options "Allow index 0" and "Increase array size" and key "Allow index 0" is accepted. One option -> rejected with "Quiz questions must contain at least two answer choices". Key "Choice C" with options "Choice A","Choice B" -> rejected. Two options both labeled "Choice A" with key "Choice A" -> rejected. | No | `validateQuiz` accepts iff the data has >=2 options and exactly one option label matches the key. | Property-based invariant over valid/invalid option sets and duplicate labels. | invariant | No |
| R2 | O-2, S-3 | Questions must be about code changed in the diff, not untouched code. | If only `parseDate` in `utils.ts` changed and `formatName` is untouched, all 3 questions refer to `parseDate`/its change and none refer to `formatName`. | Yes | Generated question text and option text must only contain identifiers present in the changed diff and not any untouched names. | Pure validator post-processing on generated questions. | invariant | Yes |
| R3 | C-3, S-4 | If a change is fully reverted (no net difference from baseline), the quiz must not ask about the reverted code and reports there is nothing to quiz on. | Edit `if (x > 0)` to `>=`, revert so tree matches baseline; `/quiz` produces zero questions and shows a "no changes to quiz" message. | Yes | A fully reverted diff has no coffee of quiz-worthy change; `isTrivialChange`/`isNoopDiff` rejects before LLM call. | Property-based no-op diff detection and empty-quiz output. | model/oracle | Yes |
| R4 | S-4, C-4 | If the diff deletes a feature/code, the quiz may ask why it was removed, and the correct answer must reflect the removal. | Diff deleting `scaleResults()` and its call site yields at least one question about the removal and none describe `scaleResults()` as still present. | Yes | Removal candidates must reference a deleted symbol and validation must reject questions whose explanation/option text claims the symbol still exists. | Property-based validation of delete-analysis strings with symbol-match checks. | invariant | Yes |
| R5 | S-3, O-3, C-5 | Changes that are only a variable rename, whitespace or formatting must not generate quiz questions (exception: a repo style rule). | A diff that only renames `count` to `total`, no behavior change, produces no quiz and a "no significant changes" message. | Yes | `isTrivialChange` returns true for renames/formatting-only diffs, so generation is skipped before any LLM call. | Property-based triviality classification over rename-only and whitespace-only diffs. | model/oracle | Yes |
| R6 | C-5, S-5 | A small logic edit such as `>` to `>=` must change the quiz only slightly: at most one question about that edit, other questions stay on the same topics. | Quiz A from diff D; Quiz B from D plus one `>` to `>=` edit; at least 2 of 3 questions in B cover the same topics as A, at most 1 is about the operator change. | Yes | A small semantically equivalent change should not churn the topic set; a diff-scope validator ensures a single question is allowed to cover the edit. | Metamorphic property comparing base diff vs. one-line logic tweak. | metamorphic | Yes |
| R7 | S-2, S-7, S-8, O-4, O-5, C-6 | The correct answer and feedback must match what the code actually does and use specific names from the diff. `checkAnswer` must mark only the key as correct. | For a diff replacing recursive DFS with queue-based BFS, the key names breadth-first/queue, never depth-first. Feedback names changed identifiers, not generic "elements". `checkAnswer(question,key)` is true and `checkAnswer(question,otherOption)` is false. | No | `checkAnswer` is a pure equality check; result must be true only for the exact `correctAnswer` string. | Existing deterministic unit tests plus property-based option-label permutations. | invariant | No |
| R8 | S-6, C-7, O-2 | Questions must be multiple choice with plausible distractors and must not give away the answer: question text must not contain the correct answer, and no option may use extreme words (always, never, only). | Correct option label never appears verbatim in the question text; no option label/description contains "always", "never", "only"; no question asks the user to write code. | Yes | A post-generation validator rejects or filters any question where the textual question contains the correct label or any option includes banned extreme terms. | Property-based validation of generated question text and choices. | invariant | Yes |

## Requirement changes

| Requirement ID | Original wording | Revised wording | Why it changed |
|---|---|---|---|
| R2 | Questions must be about code changed in the diff, not untouched code. | Generated question text and option text must only reference identifiers present in the changed diff; any touched identifier must be explicit in the analyzed diff; untouched names are rejected before the quiz is returned. | The original wording is an LLM-quality requirement that cannot be guaranteed in every case. The deterministic fix is to validate generated question text against the actual diff identifiers and reject or filter non-diff references. |
| R3 | If a change is fully reverted (no net difference from baseline), the quiz must not ask about the reverted code and reports there is nothing to quiz on. | When the diff is empty, whitespace-only, or fully reverted, skip LLM generation and return a "no changes to quiz" result before any quiz object is created. | This is checkable by a pure function before calling the LLM and is more robust than relying on model compliance. |
| R4 | If the diff deletes a feature/code, the quiz may ask why it was removed, and the correct answer must reflect the removal. | If the diff contains a deleted symbol reference, the quiz may ask about the removal, but the selected answer must mention the removed identifier and the validation must reject claims that the removed code still exists. | This preserves the user need while making the guarantee enforceable through a deterministic removal check instead of trusting the LLM to stay on the right side of the statement. |
| R5 | Changes that are only a variable rename, whitespace or formatting must not generate quiz questions (exception: a repo style rule). | A rename-only, whitespace-only, or formatting-only diff is classified as trivial by a pure diff-analysis function and returns no quiz with a "no significant changes" message before the model is called. | This is a classic deterministic gate: the change is either trivial or it is not, and the LLM should not be invoked on a trivial diff. |
| R6 | A small logic edit such as `>` to `>=` must change the quiz only slightly: at most one question about that edit, other questions stay on the same topics. | A single-line logic tweak is treated as a localized change: the quiz may include at most one question about the edited condition, and the topic validator must reject or rewrite broader drift. | The original requirement is too subjective and inconsistent across LLM outputs. A deterministic topic-scope check is more stable and still preserves the intended user experience. |
| R8 | Questions must be multiple choice with plausible distractors and must not give away the answer: question text must not contain the correct answer, and no option may use extreme words (always, never, only). | The quiz validator rejects any generated question whose text contains the correct option label verbatim and any option text containing banned extreme qualifiers (`always`, `never`, `only`) in any casing. | This is fully deterministic and directly aligned with the user’s actual complaint: model outputs that clearly reveal the answer or use obviously extreme distractors. |

## Proposed pure functions to add before implementation

The changes above should be handled in `src/quiz/` with small deterministic helpers instead of changing the public behavior of `validateQuiz`, `checkAnswer`, or `generate`.

- `isTrivialChange(diff: string): boolean`
  - Returns true for empty diffs, whitespace-only diffs, rename-only diffs, and formatting-only diffs.
- `isRemovalChange(diff: string): boolean`
  - Detects a deleted function, class, or call site from the diff text.
- `extractDiffIdentifiers(diff: string): Set<string>`
  - Collects the identifiers actually mentioned in the changed code to keep generated quiz data grounded in the diff.
- `isQuestionTextSafe(question: QuizQuestion, diffIdentifiers: Set<string>): boolean`
  - Rejects any question whose text references identifiers not in the diff.
- `containsBannedExtremeWord(text: string): boolean`
  - Matches `always`, `never`, and `only` case-insensitively.
- `questionContainsCorrectAnswerLabel(question: QuizQuestion): boolean`
  - Detects label leakage from the question text to the correct answer label.

These helpers are intentionally pure and can be validated with property-based tests without introducing any LLM-dependent behavior into the test suite.

## Notes for implementation after confirmation

- Keep all implementation changes minimal and local to `packages/opencode/src/quiz/`.
- Preserve the current public behavior of `validateQuiz` and `checkAnswer` exactly.
- Add the new property tests in `packages/opencode/test/quiz/quiz.property.test.ts` using `bun:test` and `fast-check`.
- Do not change the current LLM-backed `generate` contract except for the narrow pre-checks and post-generation validation described above.
