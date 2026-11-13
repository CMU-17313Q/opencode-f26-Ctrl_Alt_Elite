import { Effect, Schema } from "effect"
import { generateObject, streamObject, type ModelMessage } from "ai"
import { Provider } from "@/provider/provider"
import { Auth } from "@/auth"
import { ProviderTransform } from "@/provider/transform"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"

const BANNED_EXTREME_WORDS = /(?:^|[^a-z0-9_])(?:always|never|only)(?=$|[^a-z0-9_])/i
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

export function isTrivialChange(analysis: string) {
  const normalized = analysis.trim()
  if (!normalized) return true

  if (/^\s*$/u.test(normalized)) return true

  if (/\brenamed?\s+to\b/i.test(normalized) || /->|=>/.test(normalized)) return true

  return /^[\s\W_+\-=/{}\[\]();:,.<>!?'"\n\t]*$/u.test(normalized)
}

export function questionContainsCorrectAnswerLabel(question: QuizQuestion) {
  const answer = question.correctAnswer.trim()
  if (!answer) return false

  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`, "i")
  return pattern.test(question.question)
}

export function containsBannedExtremeWord(value: string) {
  return BANNED_EXTREME_WORDS.test(value)
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "function",
  "how",
  "if",
  "in",
  "is",
  "it",
  "its",
  "not",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "without",
])

function extractIdentifierCandidates(text: string) {
  return Array.from(text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*\b/g), (match) => match[0]).filter(
    (identifier) =>
      !STOP_WORDS.has(identifier.toLowerCase()) &&
      (/[A-Z_]/.test(identifier) || identifier.includes("_")),
  )
}

function extractChangedIdentifiers(analysis: string) {
  const exactChanged = analysis.match(/\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s+(?:changed|updated|modified|fixed)\b/i)
  if (exactChanged) return [exactChanged[1]]

  const renamed = analysis.match(/\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s+renamed?\s+to\b/i)
  if (renamed) return [renamed[1]]

  return extractIdentifierCandidates(analysis)
}

export function isQuizQuestionGrounded(question: QuizQuestion, analysis: string) {
  const changedIdentifiers = new Set(extractChangedIdentifiers(analysis).map((identifier) => identifier.toLowerCase()))
  const questionIdentifiers = new Set(extractIdentifierCandidates(question.question).map((identifier) => identifier.toLowerCase()))

  if (questionIdentifiers.size === 0) return false

  for (const identifier of questionIdentifiers) {
    if (!changedIdentifiers.has(identifier)) {
      return false
    }
  }

  return true
}

export function validateQuiz(quiz: Quiz) {
  for (const question of quiz.questions) {
    if (question.options.length < 2) {
      throw new Error("Quiz questions must contain at least two answer choices")
    }

    if (question.options.some((option) => !option.label.trim())) {
      throw new Error("Each quiz option must have a non-empty label")
    }

    if (!question.explanation.trim()) {
      throw new Error("Each quiz question must have an explanation")
    }

    const matchingAnswers = question.options.filter(
      (option) => option.label === question.correctAnswer,
    )

    if (matchingAnswers.length !== 1) {
      throw new Error(
        "Each quiz question must have exactly one correct answer matching an option label",
      )
    }

    if (questionContainsCorrectAnswerLabel(question)) {
      throw new Error("Each quiz question must not contain the correct answer label in the question text")
    }

    if (
      [question.question, ...question.options.map((option) => `${option.label} ${option.description}`)].some(
        containsBannedExtremeWord,
      )
    ) {
      throw new Error("Quiz questions and options must not use extreme wording like always, never, or only")
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
  if (isTrivialChange(input.analysis)) {
    return { questions: [] }
  }

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