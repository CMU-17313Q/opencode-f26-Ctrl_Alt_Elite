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