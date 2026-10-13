import { useEffect, useState, type CSSProperties } from 'react'
import { DISPENSE_SECONDS, discoveries, useDiscoveries, type Drink, type PhoneMessage } from '../game/discoveries.ts'
import { achievements } from '../game/achievements.ts'
import { session, useGame } from '../game/session.ts'
import { ArcadeGame } from './ArcadeGame.tsx'
import { PRIMARY, type } from './typography.ts'

/*
 * The screens for the vending machine and the payphone. Both sit on top of a
 * fixed camera; both give the player one obvious thing to do and a way back
 * out. Keys are listened for once, here, so nothing can fire twice.
 */

const DRINKS: readonly { id: Drink; key: string; code: string; label: string }[] = [
  { id: 'tea', key: '1', code: 'Digit1', label: 'MILK TEA' },
  { id: 'lemon', key: '2', code: 'Digit2', label: 'LEMON TEA' },
  { id: 'soy', key: '3', code: 'Digit3', label: 'SOY MILK' },
]

const panel: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 28,
  transform: 'translateX(-50%)',
  width: 'min(640px, calc(100vw - 32px))',
  padding: '16px 20px 18px',
  background: 'rgba(14, 13, 20, 0.86)',
  border: '1px solid rgba(232, 228, 220, 0.3)',
  color: '#e8e4dc',
  fontFamily: PRIMARY,
  zIndex: 7,
  userSelect: 'none',
  textAlign: 'center',
}
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 14 }
const caption: CSSProperties = { ...type.small, letterSpacing: '0.22em', color: '#d9a36a', margin: 0 }
const line: CSSProperties = { ...type.body, margin: '8px 0 0', letterSpacing: '0.06em' }

const NAMES: Record<Drink, string> = { tea: 'MILK TEA', lemon: 'LEMON TEA', soy: 'SOY MILK' }

function Vending() {
  const { vending, drink, dispense } = useDiscoveries()
  const done = vending === 'dispense' && dispense >= DISPENSE_SECONDS - 0.6
  return (
    <div style={panel} className="ns-fade-in">
      <p style={caption}>寶記飲品</p>
      {vending === 'choose' ? (
        <>
          <p style={line}>The buttons still light up.</p>
          <div style={row}>
            {DRINKS.map((d) => (
              <button key={d.id} type="button" className="ns-btn" onClick={() => discoveries.chooseDrink(d.id)}>[{d.key}] {d.label}</button>
            ))}
          </div>
        </>
      ) : (
        <p style={line}>{done ? `${NAMES[drink ?? 'tea']} — clunk.` : 'The machine thinks about it.'}</p>
      )}
      <div style={row}>
        <button type="button" className="ns-btn" onClick={() => session.leaveScene()}>{done ? '[E] TAKE IT AND GO' : '[E] STEP BACK'}</button>
      </div>
    </div>
  )
}

const COPY: Record<PhoneMessage, { title: string; text: string }> = {
  disconnected: { title: 'NO ANSWER', text: 'The number you have dialled is not in service.' },
  announcement: { title: 'RECORDED MESSAGE', text: 'Thank you for calling. The office is closed. Please try again after six.' },
  chatter: { title: 'A BUSY LINE', text: 'Someone is talking, a long way from the mouthpiece. Then the line goes quiet.' },
}

function Phone() {
  const { phone, message, phoneTime } = useDiscoveries()
  const copy = message ? COPY[message] : null
  const answered = phone === 'up' && phoneTime > 1.3 && copy
  return (
    <div style={panel} className="ns-fade-in">
      <p style={caption}>PUBLIC TELEPHONE</p>
      {phone === 'down' ? (
        <>
          <p style={line}>The handset is warm from the sun. Or from the last person.</p>
          <div style={row}>
            <button type="button" className="ns-btn" onClick={() => discoveries.liftReceiver()}>[E] LIFT RECEIVER</button>
          </div>
        </>
      ) : (
        <>
          <p style={line}>{answered ? copy.text : 'A dial tone.'}</p>
          {answered && <p style={{ ...caption, marginTop: 10 }}>{copy.title}</p>}
        </>
      )}
      <div style={row}>
        {phone === 'up' && <button type="button" className="ns-btn" onClick={() => discoveries.hangUp()}>[H] HANG UP</button>}
        <button type="button" className="ns-btn" onClick={() => session.leaveScene()}>[Q] STEP BACK</button>
      </div>
    </div>
  )
}

