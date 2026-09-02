/**
 * cat-art.ts — Wordmark ASCII de MethodWhite (animación frame-by-frame eficiente).
 *
 * Ciclo de animación con 2 frames que alternan el estilo del marco (pulso sutil):
 *   frame 0: marco simple
 *   frame 1: marco doble
 *
 * Solo se redibuja cuando el frame cambia (delta optimizado en el painter),
 * sin consumo continuo de CPU — mismo enfoque que el sistema video→ASCII.
 */

export type CatFrame = {
  lines: string[]
  durationMs: number
}

export const CAT_FRAMES: CatFrame[] = [
  {
    lines: ["┌─────────────────┐", "│   MethodWhite   │", "└─────────────────┘"],
    durationMs: 1200,
  },
  {
    lines: ["╔═════════════════╗", "║   MethodWhite   ║", "╚═════════════════╝"],
    durationMs: 1200,
  },
]

export const CAT_WIDTH = CAT_FRAMES[0]!.lines[0]!.length
export const CAT_HEIGHT = CAT_FRAMES[0]!.lines.length
export const CAT_PERIOD = CAT_FRAMES.reduce((acc, f) => acc + f.durationMs, 0)

/** Índice de frame para un instante dado (ms), calculado de forma barata. */
export function catFrameAt(elapsedMs: number): number {
  const t = elapsedMs % CAT_PERIOD
  let acc = 0
  for (let i = 0; i < CAT_FRAMES.length; i++) {
    acc += CAT_FRAMES[i]!.durationMs
    if (t < acc) return i
  }
  return 0
}

/** Verdadero solo si el instante dado cae en un cambio de frame. */
export function catFrameChanged(elapsedMs: number, prevElapsedMs: number): boolean {
  return catFrameAt(elapsedMs) !== catFrameAt(prevElapsedMs)
}

export * as CatArt from "./cat-art"
