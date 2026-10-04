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