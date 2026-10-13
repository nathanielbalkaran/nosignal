import { ambientAudio } from './ambient.ts'

/*
 * The short sounds the optional discoveries make. All of them are built from the
 * sounds the game already generates, played through the ambience channel, so the
 * existing volume slider, mute and pause behaviour cover them. Nothing loops:
 * each call is one shot, and leaving a scene simply stops asking for more.
 */

/** A small, questioning mew. Two short high notes, the second falling away. */
export function meow() {
  ambientAudio.play('birdA', 0.05, 0.62, 2800)
  window.setTimeout(() => ambientAudio.play('birdB', 0.04, 0.5, 2400), 260)
}

/** A button giving under a finger. */
export function buttonClick() {
  ambientAudio.play('clank', 0.12, 2.4, 3000)
}

/** The machine working, then a can landing in the slot. */
export function dispense() {
  ambientAudio.play('rattle', 0.16, 0.7, 1800)
  window.setTimeout(() => ambientAudio.play('thump', 0.2, 1.6, 1400), 700)
  window.setTimeout(() => ambientAudio.play('clank', 0.1, 1.8, 2500), 1100)
}

/** The handset leaving, and returning to, its cradle. */
export function cradle() {
  ambientAudio.play('clank', 0.14, 1.5, 2200)
}

/** A steady dial tone: two notes a long way off, played as short pulses by the caller. */
export function dialTone() {
  ambientAudio.play('announce', 0.05, 0.6, 900)
}

/** The fast busy tone of a number that is not connected. */
export function busyTone() {
  ambientAudio.play('pipe', 0.12, 2.2, 700)
}

/** A coin turning in the slot. */
export function coin() {
  ambientAudio.play('dishesB', 0.1, 1.6, 4000)
}

/** A line going dead. */
export function disconnect() {
  ambientAudio.play('thump', 0.08, 2.4, 600)
}

/** A ventilation fan on a rooftop: one soft, low gust. */
export function ventGust() {
  ambientAudio.play('pipe', 0.05, 0.5, 500)
}
