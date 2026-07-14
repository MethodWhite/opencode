import { Context, Effect, Layer, Schema } from "effect"
import { Wildcard } from "../util/wildcard"
import { PermissionSchema } from "./schema"

export type Rule = PermissionSchema.Rule
export type Ruleset = PermissionSchema.Ruleset

export function evaluate(action: string, resource: string, ...rulesets: Ruleset[]): Rule {
  return (
    rulesets
      .flat()
      .findLast((rule) => Wildcard.match(action, rule.action) && Wildcard.match(resource, rule.resource)) ?? {
      action,
      resource: "*",
      effect: "ask",
    }
  )
}

export function merge(...rulesets: Ruleset[]): Rule[] {
  return rulesets.flat()
}

export interface Interface {
  readonly assert: (input: unknown) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Permission") {}


export const locationLayer: Layer.Layer<Service> = Layer.succeed(
  Service,
  Service.of({ assert: () => Effect.void }),
)

export * as PermissionV2 from "./v2"
