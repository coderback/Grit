// Onboarding2.jsx — Interactive onboarding with rulers & drum pickers

// ── Horizontal Ruler ──────────────────────────────────────────
function HorizRuler({ value, onChange, min, max, unit }) {
  const startRef = React.useRef(null);
  const PX_PER = 10;

  const handleDown = (e) => {
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    startRef.current = { x: cx, val: value };

    const handleMove = (ev) => {
      const nx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const delta = Math.round((startRef.current.x - nx) / PX_PER);
      const nv = Math.max(min, Math.min(max, startRef.current.val + delta));
      onChange(nv);
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
  };

  const W = 320, CTR = W / 2, RANGE = Math.ceil(W / (2 * PX_PER)) + 2;
  const ticks = [];
  for (let i = -RANGE; i <= RANGE; i++) {
    const v = value + i;
    if (v < min || v > max) continue;
    const x = CTR + i * PX_PER;
    ticks.push({ v, x, isCur: v === value, isMajor: v % 5 === 0 });
  }

  return (
    <div
      onMouseDown={handleDown}
      onTouchStart={handleDown}
      style={{
        background: C.surface2, borderRadius: 20,
        border: `1px solid ${C.border}`,
        overflow: 'hidden', userSelect: 'none', touchAction: 'none', cursor: 'col-resize',
      }}
    >
      {/* Value display */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', padding: '22px 0 16px', gap: 6 }}>
        <span style={{ fontSize: 52, fontFamily: 'JetBrains Mono, monospace', fontWeight: 400, color: C.text, letterSpacing: '-2px', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 18, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{unit}</span>
      </div>
      {/* Ruler track */}
      <div style={{ position: 'relative', height: 58 }}>
        {/* Center pointer triangle */}
        <div style={{
          position: 'absolute', left: '50%', top: 0,
          width: 0, height: 0,
          borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
          borderTop: `9px solid ${C.orange}`,
          transform: 'translateX(-50%)', zIndex: 3,
        }} />
        {/* Orange center line */}
        <div style={{
          position: 'absolute', left: '50%', top: 9, height: 32,
          width: 2, background: C.orange, transform: 'translateX(-50%)', zIndex: 2,
        }} />
        <svg width="100%" height="58" viewBox={`0 0 ${W} 58`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {ticks.map(({ v, x, isCur, isMajor }) => (
            <g key={v}>
              <rect
                x={x - (isCur ? 1 : 0.75)}
                y={isMajor ? 2 : 12}
                width={isCur ? 2 : 1.5}
                height={isMajor ? 30 : 20}
                fill={isCur ? C.orange : isMajor ? '#4A4A55' : '#323238'}
                rx="1"
              />
              {isMajor && (
                <text x={x} y={54} textAnchor="middle"
                  fill={isCur ? C.orange : '#555560'}
                  fontSize="9" fontFamily="DM Sans, sans-serif"
                  fontWeight={isCur ? '700' : '400'}
                >{v}</text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Drum Picker (scroll wheel) ────────────────────────────────
function DrumPicker({ value, onChange, min, max }) {
  const ITEM_H = 48;
  const ref = React.useRef(null);
  const settling = React.useRef(false);

  const items = React.useMemo(() => {
    const arr = []; for (let i = min; i <= max; i++) arr.push(i); return arr;
  }, [min, max]);

  React.useLayoutEffect(() => {
    if (ref.current) {
      settling.current = true;
      ref.current.scrollTop = (value - min) * ITEM_H;
      setTimeout(() => { settling.current = false; }, 200);
    }
  }, []);

  const handleScroll = () => {
    if (settling.current) return;
    const idx = Math.round((ref.current?.scrollTop || 0) / ITEM_H);
    const nv = Math.max(min, Math.min(max, min + idx));
    if (nv !== value) onChange(nv);
  };

  return (
    <div style={{ position: 'relative', height: ITEM_H * 3, width: 90, overflow: 'hidden', borderRadius: 14 }}>
      {/* Fades */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H, background: `linear-gradient(to bottom, ${C.dark} 0%, transparent 100%)`, zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H, background: `linear-gradient(to top, ${C.dark} 0%, transparent 100%)`, zIndex: 2, pointerEvents: 'none' }} />
      {/* Highlight band */}
      <div style={{
        position: 'absolute', top: ITEM_H, left: 4, right: 4, height: ITEM_H,
        background: 'rgba(255,92,43,0.12)', border: `1px solid rgba(255,92,43,0.28)`,
        borderRadius: 10, zIndex: 1, pointerEvents: 'none',
      }} />
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          height: '100%', overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          paddingTop: ITEM_H, paddingBottom: ITEM_H,
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}
      >
        {items.map(i => (
          <div
            key={i}
            style={{
              height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center', cursor: 'pointer', position: 'relative', zIndex: 3,
              fontSize: i === value ? 28 : 18,
              fontWeight: i === value ? 700 : 400,
              color: i === value ? C.text : `${C.muted}70`,
              fontFamily: 'JetBrains Mono, monospace',
              transition: 'font-size 0.12s, color 0.12s',
            }}
          >{i}</div>
        ))}
      </div>
    </div>
  );
}

// ── BASICS step ───────────────────────────────────────────────
function OnboardingBasics2({ onContinue, onBack }) {
  const [gender, setGender] = React.useState('male');
  const [age, setAge] = React.useState(25);
  const [height, setHeight] = React.useState(175);
  const [weight, setWeight] = React.useState(78);
  const [heightUnit, setHeightUnit] = React.useState('cm');
  const [weightUnit, setWeightUnit] = React.useState('kg');

  function UnitToggle({ options, value, onChange }) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(u => (
          <div key={u} onClick={() => onChange(u)} style={{
            padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
            background: value === u ? 'rgba(255,92,43,0.15)' : C.surface2,
            border: `1px solid ${value === u ? C.orange : C.border}`,
            fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
            color: value === u ? C.orange : C.muted,
          }}>{u}</div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.dark }}>
      <StatusBar2 />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 28px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: C.surface2, borderRadius: 2, marginBottom: 22 }}>
          <div style={{ height: 3, background: C.orange, borderRadius: 2, width: '22%', transition: 'width 0.4s ease' }} />
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <div onClick={onBack} style={{
            width: 40, height: 40, borderRadius: 12, background: C.surface,
            border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </div>
          <span style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>2 of 9</span>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px', marginBottom: 6 }}>Basic info</div>
        <div style={{ fontSize: 14, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginBottom: 28, lineHeight: 1.55 }}>We use this to calculate your personalised plan.</div>

        {/* Gender */}
        <div style={{ marginBottom: 26 }}>
          <Label2 style={{ marginBottom: 10 }}>Gender</Label2>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { v: 'male', label: 'Male', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10" cy="14" r="6"/><line x1="14.8" y1="9.2" x2="20" y2="4"/><polyline points="16 4 20 4 20 8"/></svg> },
              { v: 'female', label: 'Female', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><line x1="12" y1="14" x2="12" y2="20"/><line x1="9" y1="18" x2="15" y2="18"/></svg> },
              { v: 'other', label: 'Other', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> },
            ].map(g => {
              const sel = gender === g.v;
              return (
                <div key={g.v} onClick={() => setGender(g.v)} style={{
                  flex: 1, padding: '16px 0', borderRadius: 18, textAlign: 'center',
                  cursor: 'pointer',
                  background: sel ? 'rgba(255,92,43,0.1)' : C.surface,
                  border: `1.5px solid ${sel ? C.orange : C.border}`,
                  transition: 'all 0.15s',
                  color: sel ? C.orange : C.muted,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}>
                  {g.svg}
                  <div style={{ fontSize: 13, fontWeight: sel ? 700 : 500, fontFamily: 'DM Sans, sans-serif', color: sel ? C.orange : C.text }}>{g.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Age drum picker */}
        <div style={{ marginBottom: 26 }}>
          <Label2 style={{ marginBottom: 10 }}>Age</Label2>
          <div style={{
            background: C.surface, borderRadius: 20,
            border: `1px solid ${C.border}`, padding: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          }}>
            <DrumPicker value={age} onChange={setAge} min={13} max={80} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>years old</div>
              <div style={{ fontSize: 12, color: `${C.muted}60`, fontFamily: 'DM Sans, sans-serif' }}>Scroll to adjust</div>
            </div>
          </div>
        </div>

        {/* Height ruler */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Label2>Height</Label2>
            <UnitToggle options={['cm', 'ft']} value={heightUnit} onChange={setHeightUnit} />
          </div>
          <HorizRuler value={height} onChange={setHeight} min={140} max={220} unit={heightUnit} />
          <div style={{ fontSize: 11, color: `${C.muted}70`, textAlign: 'center', marginTop: 8, fontFamily: 'DM Sans, sans-serif' }}>← drag to adjust →</div>
        </div>

        {/* Weight ruler */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Label2>Weight</Label2>
            <UnitToggle options={['kg', 'lbs']} value={weightUnit} onChange={setWeightUnit} />
          </div>
          <HorizRuler value={weight} onChange={setWeight} min={30} max={200} unit={weightUnit} />
          <div style={{ fontSize: 11, color: `${C.muted}70`, textAlign: 'center', marginTop: 8, fontFamily: 'DM Sans, sans-serif' }}>← drag to adjust →</div>
        </div>

        <PillBtn2 onClick={onContinue} style={{ width: '100%' }}>Continue →</PillBtn2>
      </div>
    </div>
  );
}

// ── GOAL step ─────────────────────────────────────────────────
function OnboardingGoal2({ onContinue, onBack }) {
  const [selected, setSelected] = React.useState('lose_weight');
  const GOALS = [
    { value: 'lose_weight', label: 'Lose Weight', desc: 'Burn fat, reduce body weight', emoji: '🔥', color: C.orange },
    { value: 'build_muscle', label: 'Build Muscle', desc: 'Increase mass and strength', emoji: '💪', color: C.blue },
    { value: 'maintain', label: 'Maintain', desc: 'Hold weight, build habits', emoji: '⚖️', color: C.teal },
    { value: 'recomp', label: 'Recomp', desc: 'Lose fat and gain muscle', emoji: '🔄', color: '#A78BFA' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.dark }}>
      <StatusBar2 />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 28px' }}>
        <div style={{ height: 3, background: C.surface2, borderRadius: 2, marginBottom: 22 }}>
          <div style={{ height: 3, background: C.orange, borderRadius: 2, width: '44%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <div onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </div>
          <span style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>4 of 9</span>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px', marginBottom: 6 }}>What's your goal?</div>
        <div style={{ fontSize: 14, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginBottom: 28 }}>This determines your calorie target and plan structure.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {GOALS.map(g => {
            const sel = selected === g.value;
            return (
              <div key={g.value} onClick={() => setSelected(g.value)} style={{
                background: sel ? `${g.color}12` : C.surface,
                borderRadius: 20,
                border: `1.5px solid ${sel ? g.color : C.border}`,
                padding: '18px 18px',
                display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                transition: 'all 0.18s',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: sel ? `${g.color}22` : C.surface2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                  transition: 'all 0.18s',
                }}>{g.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: sel ? g.color : C.text, fontFamily: 'DM Sans, sans-serif', marginBottom: 3 }}>{g.label}</div>
                  <div style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{g.desc}</div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${sel ? g.color : C.border}`,
                  background: sel ? g.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.18s',
                }}>
                  {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
              </div>
            );
          })}
        </div>

        <PillBtn2 onClick={onContinue} style={{ width: '100%' }}>Continue →</PillBtn2>
      </div>
    </div>
  );
}

// ── REVEAL step ───────────────────────────────────────────────
function OnboardingReveal2({ onFinish }) {
  const [animIn, setAnimIn] = React.useState(false);
  React.useEffect(() => { setTimeout(() => setAnimIn(true), 100); }, []);

  const RESULTS = [
    { label: 'Daily Calories', value: '2,050', unit: 'kcal', color: C.orange },
    { label: 'Protein', value: '165', unit: 'g', color: C.blue },
    { label: 'Carbs', value: '210', unit: 'g', color: C.orange },
    { label: 'Fat', value: '62', unit: 'g', color: C.teal },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.dark }}>
      <StatusBar2 />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ height: 3, background: C.surface2, borderRadius: 2, marginBottom: 32, width: '100%' }}>
          <div style={{ height: 3, background: C.orange, borderRadius: 2, width: '100%', transition: 'width 0.8s ease' }} />
        </div>

        {/* Logo pulse ring */}
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: 'rgba(255,92,43,0.1)',
          border: `2px solid rgba(255,92,43,0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
          boxShadow: '0 0 0 12px rgba(255,92,43,0.05), 0 0 0 24px rgba(255,92,43,0.025)',
        }}>
          <img src="assets/logo.png" alt="GRIT" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        </div>

        <div style={{ fontSize: 30, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px', textAlign: 'center', marginBottom: 8 }}>Your plan is ready.</div>
        <div style={{ fontSize: 14, color: C.muted, fontFamily: 'DM Sans, sans-serif', textAlign: 'center', lineHeight: 1.6, maxWidth: 280, marginBottom: 32 }}>Based on your stats, we've calculated personalised targets to fuel your goals.</div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {RESULTS.map((item, i) => (
            <div key={item.label} style={{
              background: C.surface, borderRadius: 16,
              border: `1px solid ${C.border}`,
              padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: animIn ? 1 : 0,
              transform: animIn ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity 0.4s ease ${i * 0.08}s, transform 0.4s ease ${i * 0.08}s`,
            }}>
              <div style={{ fontSize: 14, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 400, fontFamily: 'JetBrains Mono, monospace', color: item.color }}>{item.value}</span>
                <span style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <PillBtn2 onClick={onFinish} style={{ width: '100%' }}>Let's get started →</PillBtn2>
      </div>
    </div>
  );
}

Object.assign(window, { HorizRuler, DrumPicker, OnboardingBasics2, OnboardingGoal2, OnboardingReveal2 });
