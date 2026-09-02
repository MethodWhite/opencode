import { TextAttributes } from "@opentui/core"
import { createSignal, For, Index, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { CatArt } from "../cat-art"

const ACCENT_CHARS = new Set(["^", ".", "-", "~", "|", "\\", "/"])
const SHADOW_CHARS = new Set(["_", "(", ")", ">"])

/**
 * CatLogo — wordmark MethodWhite animado (JSX puro, sin renderable custom).
 *
 * Animación eficiente: un interval de 100ms solo actualiza el frame cuando
 * cambia (pulso de marco cada ~1.2s), sin redibujar continuamente.
 */
export function CatLogo() {
  const { theme } = useTheme()
  const [frame, setFrame] = createSignal(0)

  onMount(() => {
    const id = setInterval(() => {
      const next = CatArt.catFrameAt(Date.now())
      if (next !== frame()) setFrame(next)
    }, 100)
    onCleanup(() => clearInterval(id))
  })

  return (
    <box flexShrink={0}>
      <For each={CatArt.CAT_FRAMES[frame()]!.lines}>
        {(line) => (
          <box flexDirection="row">
            <Index each={Array.from(line)}>
              {(ch) => (
                <Show when={ch() !== " "} fallback={<text selectable={false}> </text>}>
                  <CatChar ch={ch()} />
                </Show>
              )}
            </Index>
          </box>
        )}
      </For>
    </box>
  )
}

function CatChar(props: { ch: string }) {
  const { theme } = useTheme()
  const color = () => (ACCENT_CHARS.has(props.ch) ? theme.primary : SHADOW_CHARS.has(props.ch) ? theme.border : theme.text)
  return (
    <text fg={color()} attributes={TextAttributes.BOLD} selectable={false}>
      {props.ch}
    </text>
  )
}