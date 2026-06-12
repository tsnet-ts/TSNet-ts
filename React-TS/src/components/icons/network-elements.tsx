import type { NetworkNode, NetworkLink } from '@/types';

// ── Color palette ──────────────────────────────────────────────

export const ELEMENT_COLORS: Record<string, { fill: string; stroke: string }> = {
  junction:  { fill: '#3b82f6', stroke: '#1d4ed8' },
  reservoir: { fill: '#10b981', stroke: '#047857' },
  tank:      { fill: '#8b5cf6', stroke: '#6d28d9' },
  pipe:      { fill: '#94a3b8', stroke: '#64748b' },
  valve:     { fill: '#ef4444', stroke: '#dc2626' },
  pump:      { fill: '#f59e0b', stroke: '#d97706' },
};

const SELECTED_COLOR = { fill: '#2563eb', stroke: '#1d4ed8' };

function colors(type: string, selected?: boolean) {
  return selected ? SELECTED_COLOR : ELEMENT_COLORS[type] ?? ELEMENT_COLORS.junction;
}

// ── Shared props ───────────────────────────────────────────────

export interface NetworkIconProps {
  size?: number;
  selected?: boolean;
  className?: string;
}

// ── SVG Components ─────────────────────────────────────────────

export function JunctionIcon({ size = 16, selected, className }: NetworkIconProps) {
  const { fill } = colors('junction', selected);
  const r = size / 2 - 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={fill} />
    </svg>
  );
}

export function ReservoirIcon({ size = 16, selected, className }: NetworkIconProps) {
  const { fill, stroke } = colors('reservoir', selected);
  const h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <polygon
        points={`${h},1 ${size - 1},${size - 1} 1,${size - 1}`}
        fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round"
      />
    </svg>
  );
}

export function TankIcon({ size = 16, selected, className }: NetworkIconProps) {
  const { fill, stroke } = colors('tank', selected);
  const w = size;
  const h = Math.round(size * 0.6);
  const midY = h / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className}>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} fill={fill} stroke={stroke} strokeWidth={2} />
      <line x1={3} y1={midY} x2={w - 3} y2={midY} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
    </svg>
  );
}

export function ValveIcon({ size = 16, selected, className }: NetworkIconProps) {
  const { fill: color } = colors('valve', selected);
  const h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <path
        d={`M 1 1 L ${h} ${h} L 1 ${size - 1} Z M ${size - 1} 1 L ${h} ${h} L ${size - 1} ${size - 1} Z`}
        fill="none" stroke={color} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function PumpIcon({ size = 16, selected, className }: NetworkIconProps) {
  const { fill } = colors('pump', selected);
  const h = size / 2;
  const r = h - 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle cx={h} cy={h} r={r} fill={fill} stroke="#fff" strokeWidth={1.5} />
      <polygon points={`${h - 3},${h - 3} ${h + 4},${h} ${h - 3},${h + 3}`} fill="#fff" />
    </svg>
  );
}

export function PipeIcon({ size = 16, selected, className }: NetworkIconProps) {
  const { fill } = colors('pipe', selected);
  const midY = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <line x1={2} y1={midY} x2={size - 2} y2={midY} stroke={fill} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

// ── Lookup helper ──────────────────────────────────────────────

type ElementType = NetworkNode['type'] | NetworkLink['type'];

const ICON_MAP: Record<ElementType, React.FC<NetworkIconProps>> = {
  junction: JunctionIcon,
  reservoir: ReservoirIcon,
  tank: TankIcon,
  pipe: PipeIcon,
  valve: ValveIcon,
  pump: PumpIcon,
};

export function getNetworkIcon(type: ElementType): React.FC<NetworkIconProps> {
  return ICON_MAP[type] ?? JunctionIcon;
}

// ── SVG string helper (for Leaflet divIcon) ────────────────────

export function getIconSvgString(type: ElementType, size: number, selected: boolean): string {
  const c = colors(type, selected);

  switch (type) {
    case 'junction': {
      const r = size / 2 - 1;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${c.fill}"/></svg>`;
    }
    case 'reservoir': {
      const h = size / 2;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><polygon points="${h},1 ${size - 1},${size - 1} 1,${size - 1}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2" stroke-linejoin="round"/></svg>`;
    }
    case 'tank': {
      const w = size;
      const h = Math.round(size * 0.6);
      const midY = h / 2;
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/><line x1="3" y1="${midY}" x2="${w - 3}" y2="${midY}" stroke="rgba(255,255,255,0.6)" stroke-width="1"/></svg>`;
    }
    case 'valve': {
      const h = size / 2;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="M 1 1 L ${h} ${h} L 1 ${size - 1} Z M ${size - 1} 1 L ${h} ${h} L ${size - 1} ${size - 1} Z" fill="none" stroke="${c.fill}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    case 'pump': {
      const h = size / 2;
      const r = h - 1;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${h}" cy="${h}" r="${r}" fill="${c.fill}" stroke="#fff" stroke-width="1.5"/><polygon points="${h - 3},${h - 3} ${h + 4},${h} ${h - 3},${h + 3}" fill="#fff"/></svg>`;
    }
    case 'pipe': {
      const midY = size / 2;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><line x1="2" y1="${midY}" x2="${size - 2}" y2="${midY}" stroke="${c.fill}" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
    default:
      return '';
  }
}

// ── Canvas drawing helper (for Schematic view) ─────────────────

export function drawNodeIcon(
  ctx: CanvasRenderingContext2D,
  type: NetworkNode['type'],
  x: number, y: number,
  selected: boolean,
) {
  const c = colors(type, selected);

  switch (type) {
    case 'reservoir': {
      const s = selected ? 10 : 8;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x - s, y + s);
      ctx.closePath();
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'tank': {
      const hw = selected ? 10 : 8;
      const hh = selected ? 5 : 4;
      ctx.beginPath();
      ctx.roundRect(x - hw, y - hh, hw * 2, hh * 2, 2);
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      // water line
      ctx.beginPath();
      ctx.moveTo(x - hw + 2, y);
      ctx.lineTo(x + hw - 2, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    default: { // junction
      const r = selected ? 6 : 4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = c.fill;
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = c.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
  }
}

export function drawLinkIcon(
  ctx: CanvasRenderingContext2D,
  type: NetworkLink['type'],
  x: number, y: number,
  selected: boolean,
) {
  const c = colors(type, selected);

  switch (type) {
    case 'valve': {
      const half = selected ? 9 : 7;
      ctx.beginPath();
      ctx.moveTo(x - half, y - half);
      ctx.lineTo(x, y);
      ctx.lineTo(x - half, y + half);
      ctx.lineTo(x - half, y - half);
      ctx.moveTo(x + half, y - half);
      ctx.lineTo(x, y);
      ctx.lineTo(x + half, y + half);
      ctx.lineTo(x + half, y - half);
      ctx.strokeStyle = c.fill;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      break;
    }
    case 'pump': {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = c.fill;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // play arrow
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 3);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x - 3, y + 3);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      break;
    }
    default:
      break;
  }
}