const note: CSSProperties = { ...type.small, position: 'fixed', left: '50%', bottom: '12%', transform: 'translateX(-50%)', color: '#e8e4dc', letterSpacing: '0.16em', opacity: 0.8, pointerEvents: 'none', zIndex: 6 }

const above: CSSProperties = { position: 'fixed', left: '50%', top: '16%', transform: 'translateX(-50%)', ...type.heading, fontSize: 26, letterSpacing: '0.3em', color: '#e8e4dc', textShadow: '0 2px 0 rgba(0,0,0,0.6)', pointerEvents: 'none', transition: 'opacity 1.6s ease', zIndex: 7, whiteSpace: 'nowrap' }
const corner: CSSProperties = { position: 'fixed', right: 22, bottom: 18, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', zIndex: 7 }

/** Standing by the stair door. */
function RoofDoor() {
  function sitOnRoof() {
    session.setPlace('ROOF_SEAT')
    achievements.unlock('above_the_city')
  }
  return (
    <div style={corner} className="ns-fade-in">
      <button type="button" className="ns-btn" onClick={sitOnRoof}>[E] SIT DOWN</button>
      <button type="button" className="ns-btn" onClick={() => session.leaveScene()}>[Q] EXIT ROOFTOP</button>
    </div>
  )
}

/** In the chair. The message fades; the player can stay as long as they like. */
function RoofSeat() {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShown(false), 4600)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <>
      <div style={{ ...above, opacity: shown ? 0.95 : 0 }}>SOMEWHERE ABOVE THE CITY.</div>
      <div style={corner}>
        <button type="button" className="ns-btn" onClick={() => session.setPlace('ROOF')}>[E] STAND UP</button>
      </div>
    </>
  )
}

/** A small line while the cat is being petted, so the moment reads as an interaction. */
function Petting() {
  const { cat } = useDiscoveries()
  const { view, state } = useGame()
  const [shownFor, setShownFor] = useState(0)
  const started = cat > 0 && cat < 0.3
  if (started && shownFor === 0) setShownFor(cat)
  const shown = shownFor > 0 && cat - shownFor < 2.5
  if (state !== 'PLAYING' || view !== 'STREET' || !shown) return null
  return <div style={note}>The cat leans into your hand.</div>
}

export function DiscoveryUI() {
  const { state, place, view, fading } = useGame()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const snap = session.getSnapshot()
      if (snap.state !== 'PLAYING' || snap.fading || snap.place !== snap.view) return
      if (snap.place === 'VENDING') {
        const drink = DRINKS.find((d) => d.code === e.code)
        if (drink) discoveries.chooseDrink(drink.id)
        else if (e.code === 'KeyE') session.leaveScene()
      } else if (snap.place === 'ROOF') {
        if (e.code === 'KeyE') {
          session.setPlace('ROOF_SEAT')
          achievements.unlock('above_the_city')
        } else if (e.code === 'KeyQ') session.leaveScene()
      } else if (snap.place === 'ROOF_SEAT') {
        if (e.code === 'KeyE') session.setPlace('ROOF')
      } else if (snap.place === 'PHONE') {
        if (e.code === 'KeyE' && snap.place === 'PHONE' && discoveries.getSnapshot().phone === 'down') discoveries.liftReceiver()
        else if (e.code === 'KeyH') discoveries.hangUp()
        else if (e.code === 'KeyQ') session.leaveScene()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const settled = state === 'PLAYING' && !fading && place === view
  return (
    <>
      {settled && place === 'VENDING' && <Vending />}
      {settled && place === 'PHONE' && <Phone />}
      {settled && place === 'ROOF' && <RoofDoor />}
      {settled && place === 'ROOF_SEAT' && <RoofSeat key="seat" />}
      {settled && place === 'ARCADE' && <ArcadeGame key="arcade" />}
      <Petting />
    </>
  )
}
