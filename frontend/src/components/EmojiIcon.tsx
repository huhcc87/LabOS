import type { CSSProperties } from 'react';
import {
  AlarmClock, Bell, Biohazard, Book, BookOpen, Bot, Brain, Bug, Building2, CalendarDays, Camera, ChartColumn,
  Check, Circle, Hexagon, Menu, CircleCheck, CircleHelp, CircleX, ClipboardList, Clock, CreditCard, Dna, DollarSign, Download, Eye,
  FilePenLine, FileText, Flame, FlaskConical, Folder, Globe, GraduationCap, Handshake, Hospital, Hourglass, House,
  Inbox, KeyRound, Laptop, Lightbulb, Link, Lock, LockKeyhole, Mail, Map, MapPin, MessageSquare, Microscope,
  NotebookPen, Package, Paperclip, Pencil, PenLine, Play, Plug, Printer, RefreshCw, Repeat, Rocket, Save,
  ScrollText, Search, Settings, Shield, ShoppingCart, Siren, Skull, Snowflake, Sparkles, Star, Tag, Target,
  Telescope, TestTube, Thermometer, Timer, Trash2, TrendingUp, TriangleAlert, Upload, User, Users, Video, Wrench, Zap,
  Archive, ArrowRight, ArrowUp, ArrowUpDown, ArrowUpRight, Award, Ban, Banknote, BellRing, BookMarked, Briefcase,
  Calculator, CalendarRange, CircleDashed, CircleDot, Clapperboard, Construction, Cookie, Copyright, CupSoda, Droplet,
  Eraser, EyeOff, Factory, FolderOpen, FolderTree, Hand, Hash, Heart, Highlighter, IdCard, Image, Info, Keyboard, Leaf,
  LockOpen, Mailbox, Medal, Megaphone, Mic, Monitor, Moon, Mouse, Newspaper, OctagonX, Palette, PartyPopper, Pause,
  PenTool, PhoneOff, Pin, Plus, Pointer, Radio, Receipt, Recycle, Redo2, Ribbon, Ruler, Send, Shuffle, SkipForward,
  Smartphone, Sparkle, Square, SquareCheck, Store, Sun, Syringe, Tent, Trophy, Truck, Type, Undo2, Vote, Waves, Wind,
  type LucideIcon,
} from 'lucide-react';

/**
 * Renders the stroke icon that stands for an emoji glyph. Much of the app stores icons as emoji
 * strings in its data arrays; rendering them through here keeps that data unchanged while the
 * screen shows consistent, theme-colored SVG icons instead of platform emoji.
 */
