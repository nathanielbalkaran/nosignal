/** Held-key tracking by physical key code, so WASD works on any keyboard layout. */
const held = new Set<string>()

const onKeyDown = (e: KeyboardEvent) => held.add(e.code)
const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)
const clear = () => held.clear()

export const keyboard = {
  isDown: (...codes: string[]) => codes.some((c) => held.has(c)),
  clear,
  attach() {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
      held.clear()
    }
  },
}
