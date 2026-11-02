import type { CSSProperties, ReactNode } from 'react';

/** Original line illustrations for page banners (no stock photos, so no licensing to track). */
const ART: Record<string, ReactNode> = {
  // Pipette over a tube rack
  procurement: (
    <g>
      <path d="M150 18l16 16-52 52a6 6 0 0 1-4 2l-14 4 4-14a6 6 0 0 1 2-4Z" />
      <path d="M156 24l8-8 12 12-8 8" />
      <rect x="40" y="70" width="18" height="46" rx="5" /><rect x="66" y="70" width="18" height="46" rx="5" />
      <path d="M40 84h18M66 84h18" /><path d="M30 116h72" />
      <path d="M200 40h56l-8 38a14 14 0 0 1-14 11h-12a14 14 0 0 1-14-11Z" /><path d="M214 28h28" />
    </g>
  ),
  // Flask and beaker
  inventory: (
    <g>
      <path d="M60 20h22M66 20v30L40 100a8 8 0 0 0 7 12h48a8 8 0 0 0 7-12L76 50V20" />
      <path d="M48 88h56" />
      <path d="M150 50h46l-4 56a8 8 0 0 1-8 7h-22a8 8 0 0 1-8-7Z" /><path d="M146 50h54M158 74h30M160 92h26" />
      <circle cx="230" cy="96" r="10" /><circle cx="248" cy="80" r="6" /><circle cx="236" cy="62" r="4" />
    </g>
  ),
  // Microscope
  lab: (
    <g>
      <path d="M96 24l22 10-10 24-22-10Z" /><path d="M102 54l-14 32" />
      <path d="M72 110a34 34 0 0 0 52-22" /><path d="M56 116h88" />
      <path d="M126 80h30M156 80v36" /><circle cx="156" cy="116" r="4" />
      <rect x="190" y="70" width="64" height="46" rx="6" /><path d="M200 86h44M200 98h30" />
    </g>
  ),
  // Shield with a check mark and a hazard flask
  safety: (
    <g>
      <path d="M100 18l42 14v34c0 28-18 46-42 58-24-12-42-30-42-58V32Z" /><path d="m82 70 14 14 26-30" />
      <path d="M200 40h40M210 40v26l-18 36a6 6 0 0 0 5 9h48a6 6 0 0 0 5-9l-18-36V40" /><path d="M198 94h56" />
    </g>
  ),
  // Gear and sliders
  admin: (
    <g>
      <circle cx="96" cy="70" r="20" />
      <path d="M96 22v14M96 104v14M48 70h14M130 70h14M62 36l10 10M120 94l10 10M130 36l-10 10M72 94l-10 10" />
      <path d="M180 40h74M180 70h74M180 100h74" /><circle cx="204" cy="40" r="6" /><circle cx="236" cy="70" r="6" /><circle cx="214" cy="100" r="6" />
    </g>
  ),
  // People and a calendar
  team: (
    <g>
      <circle cx="72" cy="50" r="14" /><path d="M44 112a28 28 0 0 1 56 0" />
      <circle cx="124" cy="58" r="11" /><path d="M106 112a20 20 0 0 1 36 -10" />
      <rect x="184" y="34" width="72" height="72" rx="8" /><path d="M184 56h72M204 26v16M236 26v16M200 74h12M224 74h12M200 90h12" />
    </g>
  ),
  // DNA helix and vial
  samples: (
    <g>
      <path d="M60 14c40 20 40 44 0 64s-40 44 0 64M100 14c-40 20-40 44 0 64s40 44 0 64" />
      <path d="M68 30h24M62 54h36M62 102h36M68 126h24" />
      <rect x="170" y="30" width="22" height="86" rx="8" /><path d="M170 52h22M170 70h22" />
      <rect x="206" y="44" width="22" height="72" rx="8" /><path d="M206 66h22" />
      <rect x="242" y="58" width="22" height="58" rx="8" />
    </g>
  ),
};

interface Props {
  title: string;
  subtitle?: string;
  art?: keyof typeof ART;
  children?: ReactNode;
  style?: CSSProperties;
}

export default function LabBanner({ title, subtitle, art = 'lab', children, style }: Props) {
  return (
    <div className="lab-banner" role="banner" style={style}>
      <div className="lab-banner-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      <svg className="lab-banner-art" viewBox="0 0 280 150" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ART[art]}
      </svg>
    </div>
  );
}