const MAP: Record<string, LucideIcon> = {
  '📋': ClipboardList, '⚠': TriangleAlert, '📊': ChartColumn, '🔬': Microscope, '📦': Package, '✅': CircleCheck,
  '📝': FilePenLine, '✏': Pencil, '📅': CalendarDays, '📆': CalendarDays, '📄': FileText, '⏳': Hourglass, '⬇': Download,
  '🔍': Search, '🔎': Search, '🧪': TestTube, '🗑': Trash2, '🧬': Dna, '💡': Lightbulb, '🔧': Wrench, '🛠': Wrench,
  '📚': BookOpen, '🎓': GraduationCap, '💰': DollarSign, '✨': Sparkles, '🔗': Link, '📥': Inbox, '👥': Users,
  '💾': Save, '👤': User, '⭐': Star, '🤖': Bot, '🌡': Thermometer, '🔄': RefreshCw, '⏰': AlarmClock, '▶': Play,
  '✍': PenLine, '⚙': Settings, '🔔': Bell, '⚡': Zap, '📈': TrendingUp, '🧊': Snowflake, '❄': Snowflake,
  '🥶': Snowflake, '💬': MessageSquare, '🎯': Target, '☣': Biohazard, '💳': CreditCard, '⚗': FlaskConical,
  '🧫': FlaskConical, '📍': MapPin, '🖨': Printer, '🚨': Siren, '🔒': Lock, '🔐': LockKeyhole, '🛒': ShoppingCart,
  '⏱': Timer, '🕐': Clock, '📁': Folder, '📤': Upload, '🏷': Tag, '🏢': Building2, '🏛': Building2, '👁': Eye,
  '🛡': Shield, '🔑': KeyRound, '📜': ScrollText, '📷': Camera, '📎': Paperclip, '🤝': Handshake, '✉': Mail,
  '📧': Mail, '🦠': Bug, '📖': Book, '🔁': Repeat, '❌': CircleX, '🏥': Hospital, '❓': CircleHelp, '🎥': Video,
  '🏠': House, '🚀': Rocket, '🧠': Brain, '💻': Laptop, '🌐': Globe, '🔥': Flame, '☠': Skull, '🔌': Plug,
  '🔭': Telescope, '📓': NotebookPen, '🗺': Map,
  // Plain-text symbols some menus use as icons
  '⬡': Hexagon, '✓': Check, '☰': Menu,
  '🏗': Construction, '🚧': Construction, '↩': Undo2, '↪': Redo2, '📱': Smartphone, '🔓': LockOpen, '📂': FolderOpen,
  'ℹ': Info, '🚫': Ban, '⛔': OctagonX, '📵': PhoneOff, '🗣': Megaphone, '📢': Megaphone, '💵': Banknote, '🏭': Factory,
  '💧': Droplet, '📰': Newspaper, '📸': Camera, '↗': ArrowUpRight, '💼': Briefcase, '📌': Pin, '🧮': Calculator,
  '♻': Recycle, '🔮': Sparkle, '🆕': Sparkle, '🍪': Cookie, '🏪': Store, '🏬': Store, '☑': SquareCheck, '🧾': Receipt,
  '🎤': Mic, '📬': Mailbox, '📭': Mailbox, '📐': Ruler, '📏': Ruler, '⬆': ArrowUp, '⏭': SkipForward, '⏸': Pause,
  '⏹': Square, '🔲': Square, '🎬': Clapperboard, '🗓': CalendarRange, '🐛': Bug, '🙋': Hand, '🧤': Hand, '☢': Biohazard,
  '🚚': Truck, '📨': Send, '🎨': Palette, '🕳': CircleDashed, '🌍': Globe, '🐙': Globe, '🕸': Globe, '🥇': Medal,
  '🥈': Medal, '🥉': Medal, '🏅': Medal, '🎖': Award, '🏆': Trophy, '⌨': Keyboard, '🙈': EyeOff, '©': Copyright,
  '🖊': PenTool, '🖍': Highlighter, '🧽': Eraser, '🎉': PartyPopper, '🖼': Image, '🔢': Hash, '💉': Syringe,
  '➡': ArrowRight, '🏕': Tent, '🗳': Vote, '👈': Pointer, '🫧': Wind, '🫁': Wind, '🌿': Leaf, '🔀': Shuffle,
  '🗄': Archive, '📕': BookMarked, '📘': BookMarked, '📗': BookMarked, '📙': BookMarked, '↕': ArrowUpDown,
  '🛎': BellRing, '🌀': Waves, '🌊': Waves, '🧰': Wrench, '🎗': Ribbon, '⭕': CircleDot, '🥤': CupSoda, '💚': Heart,
  '📡': Radio, '➕': Plus, '🖥': Monitor, '🔤': Type, '🆔': IdCard, '🗂': FolderTree, '🌙': Moon, '☀': Sun, '🐭': Mouse,
};

/** Colored circle emoji are status dots; they render as filled dots in that color. */
const DOTS: Record<string, string> = {
  '🔴': '#dc2626', '🟢': '#16a34a', '🟡': '#ca8a04', '🟠': '#ea580c', '🔵': '#2563eb', '🟣': '#9333ea', '⚫': '#334155', '⚪': '#cbd5e1',
};

/** Emoji arrive with or without the U+FE0F variation selector; look them up without it. */
export function iconFor(glyph: string): LucideIcon | undefined {
  return MAP[glyph.replace(/️/g, '').trim()];
}

interface Props {
  glyph?: string;
  /** Defaults to 1em so the icon matches the font size the emoji used to have. */
  size?: number | string;
  style?: CSSProperties;
  className?: string;
}

export default function EmojiIcon({ glyph, size = '1em', style, className }: Props) {
  if (!glyph) return null;
  if (typeof glyph !== 'string') return <>{glyph}</>; // already an element (untyped callers)
  const iconStyle: CSSProperties = { flexShrink: 0, verticalAlign: '-0.125em', ...style };
  const dot = DOTS[glyph.replace(/️/g, '').trim()];
  if (dot) return <Circle size={size} fill={dot} stroke={dot} aria-hidden="true" style={iconStyle} className={className} />;
  const Icon = iconFor(glyph);
  // Plain text (initials, numbers) is shown as is; an unmapped emoji becomes a neutral dot.
  // ponytail: add emoji to MAP as they turn up.
  if (!Icon && !/\p{Extended_Pictographic}/u.test(glyph)) return <>{glyph}</>;
  const Shown = Icon ?? Circle;
  return <Shown size={size} strokeWidth={1.75} aria-hidden="true" style={iconStyle} className={className} />;
}
