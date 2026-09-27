import { Effect, Schema } from "effect"
import { generateObject, streamObject, type ModelMessage } from "ai"
import { Provider } from "@/provider/provider"
import { Auth } from "@/auth"
import { ProviderTransform } from "@/provider/transform"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"

export const QuizOption = Schema.Struct({
  label: Schema.String,
  description: Schema.String,
})

export type QuizOption = typeof QuizOption.Type

export const QuizQuestion = Schema.Struct({
  question: Schema.String,
  options: Schema.Array(QuizOption),
  correctAnswer: Schema.String,
  explanation: Schema.String,
})

export type QuizQuestion = typeof QuizQuestion.Type

export const Quiz = Schema.Struct({
  questions: Schema.Array(QuizQuestion),
})

export type Quiz = typeof Quiz.Type

export function validateQuiz(quiz: Quiz) {
  for (const question of quiz.questions) {
    if (question.options.length < 2) {
      throw new Error("Quiz questions must contain at least two answer choices")
    }

    const matchingAnswers = question.options.filter(
      (option) => option.label === question.correctAnswer,
    )

    if (matchingAnswers.length !== 1) {
      throw new Error(
        "Each quiz question must have exactly one correct answer matching an option label",
      )
    }

    if (!question.explanation) {
      throw new Error("Each quiz question must have an explanation")
    }
  }
}

export function checkAnswer(
  question: QuizQuestion,
  selectedAnswer: string,
) {
  return selectedAnswer === question.correctAnswer
}

export const generate = Effect.fn("Quiz.generate")(function* (input: {
  analysis: string
  model?: {
    providerID: ProviderV2.ID
    modelID: ModelV2.ID
  }
}) {
  const provider = yield* Provider.Service
  const auth = yield* Auth.Service

  const model = input.model ?? (yield* provider.defaultModel())
  const resolved = yield* provider.getModel(model.providerID, model.modelID)
  const language = yield* provider.getLanguage(resolved)

  const system = [
    `You generate short multiple-choice quizzes that test a student's understanding of code changes.

Each question must:
- be directly related to the supplied code-change analysis
- test what changed or why it changed
- have multiple answer choices
- have exactly one correct answer (use the exact label of the correct option in correctAnswer)
- provide an explanation for the correct answer

Generate 3 questions.`,
  ]

  const params = {
    temperature: 0.3,
    messages: [
      ...system.map(
        (item): ModelMessage => ({
          role: "system",
          content: item,
        }),
      ),
      {
        role: "user",
        content: `Generate a quiz from this code-change analysis:\n\n${input.analysis}`,
      },
    ],
    model: language,
    schema: Object.assign(
      Schema.toStandardSchemaV1(Quiz),
      Schema.toStandardJSONSchemaV1(Quiz),
    ),
  } satisfies Parameters<typeof generateObject>[0]

  const authInfo = yield* auth.get(model.providerID).pipe(Effect.orDie)
  const isOpenaiOauth = model.providerID === "openai" && authInfo?.type === "oauth"

  const quiz = isOpenaiOauth
    ? yield* Effect.promise(async () => {
        const result = streamObject({
          ...params,
          providerOptions: ProviderTransform.providerOptions(resolved, {
            instructions: system.join("\n"),
            store: false,
          }),
          onError: () => {},
        })

        for await (const part of result.fullStream) {
          if (part.type === "error") throw part.error
        }

        return result.object
      })
    : yield* Effect.promise(() =>
        generateObject(params).then((result) => result.object),
      )

  validateQuiz(quiz)

  return quiz
})

export * as QuizGenerator from "./generator"