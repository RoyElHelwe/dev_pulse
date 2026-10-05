/** A tiny top-down office: desks, a glass meeting room and teammates talking. */
export function OfficeIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 320" className={className} role="img" aria-label="Teammates in a virtual office">
      <rect x="0" y="0" width="480" height="320" rx="24" fill="#d9c09c" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x="0" y={i * 24 + 23} width="480" height="1" fill="#b99a72" opacity="0.35" />
      ))}
      {/* Meeting room */}
      <rect x="0" y="0" width="190" height="120" rx="24" fill="#7d8796" />
      <rect x="0" y="118" width="190" height="6" fill="#cfe7ef" opacity="0.8" />
      <rect x="40" y="38" width="110" height="44" rx="22" fill="#6e5241" />
      {[60, 95, 130].map((x) => (
        <g key={x}>
          <rect x={x - 8} y="22" width="16" height="12" rx="5" fill="#2b2f33" />
          <rect x={x - 8} y="86" width="16" height="12" rx="5" fill="#2b2f33" />
        </g>
      ))}
      {/* Desks */}
      {[
        [250, 40],
        [340, 40],
        [250, 200],
        [340, 200],
        [60, 200],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="80" height="40" rx="6" fill="#f1ebe2" />
          <rect x={x + 18} y={y + 6} width="44" height="5" rx="2.5" fill="#1b1e21" />
          <rect x={x + 28} y={y + 46} width="24" height="14" rx="6" fill="#2b2f33" />
        </g>
      ))}
      {/* Proximity voice ring between two people */}
      <circle cx="300" cy="148" r="58" fill="#34d399" opacity="0.12" />
      <circle cx="300" cy="148" r="58" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="6 6" opacity="0.7" />
      <Person x={270} y={156} shirt="#2f6f62" hair="#2b1d16" name="Mira" />
      <Person x={334} y={142} shirt="#e07a5f" hair="#1c1c1c" name="Zakaria" />
      <Person x={110} y={64} shirt="#3d5a80" hair="#b5763c" name="Roy" />
      {/* Plants */}
      {[
        [450, 290],
        [215, 290],
        [450, 130],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="12" fill="#e4dfd7" />
          <circle cx={x} cy={y} r="9" fill="#3f7d4e" />
          <circle cx={x - 3} cy={y - 3} r="5" fill="#6fae6a" />
        </g>
      ))}
    </svg>
  );
}

function Person({ x, y, shirt, hair, name }: { x: number; y: number; shirt: string; hair: string; name: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="18" rx="12" ry="4" fill="#000" opacity="0.18" />
      <rect x="-9" y="0" width="18" height="16" rx="6" fill={shirt} />
      <circle cx="0" cy="-8" r="9" fill="#f1c7a5" />
      <path d="M -9.5 -8 A 9.5 9.5 0 0 1 9.5 -8 L 9.5 -10 L -9.5 -10 Z" fill={hair} />
      <rect x="-9.5" y="-12" width="19" height="5" rx="2" fill={hair} />
      <rect x={-name.length * 3.4 - 8} y="-34" width={name.length * 6.8 + 16} height="16" rx="8" fill="#18181b" opacity="0.85" />
      <text x="0" y="-22.5" textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff" fontFamily="inherit">
        {name}
      </text>
    </g>
  );
}
