import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { CAT_SECONDS, discoveries } from '../game/discoveries.ts'
import { achievements } from '../game/achievements.ts'
import { session } from '../game/session.ts'
import { nearbyDiscovery } from '../world/discoveries.ts'
import { enterableEntrance } from '../world/goal.ts'
import { world } from '../world/index.ts'
import { nearRestaurantDoor } from '../world/restaurant.ts'
import { playerState } from './playerState.ts'

/** Entrance prompts (station and cha chaan teng) and the E key. The prompt only changes the game store when it flips. */
export function StationInteraction() {
  useFrame(() => {
    const snap = session.getSnapshot()
    if (snap.state !== 'PLAYING') return
    if (!session.canMove()) {
      session.setPrompt(null)
      return
    }
    if (enterableEntrance(world, playerState) !== null) session.setPrompt(snap.mode === 'PLAY' ? 'enter' : 'explore')
    else if (nearRestaurantDoor(world, playerState)) session.setPrompt('restaurant')
    else {
      const kind = nearbyDiscovery(world, playerState)?.kind ?? null
      const cat = discoveries.getSnapshot().cat
      session.setPrompt(kind === 'cat' && cat > 0 && cat < CAT_SECONDS ? null : kind)
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const snap = session.getSnapshot()
      if (snap.state !== 'PLAYING') return
      // At the table, E gets up.
      if (snap.place === 'TABLE') {
        session.getUp()
        return
      }
      if (snap.place !== 'STREET' || !session.canMove()) return
      // Re-check at the moment of the press; the prompt is only a hint.
      if (enterableEntrance(world, playerState) !== null) {
        // Only award the achievement if the player actually catches the train (WIN).
        // homeward_bound is awarded from session when the result becomes WON — handled elsewhere.
        session.enterStation()
      } else if (nearRestaurantDoor(world, playerState)) {
        session.enterRestaurant()
        achievements.unlock('local_regular')
      } else {
        const found = nearbyDiscovery(world, playerState)
        if (found?.kind === 'cat') {
          discoveries.petCat()
          achievements.unlock('nine_lives')
        } else if (found?.kind === 'vending') {
          session.enterScene('VENDING', () => discoveries.openVending())
          achievements.unlock('something_cold')
        } else if (found?.kind === 'phone') {
          session.enterScene('PHONE', () => discoveries.openPhone())
          achievements.unlock('wrong_number')
        } else if (found?.kind === 'roof') {
          session.enterScene('ROOF', () => {})
        } else if (found?.kind === 'arcade') {
          session.enterScene('ARCADE', () => {})
          achievements.unlock('last_stop')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
