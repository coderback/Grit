// HomeAnalytics.jsx — Home screen + Analytics/Progress screen

// ── Calorie ring ──────────────────────────────────────────────
function CalorieRing({ eaten, goal, burned = 0 }) {
  const net = eaten - burned;
  const remaining = Math.max(0, goal - net);
  const pct = Math.min(1, net / goal);
  const R = 88, CX = 110, CY = 110;
  const CIRC = 2 * Math.PI * R;
  const filled = pct * CIRC;
  const isOver = net > goal;

  return (
    <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isOver ? C.error : C.orange} />
            <stop offset="100%" stopColor={isOver ? '#FF8A80' : '#FF8C5A'} />
          </linearGradient>
          {/* Subtle glow */}
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.surface2} strokeWidth="13" />
        {/* Small tick marks around track */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
          const rad = (deg - 90) * Math.PI / 180;
          const x1 = CX + (R - 8) * Math.cos(rad), y1 = CY + (R - 8) * Math.sin(rad);
          const x2 = CX + (R + 2) * Math.cos(rad), y2 = CY + (R + 2) * Math.sin(rad);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.surface3} strokeWidth="1" />;
        })}
        {/* Progress arc */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          filter="url(#ringGlow)"
        />
        {/* Dot at progress head */}
        {pct > 0.01 && pct < 0.99 && (() => {
          const angle = (-90 + pct * 360) * Math.PI / 180;
          const dx = CX + R * Math.cos(angle), dy = CY + R * Math.sin(angle);
          return <circle cx={dx} cy={dy} r="7" fill={isOver ? C.error : C.orange} stroke={C.dark} strokeWidth="2.5" />;
        })()}
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
          {isOver ? 'over goal' : 'remaining'}
        </div>
        <div style={{
          fontSize: remaining >= 1000 ? 38 : 42,
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 400,
          color: isOver ? C.error : C.text, lineHeight: 1,
          letterSpacing: '-2px',
        }}>{remaining.toLocaleString()}</div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>kcal</div>
      </div>
    </div>
  );
}

