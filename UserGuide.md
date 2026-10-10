# User Guide

This guide explains how to use and test the features implemented by the Ctrl_Alt_Elite team.

## Quiz Generation and Answer Checking

### Feature Overview

The quiz backend generates multiple-choice questions based on an analysis of a student's code changes. The questions are intended to test whether the student understands what changed and why it changed.

Each generated question contains:
- A question
- Multiple answer choices
- A description for each answer choice
- One correct answer

The answer-checking functionality compares the student's selected answer with the correct answer and determines whether the response is correct or incorrect.

### How to Test the Feature

The automated tests for this feature are located at:

`packages/opencode/test/quiz/generator.test.ts`

From the repository root, run:

```bash
cd packages/opencode
bun test test/quiz/generator.test.ts
```

A successful run should show all 6 tests passing.

### Automated Test Coverage

The automated tests verify that:

- A valid quiz with multiple answer choices and one matching correct answer is accepted.
- A question with fewer than two answer choices is rejected.
- A question whose correct answer does not match any answer choice is rejected.
- A question with more than one answer choice matching the correct answer is rejected.
- Selecting the correct answer returns `true`.
- Selecting an incorrect answer returns `false`.

These tests cover both valid and invalid quiz structures as well as the answer-checking behavior. This verifies the main requirements of question generation and answer checking, including having multiple choices, exactly one matching correct answer, and correctly determining whether a student's selected answer is correct.

### Implementation Files

The quiz generation and answer-checking implementation is located at:

`packages/opencode/src/quiz/generator.ts`

The automated tests are located at:

`packages/opencode/test/quiz/generator.test.ts`

## Multiple-Choice Question Display

### Feature Overview

Quiz questions are displayed using OpenCode's existing question dock. For multiple-choice quiz questions, `custom` is set to `false`, so students only see the provided answer choices and do not see the free-response option.

### How to Test the Feature

Start a quiz and check that each question only displays the provided multiple-choice options. Select an answer, move between the questions, and submit the quiz. There should be no custom free-response option.

The automated E2E test for this feature is located at:

`packages/app/e2e/regression/session-request-docks.spec.ts`

From the repository root, run:

```bash
cd packages/app
bunx playwright test e2e/regression/session-request-docks.spec.ts
```

A successful run should show all 4 tests passing.

### Automated Test Coverage

The E2E test uses a three-question multiple-choice quiz and verifies that:

- The questions and answer options are displayed correctly.
- The custom free-response option is not shown.
- A student can select an answer.
- A student can move between questions.
- The answers can be submitted successfully.

This test covers the user-facing behavior changed for the multiple-choice question display by testing the full interaction through the question dock.

### Implementation Files

The multiple-choice display behavior is implemented in:

`packages/app/src/pages/session/composer/session-question-dock.tsx`

The E2E test is located at:

`packages/app/e2e/regression/session-request-docks.spec.ts`

## Starting the Quiz with /quiz

### Feature Overview

Users can start a quiz by typing the `/quiz` command in a session. `/quiz` is a built-in command, like `/review`, so it shows up in the slash command menu.

When a user runs `/quiz`, the agent looks at the user's uncommitted code changes (or a commit, branch, or files given after the command, such as `/quiz HEAD~1`) and writes a short analysis of what changed and why. It then calls the new `quiz` tool with that analysis.

The `quiz` tool reuses existing parts of OpenCode instead of adding a new quiz system:
- It uses the existing quiz generator to create the multiple-choice questions from the analysis.
- It sends the questions through the existing Question system, so they appear in the existing question dock.
- Each question is sent with `multiple` set to `false` and `custom` set to `false`, so the student picks exactly one of the generated answer choices and there is no free-response option.

When the student submits, the tool returns the selected answers to the agent. The tool's output only lists each question and the student's answer, so the agent is not given the correct answers.

