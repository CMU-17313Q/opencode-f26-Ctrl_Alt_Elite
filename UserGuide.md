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