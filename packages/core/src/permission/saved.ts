import { Context, Effect, Layer, Schema } from "effect"

export const ID = Schema.String.pipe(Schema.brand("PermissionSaved.ID"))
export type ID = typeof ID.Type

export interface Interface {}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/PermissionSaved") {}

export const defaultLayer: Layer.Layer<Service> = Layer.succeed(Service, Service.of({}))

export * as PermissionSaved from "./saved"