Note: when `/quiz` was first added, `correctAnswer` was kept on the backend and was not sent to the frontend. The later immediate feedback feature (Issue #8) changed this, so the question request now also includes `correctAnswer` and `explanation` so that feedback can be shown right after a question is answered.

### How to Test the Feature

To test `/quiz` manually:

1. Start the backend and the app, then open a project that is a git repository.
2. Make a small uncommitted change in that project so there is something to be quizzed on.
3. In a session, type `/quiz` and press Enter.
4. The agent should look at the changes and then call the `quiz` tool. After a few seconds, the question dock should show the quiz questions with their answer choices and no free-response option.
5. Select an answer for each question and submit the quiz.

The automated tests for this feature are located at:

`packages/opencode/test/tool/quiz.test.ts`

From the repository root, run:

```bash
cd packages/opencode
bun test test/tool/quiz.test.ts
```

A successful run should show all 3 tests passing.

### Automated Test Coverage

The tests use OpenCode's fake LLM test server to return a fixed two-question quiz, so they do not depend on a real model.

The automated tests verify that:

- The analysis passed to the `quiz` tool is sent to the model when generating the quiz.
- The generated questions are sent to the Question system for the correct session and tool call.
- Each question keeps its generated text and answer choices, has a `Question 1`/`Question 2` header, and has `multiple` and `custom` set to `false`.
- The question request includes `correctAnswer` and `explanation`, which are used by the immediate feedback feature.
- After the student replies, the tool returns the selected answers, and its output lists each question with the student's answer without including the correct answers.
- If the student dismisses the quiz, the tool stops and no question is left pending.
- `/quiz` is registered as a built-in command that runs in the current session, accepts arguments, and tells the agent to use the `quiz` tool.

These tests cover each step of the `/quiz` integration: the command that starts the quiz, generating questions from the analysis, sending them to the question dock as single-choice questions, and returning the student's answers. The question dock display itself is already covered by the Multiple-Choice Question Display E2E test.

### Implementation Files

The `/quiz` command is registered in:

`packages/opencode/src/command/index.ts`

The instructions given to the agent when `/quiz` runs are in:

`packages/opencode/src/command/template/quiz.txt`

The `quiz` tool is implemented in:

`packages/opencode/src/tool/quiz.ts`

The description of the `quiz` tool shown to the agent is in:

`packages/opencode/src/tool/quiz.txt`

The `quiz` tool is added to OpenCode's built-in tools in:

`packages/opencode/src/tool/registry.ts`

The automated tests are located at:

`packages/opencode/test/tool/quiz.test.ts`

## Immediate Feedback on Quiz Questions

### Feature Overview

When a quiz is shown in the terminal UI (TUI), students can check each question as they go instead of waiting until the end of the quiz. After picking an answer, the student presses `s` to submit that question for feedback. The TUI then shows:

- `✓ Correct!` or `✗ Incorrect`
- The correct answer
- An explanation of why it is correct

Once a question is submitted it is locked, so the answer cannot be changed after the correct answer has been revealed. The student then presses Enter or Tab to go to the next question, and submits the whole quiz from the Review tab as before.

To support this, the quiz generator now asks the model for an `explanation` for every question, and `validateQuiz` rejects any question without one. The `quiz` tool sends each question's `correctAnswer` and `explanation` along with the question so the TUI can show feedback without another request to the server. The tool's output to the agent still only lists the student's answers.

Feedback is only used for quiz questions, which are the ones that include a `correctAnswer`. Regular questions that the agent asks with the `question` tool behave the same as before: Enter selects the highlighted answer, and there is no `s` key or feedback.

### How to Test the Feature

To test immediate feedback manually:

1. From the repository root, start OpenCode in the terminal with `bun dev`, inside a project that is a git repository.
2. Make a small uncommitted change in that project.
3. Type `/quiz` and press Enter. After a few seconds, the quiz questions appear at the bottom of the TUI.
4. Press the number key of an answer (for example `1`) to select it, or click it. Then press `s`.
5. Check that the TUI shows whether the answer was correct, the correct answer, and an explanation, and that the arrow keys and number keys no longer change the answer.
6. Press Enter to move to the next question. Choose a wrong answer on purpose and press `s` to check that `✗ Incorrect` and the correct answer are shown.
7. Answer the remaining questions, go to the Review tab, and press Enter to submit the quiz.
8. To check that regular questions are unaffected, ask the agent to "ask me a question with the question tool, with three options". Pressing Enter should select the highlighted answer, and the footer should not show `s submit for feedback`.

The automated tests for this feature are located at:

- `packages/tui/test/question-feedback.test.ts`
- `packages/opencode/test/quiz/generator.test.ts`
- `packages/opencode/test/tool/quiz.test.ts`

From the repository root, run:

```bash
cd packages/tui
bun test test/question-feedback.test.ts
cd ../opencode
bun test test/quiz/generator.test.ts test/tool/quiz.test.ts
```

A successful run should show 7 tests passing in `packages/tui` and 10 tests passing in `packages/opencode`.

### Automated Test Coverage

The logic that decides what feedback to show is in `questionFeedback`, a small function the TUI calls when the student presses `s`. Keeping it separate from the UI code means it can be tested directly.

`packages/tui/test/question-feedback.test.ts` verifies that:

- A correct answer is marked correct, and the correct answer and explanation are returned.
- A wrong answer is marked incorrect, and the correct answer is still shown.
- Answers are compared exactly, so different capitalization or extra spaces are not counted as correct.
- No feedback is given if the student has not picked an answer yet.
- No feedback is given for regular agent questions that do not have a `correctAnswer`.
- A missing explanation does not break the feedback.

`packages/opencode/test/quiz/generator.test.ts` verifies that a generated question without an explanation is rejected, along with the existing checks that every question has at least two choices and exactly one correct answer.

`packages/opencode/test/tool/quiz.test.ts` verifies that the `quiz` tool sends each question's `correctAnswer` and `explanation` to the question dock, while the tool's output to the agent still does not include the correct answers.

Together these cover the acceptance criteria for this feature: the data needed for feedback is generated and validated on the server, it reaches the question dock, and the TUI computes the right result for correct, incorrect, and unanswered questions without affecting regular questions. Locking a question after it is submitted and the key bindings are UI behavior, so they are covered by the manual steps above.

### Implementation Files

The feedback logic is in:

`packages/tui/src/routes/session/question-feedback.ts`

The TUI question prompt, including the `s` key, locking submitted questions, and showing feedback, is in:

`packages/tui/src/routes/session/question.tsx`

The `correctAnswer` and `explanation` fields are added to the question schema in:

`packages/schema/src/question.ts`
`packages/schema/src/v1/question.ts`

The quiz generator, which asks the model for explanations and validates them, is in:

`packages/opencode/src/quiz/generator.ts`

The `quiz` tool, which sends the correct answers and explanations with each question, is in:

`packages/opencode/src/tool/quiz.ts`
