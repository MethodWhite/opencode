import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"

export interface TodoItemProps {
  status: string
  content: string
  priority?: string
}

export function TodoItem(props: TodoItemProps) {
  const { theme } = useTheme()

  const icon = () => {
    switch (props.status) {
      case "completed": return "✓"
      case "in_progress": return "•"
      case "blocked": return "!"
      case "cancelled": return "x"
      default: return " "
    }
  }

  const color = () => {
    switch (props.status) {
      case "completed": return theme.success
      case "in_progress": return theme.warning
      case "blocked": return theme.error
      case "cancelled": return theme.textMuted
      default: return theme.textMuted
    }
  }

  const dimmed = () => props.status === "completed" || props.status === "cancelled"

  return (
    <box flexDirection="row" gap={0}>
      <text
        flexShrink={0}
        style={{
          fg: color(),
          attributes: dimmed() ? TextAttributes.DIM : undefined,
        }}
      >
        [{icon()}]{" "}
      </text>
      {props.priority && props.priority !== "medium" ? (
        <text
          flexShrink={0}
          style={{
            fg: props.priority === "critical" ? theme.error : props.priority === "high" ? theme.warning : undefined,
            attributes: props.priority === "critical" ? TextAttributes.BOLD : props.priority === "low" ? TextAttributes.DIM : undefined,
          }}
        >
          ({props.priority}){" "}
        </text>
      ) : null}
      <text
        flexGrow={1}
        wrapMode="word"
        style={{
          fg: color(),
        }}
      >
        {props.content}
      </text>
    </box>
  )
}
