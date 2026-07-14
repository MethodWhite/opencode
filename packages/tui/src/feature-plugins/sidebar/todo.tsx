import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show, createSignal } from "solid-js"
import { TodoItem } from "../../component/todo-item"

const id = "internal:sidebar-todo"

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const list = createMemo(() => props.api.state.session.todo(props.session_id))
  const show = createMemo(() => list().length > 0)

  const groups = createMemo(() => {
    const items = list()
    const pending: typeof items = []
    const inProgress: typeof items = []
    const completed: typeof items = []
    for (const item of items) {
      if (item.status === "completed") completed.push(item)
      else if (item.status === "in_progress") inProgress.push(item)
      else pending.push(item)
    }
    return { pending, inProgress, completed }
  })

  const [openPending, setOpenPending] = createSignal(true)
  const [openInProgress, setOpenInProgress] = createSignal(true)
  const [openCompleted, setOpenCompleted] = createSignal(false)

  return (
    <Show when={show()}>
      <box>
        <text fg={theme().text}>
          <b>Todo</b>{" "}
          <span style={{ fg: theme().textMuted }}>({list().length})</span>
        </text>
        <Show when={groups().pending.length > 0}>
          <box>
            <text fg={theme().textMuted} onMouseDown={() => setOpenPending((x) => !x)}>
              {openPending() ? "▼" : "▶"} Pending ({groups().pending.length})
            </text>
            <Show when={openPending()}>
              <For each={groups().pending}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
            </Show>
          </box>
        </Show>
        <Show when={groups().inProgress.length > 0}>
          <box>
            <text fg={theme().textMuted} onMouseDown={() => setOpenInProgress((x) => !x)}>
              {openInProgress() ? "▼" : "▶"} In Progress ({groups().inProgress.length})
            </text>
            <Show when={openInProgress()}>
              <For each={groups().inProgress}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
            </Show>
          </box>
        </Show>
        <Show when={groups().completed.length > 0}>
          <box>
            <text fg={theme().textMuted} onMouseDown={() => setOpenCompleted((x) => !x)}>
              {openCompleted() ? "▼" : "▶"} Completed ({groups().completed.length})
            </text>
            <Show when={openCompleted()}>
              <For each={groups().completed}>{(item) => <TodoItem status={item.status} content={item.content} />}</For>
            </Show>
          </box>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 400,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
