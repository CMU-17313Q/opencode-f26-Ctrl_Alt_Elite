import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Question } from "../question"
import { QuizGenerator } from "../quiz/generator"
import { Provider } from "@/provider/provider"
import { Auth } from "@/auth"
import DESCRIPTION from "./quiz.txt"

export const Parameters = Schema.Struct({
  analysis: Schema.String.annotate({ description: "Analysis of the code changes: what changed and why" }),
})

type Metadata = {
  answers: ReadonlyArray<Question.Answer>
}

export const QuizTool = Tool.define<typeof Parameters, Metadata, Question.Service | Provider.Service | Auth.Service>(
  "quiz",
  Effect.gen(function* () {
    const question = yield* Question.Service
    const provider = yield* Provider.Service
    const auth = yield* Auth.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          const lastUser = ctx.messages.findLast((item) => item.info.role === "user" && item.info.model)
          const quiz = yield* QuizGenerator.generate({
            analysis: params.analysis,
            model: lastUser?.info.role === "user" ? lastUser.info.model : undefined,
          }).pipe(Effect.provideService(Provider.Service, provider), Effect.provideService(Auth.Service, auth))

          // correctAnswer and explanation are sent so the TUI can give feedback per question; the tool output omits them.
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: quiz.questions.map((item, index) => ({
              question: item.question,
              header: `Question ${index + 1}`,
              options: item.options.map((opt) => ({
                label: opt.label,
                description: opt.description,
              })),
              correctAnswer: item.correctAnswer,
              explanation: item.explanation,
              multiple: false,
              custom: false,
            })),
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          const formatted = quiz.questions
            .map(
              (item, index) =>
                `"${item.question}"="${answers[index]?.length ? answers[index].join(", ") : "Unanswered"}"`,
            )
            .join(", ")

          return {
            title: `Quizzed on ${quiz.questions.length} question${quiz.questions.length > 1 ? "s" : ""}`,
            output: `User has answered the quiz: ${formatted}.`,
            metadata: {
              answers,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
