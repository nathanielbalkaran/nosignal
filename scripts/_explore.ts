import { buildWorld } from '../src/world/build.ts'
import { DISTRICT } from '../src/world/layout.ts'
import { distance } from '../src/world/geometry2d.ts'
const w = buildWorld(DISTRICT)
const pts: [number,number][] = [[1.9,-12.3],[16,-16],[6,-38],[15,-85.8],[2,-104.5]]
function dseg(p:[number,number],a:[number,number],b:[number,number]){const abx=b[0]-a[0],abz=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*abx+(p[1]-a[1])*abz)/(abx*abx+abz*abz)));return Math.hypot(p[0]-a[0]-abx*t,p[1]-a[1]-abz*t)}
const near=(p:[number,number])=>Math.min(...pts.slice(1).map((q,i)=>dseg(p,pts[i],q)))
for (const f of w.facades){ const m:[number,number]=[(f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2]; const d=near(m); if(d<14 && (f.fascia||f.vertical.length||f.ground.lit||f.kind==='tower')) console.log(f.id,f.kind,f.streetId,d.toFixed(0),'lit',f.ground.lit,f.ground.kind,'fascia',f.fascia?.label,'vert',f.vertical.map(v=>v.label).join(','), 'h',f.height, 'aw', f.ground.awning?.color)}
for (const p of w.props){ const d=near([p.x ?? p.at?.[0], p.z ?? p.at?.[1]] as any); if(d<9 && !['bin','crate','box'].includes(p.kind)) console.log('prop',p.kind,d.toFixed(0), JSON.stringify(p).slice(0,90))}
for (const pl of w.plates) { const d=near((pl as any).at ?? [ (pl as any).x,(pl as any).z]); if (d<14) console.log('plate', JSON.stringify(pl).slice(0,120)) }
