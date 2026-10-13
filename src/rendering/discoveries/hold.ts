import { useEffect, useState } from 'react'

/**
 * An imperative object that lives for the component's lifetime: created once,
 * disposed on unmount, and only ever touched from effects and the frame loop.
 * It is kept out of render state, so the frame loop is free to mutate it.
 */
export function useHold<T extends { dispose(): void }>(create: () => T): { readonly current: T } {
  const [box] = useState(() => ({ current: create() }))
  useEffect(() => () => box.current.dispose(), [box])
  return box
}
