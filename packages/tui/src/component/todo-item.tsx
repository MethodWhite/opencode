import { useTheme } from "../context/theme"

export interface TodoItemProps {
  status: string
  content: string
  priority?: string
}

export function TodoItem(props: TodoItemProps) {
  const { theme } = useTheme()

  const statusColor = () => {
    if (props.status === "completed") return theme.success
    if (props.status === "in_progress") return theme.warning
    return theme.textMuted
  }
  const icon = () => {
    if (props.status === "completed") return "✓"
    if (props.status === "in_progress") return "•"
    return " "
  }
  const priorityMark = () => {
    if (props.priority === "high") return "!" 
    if (props.priority === "medium") return "·"
    return ""
  }
  const priorityColor = () => {
    if (props.priority === "high") return theme.error
    if (props.priority === "medium") return theme.accent
    return theme.textMuted
  }

  return (
    <box flexDirection="row" gap={0}>
      <text flexShrink={0} style={{ fg: statusColor() }}>
        [{icon()}]{" "}
      </text>
      {props.priority ? (
        <text flexShrink={0} style={{ fg: priorityColor() }}>
          {priorityMark()}{" "}
        </text>
      ) : undefined}
      <text flexGrow={1} wrapMode="word" style={{ fg: statusColor() }}>
        {props.content}
      </text>
    </box>
  )
}
