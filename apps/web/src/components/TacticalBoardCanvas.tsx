/**
 * TacticalBoardCanvas — Interactive tactical planning board over the Predecessor map.
 *
 * Features:
 *  - Map of Predecessor as background
 *  - Select tool: click to select, drag to move, Delete/Backspace to remove
 *  - Pen: free-draw strokes
 *  - Line / Arrow: straight lines with optional arrowhead
 *  - Text: click to place editable text labels
 *  - Role tokens: 5 roles with game icons, assignable player + hero
 *  - Objective tokens: Fangtooth, Orb Prime, Genesis Core, Seedling, Inhibitor, Nexus
 *  - Ward tokens: Vision / Control
 *  - Color picker for strokes/text/tokens
 *  - Undo (Ctrl+Z) up to 40 steps
 *  - Clear all
 *  - Export PNG
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RosterMember } from '../api/client';
import { apiClient } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DrawTool =
  | 'select' | 'pen' | 'line' | 'arrow' | 'text'
  | 'role_carry' | 'role_jungle' | 'role_midlane' | 'role_offlane' | 'role_support'
  | 'obj_fangtooth' | 'obj_orb_prime' | 'obj_genesis_core' | 'obj_seedling' | 'obj_inhibitor' | 'obj_nexus'
  | 'ward_vision' | 'ward_control';

interface PenEl    { kind: 'pen';  id: string; points: number[]; color: string; width: number }
interface LineEl   { kind: 'line'; id: string; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
interface ArrowEl  { kind: 'arrow'; id: string; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
interface TextEl   { kind: 'text'; id: string; x: number; y: number; text: string; color: string; fontSize: number }
interface RoleEl   { kind: 'role'; id: string; x: number; y: number; role: string; player?: string; hero?: string; color: string }
interface ObjEl    { kind: 'obj';  id: string; x: number; y: number; label: string; abbr: string; bg: string }
interface WardEl   { kind: 'ward'; id: string; x: number; y: number; wardType: 'vision' | 'control' }

export type BoardElement = PenEl | LineEl | ArrowEl | TextEl | RoleEl | ObjEl | WardEl;

// ── Constants ──────────────────────────────────────────────────────────────────

const TOKEN_R = 26; // radius for circular tokens

const ROLE_COLORS: Record<string, string> = {
  carry: '#f59e0b', jungle: '#10b981', midlane: '#6366f1',
  offlane: '#ef4444', support: '#38d8c8',
};

const ROLE_LABELS: Record<string, string> = {
  carry: 'Carry', jungle: 'Jungle', midlane: 'Mid',
  offlane: 'Offlane', support: 'Support',
};

const OBJECTIVES: Record<string, { label: string; abbr: string; bg: string }> = {
  fangtooth:    { label: 'Fangtooth',    abbr: 'FT', bg: '#7c3aed' },
  orb_prime:    { label: 'Orb Prime',    abbr: 'OP', bg: '#dc2626' },
  genesis_core: { label: 'Genesis Core', abbr: 'GC', bg: '#0891b2' },
  seedling:     { label: 'Seedling',     abbr: '🌿', bg: '#16a34a' },
  inhibitor:    { label: 'Inhibitor',    abbr: 'IN', bg: '#d97706' },
  nexus:        { label: 'Nexus',        abbr: 'NX', bg: '#be185d' },
};

const PALETTE = ['#38d8c8', '#ef4444', '#f59e0b', '#6baaf8', '#ffffff', '#10b981', '#a78bfa', '#f472b6'];

// ── Image cache ────────────────────────────────────────────────────────────────

const imgCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { imgCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function drawArrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size = 14) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.strokeStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(ctx.lineWidth, 2);
  ctx.stroke();
}

function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, bg: string, img: HTMLImageElement | null, abbr: string, label?: string, sublabel?: string, selected = false) {
  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;

  // Circle
  ctx.beginPath();
  ctx.arc(x, y, TOKEN_R, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Selection ring
  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, TOKEN_R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Icon or abbreviation
  if (img) {
    const iconSize = TOKEN_R * 1.1;
    ctx.drawImage(img, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${abbr.length > 2 ? 16 : 14}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(abbr, x, y);
  }

  // Labels below token
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (label) {
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, y + TOKEN_R + 4);
  }
  if (sublabel) {
    ctx.font = '10px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(sublabel, x, y + TOKEN_R + 17);
  }
}

// ── Hit testing ────────────────────────────────────────────────────────────────

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitTest(el: BoardElement, px: number, py: number): boolean {
  switch (el.kind) {
    case 'pen': {
      const pts = el.points;
      for (let i = 0; i < pts.length - 2; i += 2) {
        if (distToSegment(px, py, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) < el.width + 6) return true;
      }
      return false;
    }
    case 'line':
    case 'arrow':
      return distToSegment(px, py, el.x1, el.y1, el.x2, el.y2) < el.width + 8;
    case 'text':
      return px >= el.x - 4 && px <= el.x + 200 && py >= el.y - 4 && py <= el.y + el.fontSize + 4;
    case 'role':
    case 'obj':
    case 'ward':
      return Math.hypot(px - el.x, py - el.y) <= TOKEN_R + 8;
    default:
      return false;
  }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  teamId?: string;
  compact?: boolean; // smaller toolbar for Session Mode
  className?: string;
  style?: React.CSSProperties;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TacticalBoardCanvas({ teamId, compact = false, style }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool]         = useState<DrawTool>('select');
  const [color, setColor]       = useState(PALETTE[0]);
  const [strokeW, setStrokeW]   = useState(3);
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roster, setRoster]     = useState<RosterMember[]>([]);
  const [heroList, setHeroList] = useState<string[]>([]);

  // Popup for role token enrichment
  const [popup, setPopup] = useState<{ id: string; screenX: number; screenY: number } | null>(null);

  // Text input overlay
  const [textInput, setTextInput] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // History for undo
  const historyRef      = useRef<BoardElement[][]>([[]]);
  const historyIndexRef = useRef(0);

  // Drawing state refs (avoid stale closures)
  const isDrawing   = useRef(false);
  const drawStart   = useRef<{ x: number; y: number } | null>(null);
  const activeElRef = useRef<string | null>(null); // id of element being drawn
  const dragRef     = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null);
  const mapImg      = useRef<HTMLImageElement | null>(null);
  const roleImgs    = useRef<Map<string, HTMLImageElement>>(new Map());

  // Keep elements accessible in callbacks without stale closure
  const elementsRef = useRef(elements);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);
  const strokeWRef = useRef(strokeW);
  useEffect(() => { strokeWRef.current = strokeW; }, [strokeW]);

  // ── Load assets ─────────────────────────────────────────────────────────────

  useEffect(() => {
    loadImage('/maps/map.png').then(img => { mapImg.current = img; redraw(elementsRef.current, selectedIdRef.current); }).catch(() => {});
    const roles = ['carry', 'jungle', 'midlane', 'offlane', 'support'];
    roles.forEach(r => {
      loadImage(`/icons/roles/${r}.png`).then(img => { roleImgs.current.set(r, img); }).catch(() => {});
    });
  }, []);

  // ── Load roster ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return;
    apiClient.teams.getProfile(teamId)
      .then(p => setRoster(p.roster.filter(m => !m.activeTo)))
      .catch(() => {});
  }, [teamId]);

  // ── Build hero list from public/heroes ───────────────────────────────────────
  // We know these from the filesystem — hardcode the list
  useEffect(() => {
    setHeroList(['adele','akeron','argus','aurora','bayle','boris','countess','crunch','dekker','drongo','eden','feng-mao','gadget','gideon','greystone','grim-exe','grux','howitzer','iggy-scorch','kallari','khaimera','kira','kwang','lt-belica','maco','morigesh','mourn','murdock','muriel','narbash','neon','phase','rampage','renna','revenant','riktor','serath','sevarog','shinbi','skylar','sparrow','steel','terra','the-fey','twinblast','wraith','wukong','yin','yurei','zarus','zinx']);
  }, []);

  // ── Canvas sizing ────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const c = canvasRef.current;
      if (!c) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        c.width  = Math.floor(rect.width);
        c.height = Math.floor(rect.height);
        redraw(elementsRef.current, selectedIdRef.current);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Keyboard: Delete / Undo ──────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = selectedIdRef.current;
        if (!sel) return;
        setPopup(null);
        commitElements(elementsRef.current.filter(el => el.id !== sel));
        setSelectedId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setPopup(null);
        setTextInput(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── History helpers ──────────────────────────────────────────────────────────

  function commitElements(next: BoardElement[]) {
    // Truncate future history if we undid and then acted
    const idx = historyIndexRef.current;
    const newHistory = historyRef.current.slice(0, idx + 1);
    newHistory.push(next);
    if (newHistory.length > 40) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setElements(next);
  }

  function undo() {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    const prev = historyRef.current[historyIndexRef.current];
    setElements(prev);
    setSelectedId(null);
    setPopup(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const redraw = useCallback((els: BoardElement[], sel: string | null) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    // Map background
    if (mapImg.current) {
      // Fit map maintaining aspect ratio (1116×1200)
      const mapW = mapImg.current.naturalWidth;
      const mapH = mapImg.current.naturalHeight;
      const scale = Math.min(c.width / mapW, c.height / mapH);
      const dw = mapW * scale, dh = mapH * scale;
      const dx = (c.width - dw) / 2, dy = (c.height - dh) / 2;
      ctx.drawImage(mapImg.current, dx, dy, dw, dh);
      // Overlay to darken slightly for readability
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, c.width, c.height);
    }

    // Draw elements back-to-front (pens/lines first, tokens on top)
    const sorted = [...els].sort((a, b) => {
      const order = { pen: 0, line: 1, arrow: 1, text: 2, ward: 3, obj: 3, role: 4 };
      return (order[a.kind] ?? 0) - (order[b.kind] ?? 0);
    });

    for (const el of sorted) {
      const isSelected = el.id === sel;
      ctx.save();
      ctx.shadowBlur = 0;

      switch (el.kind) {
        case 'pen': {
          if (el.points.length < 4) break;
          ctx.beginPath();
          ctx.moveTo(el.points[0], el.points[1]);
          for (let i = 2; i < el.points.length; i += 2) ctx.lineTo(el.points[i], el.points[i + 1]);
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (isSelected) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; }
          ctx.stroke();
          break;
        }
        case 'line': {
          ctx.beginPath();
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(el.x2, el.y2);
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.width;
          ctx.lineCap = 'round';
          if (isSelected) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; }
          ctx.stroke();
          break;
        }
        case 'arrow': {
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.width;
          ctx.lineCap = 'round';
          if (isSelected) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; }
          ctx.beginPath();
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(el.x2, el.y2);
          ctx.stroke();
          drawArrowHead(ctx, el.x1, el.y1, el.x2, el.y2);
          break;
        }
        case 'text': {
          ctx.font = `bold ${el.fontSize}px system-ui`;
          ctx.fillStyle = el.color;
          ctx.textBaseline = 'top';
          if (isSelected) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; }
          ctx.fillText(el.text, el.x, el.y);
          if (isSelected) {
            const w = ctx.measureText(el.text).width;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(el.x - 4, el.y - 4, w + 8, el.fontSize + 8);
            ctx.setLineDash([]);
          }
          break;
        }
        case 'role': {
          const img = roleImgs.current.get(el.role) ?? null;
          const bg = el.color || ROLE_COLORS[el.role] || '#555';
          const name = el.player || ROLE_LABELS[el.role] || el.role;
          drawToken(ctx, el.x, el.y, bg, img, el.role.slice(0, 2).toUpperCase(), name, el.hero || undefined, isSelected);
          break;
        }
        case 'obj': {
          drawToken(ctx, el.x, el.y, el.bg, null, el.abbr, el.label, undefined, isSelected);
          break;
        }
        case 'ward': {
          const wardBg = el.wardType === 'vision' ? '#2563eb' : '#9333ea';
          const wardAbbr = el.wardType === 'vision' ? '👁' : '🔮';
          const wardLabel = el.wardType === 'vision' ? 'Ward' : 'Control';
          drawToken(ctx, el.x, el.y, wardBg, null, wardAbbr, wardLabel, undefined, isSelected);
          break;
        }
      }
      ctx.restore();
    }
  }, []);

  useEffect(() => { redraw(elements, selectedId); }, [elements, selectedId, redraw]);

  // ── Canvas coords ────────────────────────────────────────────────────────────

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Mouse events ─────────────────────────────────────────────────────────────

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    setPopup(null);
    setTextInput(null);
    const pos = getPos(e);
    const t = toolRef.current;

    if (t === 'select') {
      // Hit test in reverse order (top elements first)
      const els = elementsRef.current;
      let hit: string | null = null;
      for (let i = els.length - 1; i >= 0; i--) {
        if (hitTest(els[i], pos.x, pos.y)) { hit = els[i].id; break; }
      }
      setSelectedId(hit);
      selectedIdRef.current = hit;
      if (hit) {
        const el = els.find(el => el.id === hit)!;
        const cx = 'x' in el ? (el as { x: number }).x : 'x1' in el ? (el as { x1: number }).x1 : 0;
        const cy = 'y' in el ? (el as { y: number }).y : 'y1' in el ? (el as { y1: number }).y1 : 0;
        dragRef.current = { id: hit, ox: cx, oy: cy, mx: pos.x, my: pos.y };
      }
      return;
    }

    if (t === 'text') {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      setTextInput({ x: e.clientX - rect.left, y: e.clientY - rect.top, canvasX: pos.x, canvasY: pos.y });
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    isDrawing.current = true;
    drawStart.current = pos;

    if (t === 'pen') {
      const id = uid();
      activeElRef.current = id;
      const next: BoardElement[] = [...elementsRef.current, { kind: 'pen', id, points: [pos.x, pos.y], color: colorRef.current, width: strokeWRef.current }];
      setElements(next);
      elementsRef.current = next;
    } else if (t === 'line') {
      const id = uid();
      activeElRef.current = id;
      const next: BoardElement[] = [...elementsRef.current, { kind: 'line', id, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color: colorRef.current, width: strokeWRef.current }];
      setElements(next);
      elementsRef.current = next;
    } else if (t === 'arrow') {
      const id = uid();
      activeElRef.current = id;
      const next: BoardElement[] = [...elementsRef.current, { kind: 'arrow', id, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color: colorRef.current, width: strokeWRef.current }];
      setElements(next);
      elementsRef.current = next;
    } else if (t.startsWith('role_')) {
      const role = t.replace('role_', '');
      const id = uid();
      const next: BoardElement[] = [...elementsRef.current, { kind: 'role', id, x: pos.x, y: pos.y, role, color: ROLE_COLORS[role] }];
      commitElements(next);
      setSelectedId(id);
      setTool('select');
    } else if (t.startsWith('obj_')) {
      const key = t.replace('obj_', '');
      const def = OBJECTIVES[key];
      if (def) {
        const id = uid();
        const next: BoardElement[] = [...elementsRef.current, { kind: 'obj', id, x: pos.x, y: pos.y, label: def.label, abbr: def.abbr, bg: def.bg }];
        commitElements(next);
        setSelectedId(id);
        setTool('select');
      }
    } else if (t.startsWith('ward_')) {
      const wardType = t.replace('ward_', '') as 'vision' | 'control';
      const id = uid();
      const next: BoardElement[] = [...elementsRef.current, { kind: 'ward', id, x: pos.x, y: pos.y, wardType }];
      commitElements(next);
      setSelectedId(id);
      setTool('select');
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);

    // Dragging selected element
    if (dragRef.current && toolRef.current === 'select') {
      const { id, ox, oy, mx, my } = dragRef.current;
      const dx = pos.x - mx, dy = pos.y - my;
      const next = elementsRef.current.map(el => {
        if (el.id !== id) return el;
        switch (el.kind) {
          case 'pen':  return { ...el, points: el.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy) };
          case 'line':
          case 'arrow': return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
          case 'text':
          case 'role':
          case 'obj':
          case 'ward':  return { ...el, x: ox + (pos.x - mx), y: oy + (pos.y - my) };
          default: return el;
        }
      });
      elementsRef.current = next;
      redraw(next, selectedIdRef.current);
      return;
    }

    if (!isDrawing.current) return;
    const active = activeElRef.current;
    if (!active) return;

    const next = elementsRef.current.map(el => {
      if (el.id !== active) return el;
      switch (el.kind) {
        case 'pen':  return { ...el, points: [...el.points, pos.x, pos.y] };
        case 'line':
        case 'arrow': return { ...el, x2: pos.x, y2: pos.y };
        default: return el;
      }
    });
    elementsRef.current = next;
    redraw(next, selectedIdRef.current);
  }

  function onMouseUp(_e: React.MouseEvent<HTMLCanvasElement>) {
    if (dragRef.current && toolRef.current === 'select') {
      commitElements(elementsRef.current);
      dragRef.current = null;
      return;
    }
    if (isDrawing.current && activeElRef.current) {
      commitElements(elementsRef.current);
    }
    isDrawing.current = false;
    drawStart.current = null;
    activeElRef.current = null;
  }

  // Double-click on role token → open popup
  function onDblClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);
    const els = elementsRef.current;
    for (let i = els.length - 1; i >= 0; i--) {
      if (els[i].kind === 'role' && hitTest(els[i], pos.x, pos.y)) {
        const c = canvasRef.current!;
        const rect = c.getBoundingClientRect();
        setPopup({ id: els[i].id, screenX: e.clientX - rect.left, screenY: e.clientY - rect.top });
        return;
      }
    }
  }

  // ── Popup (role token enrichment) ────────────────────────────────────────────

  function updateRole(id: string, field: 'player' | 'hero', value: string) {
    const next = elementsRef.current.map(el => el.id === id && el.kind === 'role' ? { ...el, [field]: value || undefined } : el);
    commitElements(next);
  }

  // ── Text commit ──────────────────────────────────────────────────────────────

  function commitText(text: string) {
    if (text.trim()) {
      const el: TextEl = { kind: 'text', id: uid(), x: textInput!.canvasX, y: textInput!.canvasY, text: text.trim(), color: colorRef.current, fontSize: 16 };
      commitElements([...elementsRef.current, el]);
    }
    setTextInput(null);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  function clearAll() {
    commitElements([]);
    setSelectedId(null);
    setPopup(null);
  }

  function exportPng() {
    const c = canvasRef.current;
    if (!c) return;
    const link = document.createElement('a');
    link.download = 'tactical-board.png';
    link.href = c.toDataURL('image/png');
    link.click();
  }

  // ── Tool config ──────────────────────────────────────────────────────────────

  const cursorStyle: React.CSSProperties['cursor'] = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  // Role token in popup
  const popupEl = popup ? elementsRef.current.find(el => el.id === popup.id && el.kind === 'role') as RoleEl | undefined : undefined;

  // ── Toolbar sections ─────────────────────────────────────────────────────────

  const TOOL_BTN_SIZE = compact ? 32 : 36;

  function ToolBtn({ t, label, children }: { t: DrawTool; label: string; children: React.ReactNode }) {
    const active = tool === t;
    return (
      <button
        title={label}
        onClick={() => { setTool(t); setPopup(null); setTextInput(null); }}
        style={{
          width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE,
          border: `1px solid ${active ? '#6baaf8' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6, background: active ? 'rgba(107,170,248,0.2)' : 'rgba(255,255,255,0.04)',
          color: active ? '#6baaf8' : 'var(--text-muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 14 : 15, flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >{children}</button>
    );
  }

  function RoleBtn({ role }: { role: string }) {
    const t = `role_${role}` as DrawTool;
    const active = tool === t;
    const img = roleImgs.current.get(role);
    return (
      <button
        title={ROLE_LABELS[role]}
        onClick={() => { setTool(t); setPopup(null); }}
        style={{
          width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE,
          border: `1px solid ${active ? ROLE_COLORS[role] : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6, background: active ? `${ROLE_COLORS[role]}22` : 'rgba(255,255,255,0.04)',
          cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {img
          ? <img src={`/icons/roles/${role}.png`} style={{ width: TOOL_BTN_SIZE - 10, height: TOOL_BTN_SIZE - 10, objectFit: 'contain' }} />
          : <span style={{ fontSize: 10, color: ROLE_COLORS[role], fontWeight: 700 }}>{role.slice(0, 2).toUpperCase()}</span>
        }
      </button>
    );
  }

  function ObjBtn({ objKey: k, label }: { objKey: string; label: string }) {
    const t = `obj_${k}` as DrawTool;
    const def = OBJECTIVES[k];
    const active = tool === t;
    return (
      <button
        title={label}
        onClick={() => { setTool(t); setPopup(null); }}
        style={{
          width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE,
          border: `1px solid ${active ? def.bg : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6, background: active ? `${def.bg}33` : 'rgba(255,255,255,0.04)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, flexDirection: 'column', gap: 0,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 800, color: def.bg, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{def.abbr}</span>
      </button>
    );
  }

  const SEP = <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', minHeight: 0, background: '#0a0e16', borderRadius: 8, overflow: 'hidden', position: 'relative', ...style }}>

      {/* ── Left toolbar ── */}
      <div style={{
        width: compact ? 44 : 52, flexShrink: 0, background: 'rgba(0,0,0,0.55)', borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 4px', overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Selection & draw tools */}
        <ToolBtn t="select" label="Seleccionar (V)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 2l16 12-7 1-4 7z"/></svg>
        </ToolBtn>
        <ToolBtn t="pen" label="Lápiz (P)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
        </ToolBtn>
        <ToolBtn t="line" label="Línea (L)">
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><line x1="3" y1="21" x2="21" y2="3"/></svg>
        </ToolBtn>
        <ToolBtn t="arrow" label="Flecha (A)">
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>
        </ToolBtn>
        <ToolBtn t="text" label="Texto (T)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm2 5h12v2H6zm2 5h8v2H8z"/></svg>
        </ToolBtn>

        {SEP}
        {/* Role tokens */}
        {['carry','jungle','midlane','offlane','support'].map(r => <RoleBtn key={r} role={r} />)}

        {SEP}
        {/* Objective tokens */}
        {Object.entries(OBJECTIVES).map(([k]) => <ObjBtn key={k} objKey={k} label={OBJECTIVES[k].label} />)}

        {SEP}
        {/* Ward tokens */}
        <button
          title="Ward de visión"
          onClick={() => setTool('ward_vision')}
          style={{ width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: `1px solid ${tool==='ward_vision'?'#2563eb':'rgba(255,255,255,0.1)'}`, borderRadius:6, background: tool==='ward_vision'?'rgba(37,99,235,0.2)':'rgba(255,255,255,0.04)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>👁</button>
        <button
          title="Ward de control"
          onClick={() => setTool('ward_control')}
          style={{ width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: `1px solid ${tool==='ward_control'?'#9333ea':'rgba(255,255,255,0.1)'}`, borderRadius:6, background: tool==='ward_control'?'rgba(147,51,234,0.2)':'rgba(255,255,255,0.04)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>🔮</button>

        {SEP}
        {/* Stroke width */}
        {[2,3,5,8].map(w => (
          <button key={w} title={`Grosor ${w}px`} onClick={() => setStrokeW(w)} style={{
            width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: `1px solid ${strokeW===w?'#6baaf8':'rgba(255,255,255,0.1)'}`, borderRadius:6,
            background: strokeW===w?'rgba(107,170,248,0.15)':'rgba(255,255,255,0.04)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <div style={{ width: Math.min(w * 3, TOOL_BTN_SIZE - 12), height: w, background: '#fff', borderRadius: w, opacity: strokeW===w?1:0.4 }} />
          </button>
        ))}
      </div>

      {/* ── Canvas area ── */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: cursorStyle }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDblClick}
        />

        {/* Text input overlay */}
        {textInput && (
          <input
            ref={textInputRef}
            autoFocus
            placeholder="Escribe y pulsa Enter…"
            onKeyDown={e => {
              if (e.key === 'Enter') commitText(e.currentTarget.value);
              if (e.key === 'Escape') setTextInput(null);
            }}
            onBlur={e => commitText(e.currentTarget.value)}
            style={{
              position: 'absolute', left: textInput.x, top: textInput.y,
              background: 'rgba(0,0,0,0.8)', border: `1px solid ${color}`,
              color, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
              padding: '2px 8px', borderRadius: 4, outline: 'none', minWidth: 120,
            }}
          />
        )}

        {/* Role token popup */}
        {popup && popupEl && (
          <div style={{
            position: 'absolute', left: Math.min(popup.screenX + 8, (canvasRef.current?.width ?? 400) - 220),
            top: Math.max(popup.screenY - 80, 8),
            background: '#0f1623', border: `1px solid ${ROLE_COLORS[popupEl.role]}66`,
            borderLeft: `3px solid ${ROLE_COLORS[popupEl.role]}`,
            borderRadius: 8, padding: '0.75rem 1rem', width: 210, zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: ROLE_COLORS[popupEl.role], marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {ROLE_LABELS[popupEl.role]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {/* Player selector */}
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3 }}>Jugador</div>
                <select
                  value={popupEl.player ?? ''}
                  onChange={e => updateRole(popup.id, 'player', e.target.value)}
                  style={{ width: '100%', background: '#0a0e16', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 5, padding: '3px 6px', fontSize: '0.8rem' }}
                >
                  <option value="">— Sin asignar —</option>
                  {roster.map(m => (
                    <option key={m.playerId} value={m.customName ?? m.displayName}>
                      {m.customName ?? m.displayName}
                    </option>
                  ))}
                  {roster.length === 0 && <option disabled>Sin roster cargado</option>}
                </select>
              </div>
              {/* Hero selector */}
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3 }}>Héroe</div>
                <select
                  value={popupEl.hero ?? ''}
                  onChange={e => updateRole(popup.id, 'hero', e.target.value)}
                  style={{ width: '100%', background: '#0a0e16', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 5, padding: '3px 6px', fontSize: '0.8rem' }}
                >
                  <option value="">— Sin héroe —</option>
                  {heroList.map(h => <option key={h} value={h}>{h.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => setPopup(null)} style={{ marginTop: '0.6rem', width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: 5, padding: '4px', fontSize: '0.72rem', cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* ── Right panel: colors + actions ── */}
      <div style={{
        width: compact ? 44 : 52, flexShrink: 0, background: 'rgba(0,0,0,0.55)', borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 4px', alignItems: 'center',
      }}>
        {/* Color palette */}
        {PALETTE.map(c => (
          <button key={c} onClick={() => setColor(c)} title={c} style={{
            width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', flexShrink: 0,
            border: color === c ? '2px solid #fff' : '2px solid transparent',
            boxShadow: color === c ? '0 0 0 2px rgba(255,255,255,0.3)' : 'none',
          }} />
        ))}

        <div style={{ flex: 1 }} />

        {/* Undo */}
        <button onClick={undo} title="Deshacer (Ctrl+Z)" style={{ width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: '1px solid rgba(255,255,255,0.1)', borderRadius:6, background:'rgba(255,255,255,0.04)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
        </button>

        {/* Delete selected */}
        <button
          onClick={() => { if (selectedId) { commitElements(elements.filter(e => e.id !== selectedId)); setSelectedId(null); setPopup(null); } }}
          disabled={!selectedId}
          title="Eliminar seleccionado (Del)"
          style={{ width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: '1px solid rgba(255,255,255,0.1)', borderRadius:6, background: selectedId?'rgba(239,68,68,0.1)':'rgba(255,255,255,0.04)', color: selectedId?'#ef4444':'rgba(255,255,255,0.2)', cursor: selectedId?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>

        {/* Clear all */}
        <button onClick={clearAll} title="Borrar todo" style={{ width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: '1px solid rgba(255,255,255,0.1)', borderRadius:6, background:'rgba(255,255,255,0.04)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
        </button>

        {/* Export PNG */}
        <button onClick={exportPng} title="Exportar PNG" style={{ width: TOOL_BTN_SIZE, height: TOOL_BTN_SIZE, border: '1px solid rgba(255,255,255,0.1)', borderRadius:6, background:'rgba(255,255,255,0.04)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
    </div>
  );
}
