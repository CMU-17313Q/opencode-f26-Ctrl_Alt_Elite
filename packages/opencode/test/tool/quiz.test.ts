import { describe, expect } from "bun:test"
import path from "path"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Exit, Fiber, Queue } from "effect"
import { QuizTool } from "../../src/tool/quiz"
import { Question } from "../../src/question"
import { Command } from "../../src/command"
import { SessionID, MessageID } from "../../src/session/schema"
import { Agent } from "../../src/agent/agent"
import { Provider } from "@/provider/provider"
import { Auth } from "@/auth"
import { Truncate } from "@/tool/truncate"
import { testEffect } from "../lib/effect"
import { TestLLMServer, httpError } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import { TestInstance } from "../fixture/fixture"
import { EventV2Bridge } from "../../src/event-v2-bridge"

const ctx = {
  sessionID: SessionID.make("ses_test-session"),
  messageID: MessageID.make("msg_test-message"),
  callID: "test-call",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const quiz = {
  questions: [
    {
      question: "Why was the bounds check changed?",
      options: [
        { label: "Allow index 0", description: "Index 0 is a valid position" },
        { label: "Grow the array", description: "The array needs more room" },
      ],
      correctAnswer: "Allow index 0",
    },
    {
      question: "Which function now validates input?",
      options: [
        { label: "parse", description: "The parser entry point" },
        { label: "render", description: "The output formatter" },
        { label: "load", description: "The file loader" },
      ],
      correctAnswer: "parse",
    },
  ],
}

const it = testEffect(
  LayerNode.compile(
    LayerNode.group([
      Question.node,
      EventV2Bridge.node,
      Truncate.node,
      Agent.node,
      Provider.node,
      Auth.node,
      Command.node,
      LayerNode.make({ service: TestLLMServer, layer: TestLLMServer.layer, deps: [] }),
    ]),
  ),
)

// Points the instance at the fake LLM server, which answers the quiz generator's
// non-streaming structured output request with a plain chat completion body.
const serveQuiz = Effect.fn("QuizToolTest.serveQuiz")(function* () {
  const instance = yield* TestInstance
  const llm = yield* TestLLMServer
  yield* Effect.promise(() =>
    Bun.write(
      path.join(instance.directory, "opencode.json"),
      JSON.stringify({ ...testProviderConfig(llm.url), model: "test/test-model" }),
    ),
  )
  yield* llm.push(
    httpError(200, {
      id: "chatcmpl-quiz",
      object: "chat.completion",
      created: 0,
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(quiz) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  )
  return llm
})

const pending = Effect.fn("QuizToolTest.pending")(function* (question: Question.Interface) {
  const events = yield* EventV2Bridge.Service
  const asked = yield* Queue.unbounded<void>()
  const off = yield* events.listen((event) => {
    if (event.type === Question.Event.Asked.type) Queue.offerUnsafe(asked, undefined)
    return Effect.void
  })
  yield* Effect.addFinalizer(() => off)

  for (;;) {
    const items = yield* question.list()
    const item = items[0]
    if (item) return item
    yield* Queue.take(asked).pipe(Effect.timeout("5 seconds"))
  }
})

describe("tool.quiz", () => {
  it.instance("asks the generated quiz as single-choice questions without the correct answers", () =>
    Effect.gen(function* () {
      const llm = yield* serveQuiz()
      const question = yield* Question.Service
      const toolInfo = yield* QuizTool
      const tool = yield* toolInfo.init()

      const fiber = yield* tool
        .execute({ analysis: "The bounds check now allows index 0." }, ctx)
        .pipe(Effect.forkScoped)
      const item = yield* pending(question)

      expect(JSON.stringify(yield* llm.inputs)).toContain("The bounds check now allows index 0.")
      expect(item.sessionID).toBe(ctx.sessionID)
      expect(item.tool).toEqual({ messageID: ctx.messageID, callID: ctx.callID })
      expect(item.questions).toEqual([
        {
          question: "Why was the bounds check changed?",
          header: "Question 1",
          options: quiz.questions[0].options,
          multiple: false,
          custom: false,
        },
        {
          question: "Which function now validates input?",
          header: "Question 2",
          options: quiz.questions[1].options,
          multiple: false,
          custom: false,
        },
      ])
      expect(JSON.stringify(item)).not.toContain("correctAnswer")

      yield* question.reply({ requestID: item.id, answers: [["Grow the array"], ["render"]] })
      const result = yield* Fiber.join(fiber)

      expect(result.title).toBe("Quizzed on 2 questions")
      expect(result.metadata.answers).toEqual([["Grow the array"], ["render"]])
      expect(result.output).toContain('"Why was the bounds check changed?"="Grow the array"')
      expect(result.output).toContain('"Which function now validates input?"="render"')
      expect(result.output).not.toContain("Allow index 0")
      expect(result.output).not.toContain("parse")
    }),
  )

  it.instance("fails when the user dismisses the quiz", () =>
    Effect.gen(function* () {
      yield* serveQuiz()
      const question = yield* Question.Service
      const toolInfo = yield* QuizTool
      const tool = yield* toolInfo.init()

      const fiber = yield* tool
        .execute({ analysis: "The bounds check now allows index 0." }, ctx)
        .pipe(Effect.forkScoped)
      const item = yield* pending(question)
      yield* question.reject(item.id)

      expect(Exit.isFailure(yield* Fiber.await(fiber))).toBe(true)
      expect(yield* question.list()).toEqual([])
    }),
  )
})

describe("command.quiz", () => {
  it.instance("registers /quiz as a built-in command that runs in the current session", () =>
    Effect.gen(function* () {
      const commands = yield* Command.Service
      const command = yield* commands.get(Command.Default.QUIZ)

      expect(command?.source).toBe("command")
      expect(command?.subtask).toBeUndefined()
      expect(command?.hints).toEqual(["$ARGUMENTS"])
      expect(yield* Effect.promise(async () => command?.template)).toContain("`quiz` tool")
    }),
  )
})
