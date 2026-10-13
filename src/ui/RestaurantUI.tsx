import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { restaurant, useRestaurant } from '../game/restaurant.ts'
import { achievements } from '../game/achievements.ts'
import { session, useGame } from '../game/session.ts'
import { drawReceipt, RECEIPT_H, RECEIPT_W } from './receiptArt.ts'
import { PRIMARY, type } from './typography.ts'

/*
 * Everything the restaurant puts on the screen: the fade to black, the counter
 * dialogue, the tea-break message, the receipt overlay, and the keys that drive
 * them. One set of window listeners, mounted once, so nothing can double up.
 */

const KEYS = {
  station: ['Digit1', 'Numpad1'],
  tea: ['Digit2', 'Numpad2'],
  exit: ['Digit3', 'Numpad3'],
}

/** Choice 1. */
function askAboutStation() {
  if (!session.inRestaurant() || session.getSnapshot().place !== 'COUNTER') return
  restaurant.askAboutStation(session.getSnapshot().hasReceipt)
}
const choosing = () => {
  const p = restaurant.getSnapshot().phase
  return p === 'menu' || p === 'greeting'
}
function sitDownForTea() {
  if (choosing()) {
    session.sitDown()
    achievements.unlock('take_your_time')
  }
}
function exitRestaurant() {
  if (choosing()) session.exitRestaurant()
}

const fade: CSSProperties = { position: 'fixed', inset: 0, background: '#000', pointerEvents: 'none', transition: 'opacity 0.42s ease-in-out', zIndex: 9 }

const box: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 28,
  transform: 'translateX(-50%)',
  width: 'min(720px, calc(100vw - 32px))',
  padding: '14px 20px 16px',
  background: 'rgba(14, 13, 20, 0.84)',
  border: '1px solid rgba(232, 228, 220, 0.3)',
  color: '#e8e4dc',
  fontFamily: PRIMARY,
  zIndex: 7,
  userSelect: 'none',
}
const who: CSSProperties = { ...type.small, letterSpacing: '0.24em', color: '#d9a36a', margin: '0 0 6px' }
const zh: CSSProperties = { fontSize: 26, letterSpacing: '0.12em', lineHeight: 1.35, margin: 0 }
const sub: CSSProperties = { ...type.body, margin: '4px 0 0', opacity: 0.75, minHeight: 25 }
const choices: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }
const note: CSSProperties = { ...type.small, color: '#d9a36a', margin: '0 0 10px', letterSpacing: '0.16em' }
const skip: CSSProperties = { ...type.small, opacity: 0.45, marginTop: 10, textAlign: 'right' }

function Counter() {
  const { phase, beat, gave } = useRestaurant()
  const line = beat ?? { who: 'WORKER' as const, zh: '要啲咩？', en: 'Anything else?', dur: 0 }
  const open = phase === 'menu' || phase === 'greeting'
  return (
    <div style={box} className="ns-fade-in" onClick={() => restaurant.skip()}>
      {gave && <p style={note}>RECEIPT RECEIVED — PRESS R TO LOOK AT IT</p>}
      <p style={who}>{line.who}</p>
      {line.zh && <p style={zh}>{line.zh}</p>}
      <p style={sub}>{line.zh ? line.en : line.who === 'YOU' ? `"${line.en}"` : line.en}</p>
      {open && (
        <div style={choices}>
          <button type="button" className="ns-btn" onClick={askAboutStation}>[1] ASK ABOUT THE STATION</button>
          <button type="button" className="ns-btn" onClick={sitDownForTea}>[2] SIT DOWN FOR TEA</button>
          <button type="button" className="ns-btn" onClick={exitRestaurant}>[3] EXIT RESTAURANT</button>
        </div>
      )}
      {!open && phase === 'directions' && <div style={skip}>CLICK OR SPACE — NEXT</div>}
    </div>
  )
}

const take: CSSProperties = { position: 'fixed', left: '50%', top: '14%', transform: 'translateX(-50%)', ...type.heading, fontSize: 30, letterSpacing: '0.34em', color: '#e8e4dc', textShadow: '0 2px 0 rgba(0,0,0,0.6)', pointerEvents: 'none', transition: 'opacity 1.4s ease', zIndex: 7, whiteSpace: 'nowrap' }
const getUp: CSSProperties = { position: 'fixed', right: 22, bottom: 18, ...type.small, letterSpacing: '0.2em', color: '#e8e4dc', opacity: 0.5, pointerEvents: 'none', zIndex: 7 }

/** The tea break: a brief message, and a discreet way to get up. */
function Tea() {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShown(false), 4200)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <>
      <div style={{ ...take, opacity: shown ? 0.95 : 0 }}>TAKE YOUR TIME.</div>
      <div style={getUp}>[E] GET UP</div>
    </>
  )
}

const backdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(8, 8, 14, 0.74)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 8, cursor: 'pointer' }
const close: CSSProperties = { ...type.small, letterSpacing: '0.24em', color: '#e8e4dc', opacity: 0.7, marginTop: 14 }

/** The receipt, large and crisp. R or a click puts it away. */
function ReceiptView() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawReceipt(ref.current, Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1) + 1)))
  }, [])
  return (
    <div style={backdrop} className="ns-fade-in" onClick={() => session.toggleReceipt()}>
      <canvas ref={ref} style={{ height: 'min(84vh, 760px)', aspectRatio: `${RECEIPT_W} / ${RECEIPT_H}`, imageRendering: 'auto' }} />
      <div style={close}>[R] CLOSE</div>
    </div>
  )
}

const hint: CSSProperties = { position: 'fixed', right: 22, bottom: 18, ...type.small, letterSpacing: '0.2em', color: '#e8e4dc', opacity: 0.55, pointerEvents: 'none', zIndex: 5 }

export function RestaurantUI() {
  const { state, place, view, fading, hasReceipt, receiptOpen } = useGame()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.code === 'KeyR') {
        session.toggleReceipt()
        return
      }
      if (!session.inRestaurant() || session.getSnapshot().receiptOpen) return
      if (session.getSnapshot().place !== 'COUNTER') return
      if (KEYS.station.includes(e.code)) askAboutStation()
      else if (KEYS.tea.includes(e.code)) sitDownForTea()
      else if (KEYS.exit.includes(e.code)) exitRestaurant()
      else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        restaurant.skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const playing = state === 'PLAYING'
  const settled = playing && !fading && place === view
  return (
    <>
      <div style={{ ...fade, opacity: fading ? 1 : 0 }} aria-hidden />
      {settled && place === 'COUNTER' && !receiptOpen && <Counter key="counter" />}
      {!fading && place === 'TABLE' && view === 'TABLE' && <Tea key="tea" />}
      {playing && hasReceipt && !receiptOpen && place !== 'TABLE' && place !== 'ROOF' && place !== 'ROOF_SEAT' && place !== 'ARCADE' && !fading && <div style={hint}>[R] RECEIPT</div>}
      {playing && receiptOpen && <ReceiptView />}
    </>
  )
}
