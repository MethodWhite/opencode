import { FrameBufferRenderable, RGBA, type OptimizedBuffer, type RenderContext, type RenderableOptions } from "@opentui/core"
import { extend } from "@opentui/solid"
import { onCleanup, onMount } from "solid-js"
import { useTheme } from "../context/theme"
import { CatArt, catFrameAt, catFrameChanged, type CatFrame } from "../cat-art"

/**
 * CatLogoPainter — dibuja el gato opencodeMW por frames, solo redibujando
 * cuando el frame cambia (parpadeo/cola), sin consumo continuo de CPU.
 */
export class CatLogoPainter {
  private fgRgb: [number, number, number] = [180, 180, 180]
  private accentRgb: [number, number, number] = [255, 255, 255]
  private shadowRgb: [number, number, number] = [80, 80, 80]
  private elapsed = 0
  private lastFrame = -1

  setForeground(value: RGBA | undefined) {
    if (!value) return false
    const [r, g, b] = value.toInts()
    this.fgRgb = [r, g, b]
    return true
  }

  setAccent(value: RGBA | undefined) {
    if (!value) return false
    const [r, g, b] = value.toInts()
    this.accentRgb = [r, g, b]
    return true
  }

  render(frameBuffer: OptimizedBuffer, deltaTime = 0) {
    this.elapsed = (this.elapsed + deltaTime) % CatArt.CAT_PERIOD
    const frame = catFrameAt(this.elapsed)
    const changed = frame !== this.lastFrame
    this.lastFrame = frame
    if (!changed) return

    const frameData = CatArt.CAT_FRAMES[frame]!
    const width = frameBuffer.width
    const height = frameBuffer.height
    const catW = CatArt.CAT_WIDTH
    const catH = CatArt.CAT_HEIGHT
    const x0 = Math.max(0, Math.floor((width - catW) / 2))
    const y0 = Math.max(0, Math.floor((height - catH) / 2))

    frameBuffer.clear()
    for (let y = 0; y < catH; y++) {
      const line = frameData.lines[y] ?? ""
      for (let x = 0; x < catW; x++) {
        const ch = line[x] ?? " "
        if (ch === " ") continue
        const px = x0 + x
        const py = y0 + y
        if (px >= width || py >= height) continue
        const [r, g, b] = colorFor(ch, this.fgRgb, this.accentRgb, this.shadowRgb)
        frameBuffer.setCell(px, py, ch, RGBA.fromValues(r, g, b), RGBA.fromValues(0, 0, 0, 0), 1)
      }
    }
  }
}

function colorFor(ch: string, fg: [number, number, number], accent: [number, number, number], shadow: [number, number, number]) {
  if (ch === "^" || ch === "." || ch === "-" || ch === "~" || ch === "|" || ch === "\\" || ch === "/") return accent
  if (ch === "_" || ch === "(" || ch === ")" || ch === ">") return shadow
  return fg
}

export type CatLogoRenderableOptions = RenderableOptions<FrameBufferRenderable> & {
  foreground?: RGBA
  accent?: RGBA
}

class CatLogoRenderable extends FrameBufferRenderable {
  private painter = new CatLogoPainter()

  constructor(ctx: RenderContext, options: CatLogoRenderableOptions = {}) {
    const width = typeof options.width === "number" ? options.width : 1
    const height = typeof options.height === "number" ? options.height : 1
    super(ctx, { ...options, width, height, live: true, respectAlpha: false })
    this.painter.setForeground(options.foreground)
    this.painter.setAccent(options.accent)
  }

  set foreground(value: RGBA | undefined) {
    if (this.painter.setForeground(value)) this.requestRender()
  }

  set accent(value: RGBA | undefined) {
    if (this.painter.setAccent(value)) this.requestRender()
  }

  protected override renderSelf(buffer: OptimizedBuffer, deltaTime = 0): void {
    if (!this.visible || this.isDestroyed) return
    this.painter.render(this.frameBuffer, deltaTime)
    super.renderSelf(buffer)
  }
}

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    cat_logo: typeof CatLogoRenderable
  }
}

extend({ cat_logo: CatLogoRenderable })

export function CatLogo() {
  const { theme } = useTheme()
  return (
    <cat_logo
      width="100%"
      height={CatArt.CAT_HEIGHT}
      foreground={theme.text}
      accent={theme.primary}
      live
    />
  )
}
