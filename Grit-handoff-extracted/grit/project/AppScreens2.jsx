// AppScreens2.jsx — Food, Activity, Habits, Social, Profile screens

// ── FOOD ─────────────────────────────────────────────────────
function FoodScreen2() {
  const eaten = 1240, goal = 2050;
  const totalP = 142, totalC = 186, totalF = 54;
  const macros = [
    { label: 'Protein', val: totalP, goal: 165, color: C.blue },
    { label: 'Carbs',   val: totalC, goal: 210, color: C.orange },
    { label: 'Fat',     val: totalF, goal: 65,  color: C.teal },
  ];
  const MEALS = [
    { title: 'Breakfast', kcal: 184, items: [
      { name: 'Greek Yogurt', brand: 'Fage 0% · 200g', cal: 100, p: 18, c: 6, f: 0 },
      { name: 'Blueberries', brand: 'Fresh · 100g', cal: 84, p: 1, c: 21, f: 0 },
    ]},
    { title: 'Lunch', kcal: 409, items: [
      { name: 'Grilled Chicken', brand: '180g', cal: 297, p: 56, c: 0, f: 6 },
      { name: 'Brown Rice', brand: '100g cooked', cal: 112, p: 2, c: 24, f: 1 },
    ]},
    { title: 'Snacks', kcal: 218, items: [
      { name: 'Protein Bar', brand: 'Grenade Carb Killa', cal: 218, p: 22, c: 20, f: 7 },
    ]},
    { title: 'Dinner', kcal: 0, items: [] },
  ];
  const [expanded, setExpanded] = React.useState(new Set(['Breakfast']));
  const toggle = (t) => setExpanded(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });

  return (
    <div style={{ padding: '6px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px' }}>Food</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M7 8h.01M12 8h.01M17 8h.01M7 12h.01M12 12h.01M17 12h.01M7 16h.01M12 16h.01M17 16h.01"/></svg>
          </div>
          <div style={{ background: C.orange, borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
        </div>
      </div>

      {/* Summary card with donut */}
      <Card2 style={{ padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {/* Donut */}
          <svg width="90" height="90" viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
            <circle cx="45" cy="45" r="33" fill="none" stroke={C.surface2} strokeWidth="9"/>
            {(() => {
              const total = totalP + totalC + totalF;
              const slices = [
                { val: totalP, color: C.blue },
                { val: totalC, color: C.orange },
                { val: totalF, color: C.teal },
              ];
              const circ = 2 * Math.PI * 33;
              let offset = 0;
              return slices.map((s, i) => {
                const dash = (s.val / total) * circ;
                const el = <circle key={i} cx="45" cy="45" r="33" fill="none" stroke={s.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash - 2} ${circ - dash + 2}`} strokeDashoffset={-offset} transform="rotate(-90 45 45)" />;
                offset += dash;
                return el;
              });
            })()}
            <text x="45" y="41" textAnchor="middle" fill={C.text} fontSize="13" fontFamily="JetBrains Mono, monospace">{eaten}</text>
            <text x="45" y="53" textAnchor="middle" fill={C.muted} fontSize="7.5" fontFamily="DM Sans, sans-serif">kcal eaten</text>
          </svg>
          {/* Macro list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {macros.map(m => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color }} />
                    <span style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{m.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: m.color }}>{m.val}<span style={{ color: `${C.muted}80`, fontSize: 10 }}>/{m.goal}g</span></span>
                </div>
                <div style={{ height: 4, background: C.surface2, borderRadius: 999 }}>
                  <div style={{ height: '100%', width: `${Math.min(100,(m.val/m.goal)*100)}%`, background: m.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>{goal - eaten} kcal remaining today</div>
          </div>
        </div>
      </Card2>

      {/* Search */}
      <div style={{ background: C.surface2, borderRadius: 999, border: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <span style={{ fontSize: 14, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Search foods or scan barcode…</span>
      </div>

      {/* Meal sections */}
      {MEALS.map(meal => {
        const isOpen = expanded.has(meal.title);
        const isEmpty = meal.items.length === 0;
        return (
          <div key={meal.title}>
            <div onClick={() => toggle(meal.title)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: isOpen ? 8 : 0, cursor: 'pointer', padding: '2px 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Label2>{meal.title}</Label2>
                {meal.kcal > 0 && <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: C.muted }}>{meal.kcal} kcal</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: C.orange, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>+ Add</div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {isEmpty ? (
                  <div style={{ background: 'transparent', borderRadius: 14, border: `1px dashed ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>Nothing logged yet</span>
                  </div>
                ) : meal.items.map(item => (
                  <div key={item.name} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>{item.brand}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                        {[{ v: item.p, l: 'P', c: C.blue }, { v: item.c, l: 'C', c: C.orange }, { v: item.f, l: 'F', c: C.teal }].map(m => (
                          <span key={m.l} style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: m.c }}>{m.l} {m.v}g</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 400, fontFamily: 'JetBrains Mono, monospace', color: C.text }}>{item.cal}</div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>kcal</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── HABITS ────────────────────────────────────────────────────
function HabitsScreen2() {
  const [done, setDone] = React.useState(new Set(['Cold shower', 'Read 20 mins']));
  const [justDone, setJustDone] = React.useState(null);

  const HABITS = [
    { name: 'Morning run', streak: 5, icon: '🏃', target: 'Daily' },
    { name: 'Cold shower', streak: 12, icon: '🧊', target: 'Daily' },
    { name: 'Read 20 mins', streak: 7, icon: '📚', target: 'Daily' },
    { name: 'No alcohol', streak: 21, icon: '🚫', target: 'Daily' },
  ];

  function toggle(name) {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); }
      else { next.add(name); setJustDone(name); setTimeout(() => setJustDone(null), 1200); }
      return next;
    });
  }

  const doneCount = done.size, total = HABITS.length;
  const ringPct = doneCount / total;
  const R = 28, CIRC = 2 * Math.PI * R;

  return (
    <div style={{ padding: '6px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px' }}>Habits</div>
        <PillBtn2 small>+ Add</PillBtn2>
      </div>

      {/* Progress summary */}
      <Card2 style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={R} fill="none" stroke={C.surface2} strokeWidth="7"/>
          <circle cx="36" cy="36" r={R} fill="none" stroke={C.teal} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${ringPct * CIRC} ${CIRC}`}
            transform="rotate(-90 36 36)" />
          <text x="36" y="32" textAnchor="middle" fill={C.text} fontSize="15" fontFamily="JetBrains Mono, monospace" fontWeight="400">{doneCount}/{total}</text>
          <text x="36" y="44" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily="DM Sans, sans-serif">today</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>
            {doneCount === total ? 'All done! 🎉' : `${total - doneCount} habit${total - doneCount !== 1 ? 's' : ''} left`}
          </div>
          <div style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>
            {doneCount === 0 ? 'Start tiny — one habit beats zero.' : doneCount === total ? 'Perfect day. Streak extended.' : 'Keep the momentum going.'}
          </div>
        </div>
      </Card2>

      {/* Habit list */}
      {HABITS.map(h => {
        const isDone = done.has(h.name);
        const isNew = justDone === h.name;
        return (
          <div key={h.name} onClick={() => toggle(h.name)} style={{
            background: isDone ? 'rgba(0,200,160,0.06)' : C.surface,
            borderRadius: 20,
            border: `1.5px solid ${isDone ? C.teal : C.border}`,
            overflow: 'hidden', cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
            transform: isNew ? 'scale(0.98)' : 'scale(1)',
          }}>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Check circle */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: isDone ? C.teal : C.surface2,
                border: `1.5px solid ${isDone ? C.teal : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {isDone
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F0F0F" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={{ fontSize: 18 }}>{h.icon}</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: isDone ? C.teal : C.text, fontFamily: 'DM Sans, sans-serif', transition: 'color 0.2s' }}>{h.name}</div>
                <div style={{ fontSize: 12, color: isDone ? C.teal : C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
                  {h.streak} day streak 🔥 · {h.target}
                </div>
              </div>
              <div style={{
                padding: '5px 12px', borderRadius: 999,
                background: isDone ? 'rgba(0,200,160,0.15)' : C.surface2,
                border: `1px solid ${isDone ? C.teal : C.border}`,
                fontSize: 12, fontWeight: 600,
                color: isDone ? C.teal : C.muted,
                fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.2s',
              }}>{isDone ? '✓ Done' : 'Tap'}</div>
            </div>
            {/* Streak dots */}
            {isDone && (
              <div style={{ display: 'flex', gap: 5, padding: '0 18px 14px' }}>
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i < (h.streak % 7) + 1 ? C.teal : `${C.teal}28`,
                  }} />
                ))}
                <div style={{ fontSize: 10, color: C.teal, fontFamily: 'DM Sans, sans-serif', marginLeft: 4, lineHeight: '8px', marginTop: 0, alignSelf: 'center' }}>{h.streak}d</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SOCIAL ────────────────────────────────────────────────────
function SocialScreen2() {
  const challenges = [
    { title: '30-Day Push-Up', desc: '100 push-ups per day', participants: 248, progress: 14, total: 30, color: C.orange, emoji: '💪' },
    { title: 'Dry January', desc: 'No alcohol for 31 days', participants: 1204, progress: 21, total: 31, color: C.teal, emoji: '🧘' },
    { title: '10K Steps Daily', desc: 'Walk 10,000 steps/day', participants: 876, progress: 7, total: 30, color: C.blue, emoji: '🚶' },
  ];

  return (
    <div style={{ padding: '6px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px' }}>Social</div>
        <PillBtn2 small secondary>Explore</PillBtn2>
      </div>

      <Label2>Active challenges</Label2>
      {challenges.map(ch => {
        const pct = ch.progress / ch.total;
        return (
          <Card2 key={ch.title} style={{ padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${ch.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{ch.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{ch.title}</div>
                <div style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>{ch.desc}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>{ch.participants.toLocaleString()} participants</div>
              </div>
              <div style={{ background: `${ch.color}18`, border: `1px solid ${ch.color}40`, borderRadius: 999, padding: '4px 10px', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ch.color, fontFamily: 'DM Sans, sans-serif' }}>Day {ch.progress}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: ch.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: C.muted }}>{ch.progress}/{ch.total}</span>
            </div>
          </Card2>
        );
      })}
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────
function ProfileScreen2() {
  const stats = [
    { label: 'Goal', value: '2,050', unit: 'kcal', color: C.orange },
    { label: 'Weight', value: '78', unit: 'kg', color: C.blue },
    { label: 'Phase', value: 'Cut', unit: '', color: C.teal },
  ];

  return (
    <div style={{ padding: '6px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner + avatar */}
      <div style={{ borderRadius: 20, background: `linear-gradient(135deg, rgba(255,92,43,0.15) 0%, rgba(75,159,255,0.08) 100%)`, border: `1px solid ${C.border}`, padding: '24px 20px 20px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle texture rings */}
        <div style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: '50%', border: `1px solid rgba(255,92,43,0.1)` }} />
        <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, borderRadius: '50%', border: `1px solid rgba(255,92,43,0.1)` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,92,43,0.15)', border: `2.5px solid rgba(255,92,43,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: C.orange, fontFamily: 'DM Sans, sans-serif' }}>AJ</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.3px' }}>Alex Johnson</div>
            <div style={{ fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>alex@example.com</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{ background: 'rgba(255,92,43,0.15)', border: `1px solid rgba(255,92,43,0.3)`, borderRadius: 999, padding: '3px 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, fontFamily: 'DM Sans, sans-serif' }}>🔥 21 day streak</span>
              </div>
            </div>
          </div>
          <div style={{ background: C.surface2, borderRadius: 10, padding: '8px 14px', border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}>Edit</div>
        </div>
        {/* Stat chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: `${s.color}12`, borderRadius: 12, border: `1px solid ${s.color}30`, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, justifyContent: 'center' }}>
                <span style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', color: s.color, fontWeight: 400 }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 10, color: s.color, fontFamily: 'DM Sans, sans-serif' }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* This week snapshot */}
      <Card2 style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>This week</div>
          <span style={{ fontSize: 12, color: C.orange, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}>Details →</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['M','T','W','T','F','S','S'].map((d, i) => {
            const active = [true,true,true,false,true,true,false][i];
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? C.teal : C.surface2 }} />
                <div style={{ fontSize: 10, color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>{d}</div>
              </div>
            );
          })}
        </div>
      </Card2>

      {/* Settings rows */}
      <Label2>Account</Label2>
      {[
        { icon: '🔔', color: C.blue,  label: 'Notifications', sub: '3 reminders active' },
        { icon: '🎯', color: C.orange, label: 'Goals & Targets', sub: 'Lose weight · 2,050 kcal' },
        { icon: '📊', color: C.teal,  label: 'My Progress', sub: 'View full history' },
        { icon: '💬', color: C.muted, label: 'Help & Feedback', sub: '' },
      ].map(row => (
        <div key={row.label} style={{
          background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${row.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{row.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{row.label}</div>
            {row.sub && <div style={{ fontSize: 12, color: C.muted, fontFamily: 'DM Sans, sans-serif', marginTop: 1 }}>{row.sub}</div>}
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>
        </div>
      ))}

      <div style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', marginBottom: 4 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.error, fontFamily: 'DM Sans, sans-serif' }}>Log out</span>
      </div>
      <div style={{ fontSize: 11, color: C.border, textAlign: 'center', fontFamily: 'DM Sans, sans-serif', paddingBottom: 4 }}>GRIT · v2.0 · Redesign</div>
    </div>
  );
}

Object.assign(window, { FoodScreen2, HabitsScreen2, SocialScreen2, ProfileScreen2 });
