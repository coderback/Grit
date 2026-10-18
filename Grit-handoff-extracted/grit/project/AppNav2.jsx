// AppNav2.jsx — Design tokens, shared primitives, navigation shell

const C = {
  orange: '#FF5C2B', dark: '#0F0F0F', surface: '#1A1A1C',
  surface2: '#242428', surface3: '#2E2E33', text: '#F5F0EB',
  muted: '#9A9498', teal: '#00C8A0', blue: '#4B9FFF',
  border: '#2B2B30', error: '#FF453A',
};

// ── Shared primitives ────────────────────────────────────────

function Label2({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 500, color: C.muted,
      letterSpacing: '0.8px', textTransform: 'uppercase',
      fontFamily: 'DM Sans, sans-serif', ...style,
    }}>{children}</div>
  );
}

function Card2({ children, style = {}, active = false, success = false, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: active ? 'rgba(255,92,43,0.08)' : C.surface,
      borderRadius: 20,
      border: `${success ? '1.5px' : '1px'} solid ${success ? C.teal : active ? C.orange : C.border}`,
      padding: 18, ...style,
    }}>{children}</div>
  );
}

function PillBtn2({ children, onClick, secondary = false, ghost = false, small = false, style = {}, disabled = false }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      height: small ? 36 : 52, borderRadius: 999,
      padding: small ? '0 14px' : '0 24px',
      background: ghost ? 'transparent' : secondary ? 'transparent' : disabled ? C.surface2 : C.orange,
      border: secondary ? `1.5px solid ${C.orange}` : 'none',
      color: ghost ? C.muted : secondary ? C.orange : disabled ? C.muted : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: small ? 13 : 16, fontWeight: 700,
      fontFamily: 'DM Sans, sans-serif',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      letterSpacing: '0.2px', flexShrink: 0, ...style,
    }}>{children}</div>
  );
}

function StatusBar2() {
  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 26px', flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {/* Signal bars */}
        <svg width="16" height="11" viewBox="0 0 16 11">
          {[{x:0,h:4},{x:4,h:6},{x:8,h:8},{x:12,h:11}].map((b,i)=>(
            <rect key={i} x={b.x} y={11-b.h} width="3" height={b.h} rx="1" fill={C.text} opacity={i<3?1:0.4}/>
          ))}
        </svg>
        {/* WiFi */}
        <svg width="15" height="11" viewBox="0 0 15 11">
          <path d="M7.5 8.5 a0.7 0.7 0 0 1 0 1.4 a0.7 0.7 0 0 1 0-1.4" fill={C.text}/>
          <path d="M4.5 6 Q7.5 3.5 10.5 6" fill="none" stroke={C.text} strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M2 3.5 Q7.5 -0.5 13 3.5" fill="none" stroke={C.text} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {/* Battery */}
        <svg width="24" height="11" viewBox="0 0 24 11">
          <rect x="0.5" y="0.5" width="20" height="10" rx="2.5" stroke={C.text} strokeOpacity="0.4" fill="none"/>
          <rect x="1.5" y="1.5" width="15" height="8" rx="1.5" fill={C.text}/>
          <path d="M21.5 3.5 v4 a1.5 1.5 0 0 0 0-4z" fill={C.text} fillOpacity="0.45"/>
        </svg>
      </div>
    </div>
  );
}

// ── Nav icons ─────────────────────────────────────────────────

function NavIcon2({ id, active }) {
  const col = active ? C.orange : C.muted;
  const sw = '1.8';
  const props = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: col, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (id === 'home') return <svg {...props}><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" fill={active ? `${C.orange}22` : 'none'}/></svg>;
  if (id === 'food') return <svg {...props}><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>;
  if (id === 'analytics') return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
  if (id === 'habits') return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>;
  if (id === 'profile') return <svg {...props}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  return null;
}

const MAIN_TABS2 = [
  { id: 'home', label: 'Home' },
  { id: 'food', label: 'Food' },
  { id: 'analytics', label: 'Stats' },
  { id: 'habits', label: 'Habits' },
  { id: 'social', label: 'Social' },
  { id: 'profile', label: 'Profile' },
];

function FloatingNav2({ active, onTab }) {
  return (
    <div style={{ position: 'absolute', bottom: 20, left: 12, right: 12, zIndex: 100 }}>
      <div style={{
        display: 'flex', background: C.surface, borderRadius: 999,
        padding: '10px 6px', border: `1px solid ${C.border}`,
        boxShadow: '0 6px 24px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)',
      }}>
        {MAIN_TABS2.map(tab => {
          const isActive = active === tab.id;
          return (
            <div key={tab.id} onClick={() => onTab(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2, padding: '4px 0', cursor: 'pointer',
            }}>
              <NavIcon2 id={tab.id} active={isActive} />
              <span style={{ color: isActive ? C.orange : C.muted, fontSize: 10, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>{tab.label}</span>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: isActive ? C.orange : 'transparent' }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppShell2({ tab, onTab, children }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: C.dark, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StatusBar2 />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {children}
      </div>
      <FloatingNav2 active={tab} onTab={onTab} />
    </div>
  );
}

Object.assign(window, { C, Label2, Card2, PillBtn2, StatusBar2, AppShell2, FloatingNav2, MAIN_TABS2 });
