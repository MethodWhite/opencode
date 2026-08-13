import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Session } from "@/session/session"
import { Provider } from "@/provider/provider"
import { MessageID, PartID } from "../session/schema"
import SWITCH_MODE_DESCRIPTION from "./switch-mode.txt"

export const Parameters = Schema.Struct({
  mode: Schema.Literals(["plan", "compose", "build", "auto", "yolo"]),
  reason: Schema.optional(Schema.String),
  instruction: Schema.optional(Schema.String),
})

export const SwitchModeTool = Tool.define(
  "switch_mode",
  Effect.gen(function* () {
    const session = yield* Session.Service
    const provider = yield* Provider.Service

    return {
      description: SWITCH_MODE_DESCRIPTION,
      parameters: Parameters,
      execute: (
        params: {
          mode: "plan" | "compose" | "build" | "auto" | "yolo"
          reason?: string
          instruction?: string
        },
        ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const messages = yield* session.messages({ sessionID: ctx.sessionID }).pipe(Effect.orDie)
          const lastUser = messages.findLast((item) => item.info.role === "user" && item.info.model)
          const model =
            lastUser?.info.role === "user" && lastUser.info.model ? lastUser.info.model : yield* provider.defaultModel()

          const msg: SessionV1.User = {
            id: MessageID.ascending(),
            sessionID: ctx.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: params.mode,
            model,
          }
          yield* session.updateMessage(msg)

          const text = [
            `You are now in ${params.mode} mode.`,
            params.reason ? `Reason: ${params.reason}` : undefined,
            params.instruction ? `Instructions: ${params.instruction}` : undefined,
          ]
            .filter((item): item is string => Boolean(item))
            .join("\n")

          yield* session.updatePart({
            id: PartID.ascending(),
            messageID: msg.id,
            sessionID: ctx.sessionID,
            type: "text",
            text,
            synthetic: true,
          } satisfies SessionV1.TextPart)

          return {
            title: `Switching to ${params.mode} agent`,
            output: `Switched to ${params.mode} mode. Continue working on the user's request.`,
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)
