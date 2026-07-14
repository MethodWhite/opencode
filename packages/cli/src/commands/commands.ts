import { Argument, Flag } from "effect/unstable/cli"
import { Spec } from "../framework/spec"

declare const OPENCODE_CLI_NAME: string | undefined

export const Commands = Spec.make(typeof OPENCODE_CLI_NAME === "string" ? OPENCODE_CLI_NAME : "opencode", {
  description: "OpenCode 2.0 preview command line interface",
  commands: [
    Spec.make("api", {
      description: "Make a request to the running server",
      params: {
        request: Argument.string("operation | method path").pipe(
          Argument.withDescription("OpenAPI operation ID, or an HTTP method followed by a path"),
          Argument.variadic({ min: 1, max: 2 }),
        ),
        data: Flag.string("data").pipe(Flag.withAlias("d"), Flag.withDescription("Request body"), Flag.optional),
        header: Flag.string("header").pipe(
          Flag.withAlias("H"),
          Flag.withDescription("Request header in name:value form"),
          Flag.atMost(100),
        ),
        param: Flag.keyValuePair("param").pipe(Flag.withDescription("OpenAPI path or query parameter"), Flag.optional),
      },
    }),
    Spec.make("debug", {
      description: "Debugging and troubleshooting tools",
      commands: [Spec.make("agents", { description: "List all agents" })],
    }),
    Spec.make("migrate", { description: "Migrate v1 data to v2" }),
    Spec.make("todo", {
      description: "Manage session todos interactively",
      commands: [
        Spec.make("add", {
          description: "Add a new todo item",
          params: {
            content: Argument.string("content"),
            priority: Flag.string("priority").pipe(Flag.withDefault("medium")),
          },
        }),
        Spec.make("list", { description: "List all todos for current session" }),
        Spec.make("done", {
          description: "Mark a todo as completed",
          params: { index: Argument.integer("index") },
        }),
        Spec.make("clear", { description: "Clear all completed todos" }),
      ],
    }),
    Spec.make("lsp", {
      description: "Manage Language Server Protocol connections",
      commands: [
        Spec.make("status", { description: "Show status of all LSP servers" }),
        Spec.make("install", {
          description: "Install an LSP server for a language",
          params: { language: Argument.string("language") },
        }),
        Spec.make("diagnostics", {
          description: "Show diagnostics for a file",
          params: { file: Argument.string("file") },
        }),
      ],
    }),
    Spec.make("service", {
      description: "Manage the background server",
      commands: [
        Spec.make("start", { description: "Start the background server" }),
        Spec.make("restart", { description: "Restart the background server" }),
        Spec.make("status", { description: "Show background server status" }),
        Spec.make("stop", { description: "Stop the background server" }),
        Spec.make("password", {
          description: "Get or set the server password",
          params: { value: Argument.string("value").pipe(Argument.optional) },
        }),
      ],
    }),
    Spec.make("serve", {
      description: "Start the v2 API server",
      params: {
        hostname: Flag.string("hostname").pipe(Flag.withDefault("127.0.0.1")),
        port: Flag.integer("port").pipe(Flag.optional),
        register: Flag.boolean("register").pipe(Flag.withDefault(false)),
      },
    }),
  ],
})