// ── Macro bar ─────────────────────────────────────────────────
function MacroBar({ value, goal, color }) {
  const pct = Math.min(1, value / goal);
  return (
    <div style={{ height: 5, background: C.surface2, borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ── HOME SCREEN ───────────────────────────────────────────────
function HomeScreen2({ onNavigate }) {
  const eaten = 1240, goal = 2050, burned = 312;
  const remaining = Math.max(0, goal - (eaten - burned));

  const macros = [
    { label: 'Protein', val: 142, goal: 165, unit: 'g', color: C.blue },
    { label: 'Carbs',   val: 186, goal: 210, unit: 'g', color: C.orange },
    { label: 'Fat',     val: 54,  goal: 65,  unit: 'g', color: C.teal },
  ];

  return (
    <div style={{ padding: '6px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
        <div>
          <div style={{ fontSize: 14, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Good morning,</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px', lineHeight: 1.2 }}>Alex 👊</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="1.8" strokeLinecap="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <div style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: C.orange, border: `1.5px solid ${C.dark}` }} />
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,92,43,0.12)', border: `1px solid rgba(255,92,43,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="assets/logo.png" alt="G" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
        </div>
      </div>

      {/* Hero calorie card */}
      <Card2 style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Label2>Calories today</Label2>
          <div onClick={() => onNavigate('food')} style={{ fontSize: 13, fontWeight: 500, color: C.orange, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>Log food →</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <CalorieRing eaten={eaten} goal={goal} burned={burned} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Goal', val: goal.toLocaleString(), unit: 'kcal', color: C.muted },
              { label: 'Eaten', val: eaten.toLocaleString(), unit: 'kcal', color: C.text },
              { label: 'Burned', val: burned.toLocaleString(), unit: 'kcal', color: C.teal },
            ].map(row => (
              <div key={row.label}>
                <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.7px', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', marginBottom: 1 }}>{row.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', color: row.color, fontWeight: 400 }}>{row.val}</span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{row.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card2>

      {/* Macro row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {macros.map(m => (
          <Card2 key={m.label} style={{ padding: '14px 14px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', color: m.color, fontWeight: 400, lineHeight: 1 }}>{m.val}</span>
              <span style={{ fontSize: 11, color: m.color, fontFamily: 'DM Sans, sans-serif' }}>{m.unit}</span>
            </div>
            <Label2 style={{ marginBottom: 0 }}>{m.label}</Label2>
            <MacroBar value={m.val} goal={m.goal} color={m.color} />
            <div style={{ fontSize: 10, color: `${C.muted}80`, fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>{m.goal}{m.unit} goal</div>
          </Card2>
        ))}
      </div>

      {/* Stats bento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Card2 style={{ padding: 16, cursor: 'pointer' }} onClick={() => onNavigate('analytics')}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.7px', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', marginBottom: 6 }}>Active mins</div>
          <div style={{ fontSize: 32, fontFamily: 'JetBrains Mono, monospace', color: C.text, fontWeight: 400, lineHeight: 1, marginBottom: 6 }}>47</div>
          <div style={{ height: 5, background: C.surface2, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '78%', background: `linear-gradient(90deg, ${C.orange}, #FF8C5A)`, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>Goal: 60 min</div>
        </Card2>
        <Card2 style={{ padding: 16, cursor: 'pointer' }} onClick={() => onNavigate('habits')}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.7px', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', marginBottom: 6 }}>Habits</div>
          <div style={{ fontSize: 32, fontFamily: 'JetBrains Mono, monospace', color: C.text, fontWeight: 400, lineHeight: 1, marginBottom: 8 }}>3<span style={{ fontSize: 18, color: C.muted }}>/4</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[true,true,true,false].map((d,i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: d ? C.teal : C.surface3 }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.teal, fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>21 day streak 🔥</div>
        </Card2>
      </div>

      {/* Meals preview */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Label2>Today's meals</Label2>
          <div onClick={() => onNavigate('food')} style={{ fontSize: 13, color: C.orange, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}>See all →</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { meal: 'Breakfast', detail: 'Yogurt, Blueberries', kcal: 184 },
            { meal: 'Lunch', detail: 'Chicken, Rice', kcal: 409 },
            { meal: 'Snack', detail: 'Protein Bar', kcal: 218 },
          ].map(m => (
            <div key={m.meal} onClick={() => onNavigate('food')} style={{
              background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{m.meal}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>{m.detail}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontFamily: 'JetBrains Mono, monospace', color: C.text }}>{m.kcal}</div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>kcal</div>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>
            </div>
          ))}
          <div onClick={() => onNavigate('food')} style={{
            background: 'transparent', borderRadius: 14, border: `1px dashed ${C.border}`,
            padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span style={{ fontSize: 14, color: C.orange, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>Log dinner</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Smooth line chart ─────────────────────────────────────────
function LineChart2({ data, goalVal, color, gradId }) {
  const W = 300, H = 90;
  const vals = data.map(d => d.v);
  const maxV = Math.max(goalVal * 1.15, ...vals);
  const minV = 0;
  const toX = (i) => (i / (data.length - 1)) * W;
  const toY = (v) => H - ((v - minV) / (maxV - minV)) * H;

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.v) }));
  const goalY = toY(goalVal);

  // Smooth bezier path
  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + pt.x) / 2;
    return `${acc} C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;
  const todayIdx = data.findIndex(d => d.today);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="85%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Goal dashed line */}
      <line x1="0" y1={goalY} x2={W} y2={goalY} stroke={C.muted} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Points */}
      {pts.map((pt, i) => {
        const isToday = data[i]?.today;
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={isToday ? 5 : 3.5} fill={isToday ? color : C.surface} stroke={color} strokeWidth={isToday ? 0 : 2} />
            {isToday && <circle cx={pt.x} cy={pt.y} r="9" fill={color} opacity="0.18" />}
          </g>
        );
      })}
    </svg>
  );
}

// ── ANALYTICS SCREEN ──────────────────────────────────────────
function AnalyticsScreen2() {
  const [metric, setMetric] = React.useState('calories');

  const calData = [
    { label: 'Mon', v: 1820 }, { label: 'Tue', v: 2180 }, { label: 'Wed', v: 1950 },
    { label: 'Thu', v: 2210 }, { label: 'Fri', v: 1680 }, { label: 'Sat', v: 2050 },
    { label: 'Sun', v: 1240, today: true },
  ];
  const actData = [
    { label: 'Mon', v: 45 }, { label: 'Tue', v: 30 }, { label: 'Wed', v: 60 },
    { label: 'Thu', v: 0 }, { label: 'Fri', v: 55 }, { label: 'Sat', v: 40 },
    { label: 'Sun', v: 47, today: true },
  ];

  const METRICS = [
    { id: 'calories', label: 'Calories' },
    { id: 'protein', label: 'Protein' },
    { id: 'activity', label: 'Activity' },
    { id: 'weight', label: 'Weight' },
  ];

  // Streak dot grid — last 42 days
  const streakDays = Array.from({ length: 42 }, (_, i) => {
    // pseudo-random consistent completion
    const seed = (i * 17 + 3) % 7;
    return { done: seed < 5, daysAgo: 41 - i };
  });

  return (
    <div style={{ padding: '6px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px' }}>Analytics</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['7D','30D','3M'].map(p => (
            <div key={p} style={{
              padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
              background: p === '7D' ? 'rgba(255,92,43,0.15)' : C.surface2,
              border: `1px solid ${p === '7D' ? C.orange : C.border}`,
              fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
              color: p === '7D' ? C.orange : C.muted,
            }}>{p}</div>
          ))}
        </div>
      </div>

      {/* Metric tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {METRICS.map(m => (
          <div key={m.id} onClick={() => setMetric(m.id)} style={{
            padding: '8px 16px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
            background: metric === m.id ? C.orange : C.surface,
            border: `1px solid ${metric === m.id ? C.orange : C.border}`,
            fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
            color: metric === m.id ? '#fff' : C.muted,
            transition: 'all 0.15s',
          }}>{m.label}</div>
        ))}
      </div>

      {/* Calorie trend card */}
      <Card2 style={{ padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Weekly calories</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontFamily: 'JetBrains Mono, monospace', color: C.text, fontWeight: 400, letterSpacing: '-1px' }}>1,876</span>
              <span style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>avg / day</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,200,160,0.12)', border: `1px solid rgba(0,200,160,0.3)`, borderRadius: 999, padding: '4px 10px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.teal, fontFamily: 'DM Sans, sans-serif' }}>▼ 8% deficit</span>
          </div>
        </div>
        <div style={{ marginBottom: 10, height: 90 }}>
          <LineChart2 data={calData} goalVal={2050} color={C.orange} gradId="calGrad" />
        </div>
        {/* X labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {calData.map(d => (
            <div key={d.label} style={{ fontSize: 10, color: d.today ? C.orange : C.muted, fontFamily: 'DM Sans, sans-serif', fontWeight: d.today ? 700 : 400, textAlign: 'center', flex: 1 }}>{d.label}</div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 2, background: C.orange, borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Actual</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 1, background: C.muted, borderRadius: 1, borderTop: `1px dashed ${C.muted}` }} />
            <span style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Goal 2,050</span>
          </div>
        </div>
      </Card2>

      {/* Activity bar chart */}
      <Card2 style={{ padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Activity</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>minutes per day</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', color: C.teal, fontWeight: 400 }}>277</span>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>min total</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
          {actData.map(d => {
            const hPct = d.v > 0 ? Math.max(0.08, d.v / 60) : 0.04;
            return (
              <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%',
                  height: `${hPct * 65}px`,
                  background: d.today ? C.orange : d.v > 0 ? `${C.orange}50` : C.surface2,
                  borderRadius: '6px 6px 6px 6px',
                  transition: 'height 0.4s ease',
                  position: 'relative',
                }}>
                  {d.v > 0 && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 3, fontSize: 9, color: d.today ? C.orange : C.muted, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{d.v}</div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: d.today ? C.orange : C.muted, fontFamily: 'DM Sans, sans-serif', fontWeight: d.today ? 700 : 400 }}>{d.label}</div>
              </div>
            );
          })}
        </div>
      </Card2>

      {/* Streak grid */}
      <Card2 style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Habit streak</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Last 6 weeks</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 26, fontFamily: 'JetBrains Mono, monospace', color: C.orange, fontWeight: 400 }}>21</span>
            <div>
              <div style={{ fontSize: 11, color: C.orange, fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>day streak</div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>🔥 personal best</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={{ fontSize: 9, color: C.muted, fontFamily: 'DM Sans, sans-serif', textAlign: 'center', marginBottom: 3 }}>{d}</div>
          ))}
          {streakDays.map((day, i) => (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 4,
              background: day.done
                ? day.daysAgo < 7 ? C.teal : day.daysAgo < 21 ? `${C.teal}BB` : `${C.teal}60`
                : C.surface2,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[`${C.teal}40`, `${C.teal}80`, C.teal].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 10, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Less → More</span>
        </div>
      </Card2>

      {/* Summary bento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Avg calories', val: '1,876', unit: 'kcal/day', color: C.orange },
          { label: 'Weekly deficit', val: '−1,218', unit: 'kcal', color: C.teal },
          { label: 'Active days', val: '5', unit: 'this week', color: C.blue },
          { label: 'Best streak', val: '21', unit: 'days', color: C.orange },
        ].map(s => (
          <Card2 key={s.label} style={{ padding: '14px 16px' }}>
            <Label2 style={{ marginBottom: 6 }}>{s.label}</Label2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 24, fontFamily: 'JetBrains Mono, monospace', color: s.color, fontWeight: 400, letterSpacing: '-0.5px' }}>{s.val}</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>{s.unit}</div>
          </Card2>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen2, AnalyticsScreen2, CalorieRing, MacroBar });
