import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"

export interface TaskItemProps {
  title: string
  status: string
  priority: string
  category: string
  tags?: string[]
  parent_id?: string
  subtaskCount?: number
}

export function TaskItem(props: TaskItemProps) {
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

  const statusColor = () => {
    switch (props.status) {
      case "completed": return theme.success
      case "in_progress": return theme.warning
      case "blocked": return theme.error
      case "cancelled": return theme.textMuted
      default: return theme.textMuted
    }
  }

  const priorityColor = () => {
    switch (props.priority) {
      case "critical": return theme.error
      case "high": return theme.warning
      default: return undefined
    }
  }

  const priorityAttrs = () => {
    if (props.priority === "critical") return TextAttributes.BOLD
    if (props.priority === "low") return TextAttributes.DIM
    return undefined
  }

  const boldTitle = () => props.status === "in_progress"

  return (
    <box flexDirection="row" gap={0}>
      <text
        flexShrink={0}
        style={{
          fg: statusColor(),
          attributes: props.status === "completed" || props.status === "cancelled" ? TextAttributes.DIM : undefined,
        }}
      >
        [{icon()}]{" "}
      </text>
      <text
        flexShrink={0}
        style={{
          fg: priorityColor(),
          attributes: priorityAttrs(),
        }}
      >
        ({props.priority}){" "}
      </text>
      <text flexShrink={0} fg={theme.textMuted}>
        [{props.category}]{" "}
      </text>
      <text
        flexGrow={1}
        wrapMode="word"
        style={{
          fg: statusColor(),
          attributes: boldTitle() ? TextAttributes.BOLD : undefined,
        }}
      >
        {props.title}
      </text>
      {props.tags && props.tags.length > 0 ? (
        <text flexShrink={0} style={{ fg: theme.textMuted, attributes: TextAttributes.DIM }}>
          {" "}
          {props.tags.map((t) => `#${t}`).join(" ")}
        </text>
      ) : null}
      {props.subtaskCount !== undefined && props.subtaskCount > 0 ? (
        <text flexShrink={0} fg={theme.textMuted}>
          {" "}({props.subtaskCount} sub{props.subtaskCount === 1 ? "task" : "tasks"})
        </text>
      ) : null}
    </box>
  )
}
