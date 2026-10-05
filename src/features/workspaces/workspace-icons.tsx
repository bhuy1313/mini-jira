import React from "react";

export interface WorkspaceIconDef {
  id: string;
  name: string;
  category: "tech" | "design" | "business" | "operations" | "lifestyle";
  emoji: string;
  color: string; // Tailwind text color / accent
  bgGradient: string; // Tailwind background gradient
}

export const WORKSPACE_ICON_CATEGORIES = [
  { id: "tech", label: "Tech & Dev", icon: "💻" },
  { id: "design", label: "Design & Creative", icon: "🎨" },
  { id: "business", label: "Business & Growth", icon: "📈" },
  { id: "operations", label: "Ops & Tools", icon: "⚡" },
  { id: "lifestyle", label: "Team & Lifestyle", icon: "🌟" },
] as const;

export const WORKSPACE_ICONS: WorkspaceIconDef[] = [
  // ── Tech & Dev ──
  {
    id: "rocket",
    name: "Rocket Launch",
    category: "tech",
    emoji: "🚀",
    color: "text-rose-500 dark:text-rose-400",
    bgGradient: "from-rose-500/20 to-orange-500/20 border-rose-500/30",
  },
  {
    id: "terminal",
    name: "Code Terminal",
    category: "tech",
    emoji: "💻",
    color: "text-emerald-500 dark:text-emerald-400",
    bgGradient: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
  },
  {
    id: "cpu",
    name: "Hardware / Chip",
    category: "tech",
    emoji: "🤖",
    color: "text-cyan-500 dark:text-cyan-400",
    bgGradient: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30",
  },
  {
    id: "cloud",
    name: "Cloud Infra",
    category: "tech",
    emoji: "☁️",
    color: "text-sky-500 dark:text-sky-400",
    bgGradient: "from-sky-500/20 to-indigo-500/20 border-sky-500/30",
  },
  {
    id: "database",
    name: "Database Server",
    category: "tech",
    emoji: "🗄️",
    color: "text-indigo-500 dark:text-indigo-400",
    bgGradient: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30",
  },
  {
    id: "atom",
    name: "Science & AI",
    category: "tech",
    emoji: "⚛️",
    color: "text-violet-500 dark:text-violet-400",
    bgGradient: "from-violet-500/20 to-fuchsia-500/20 border-violet-500/30",
  },
  {
    id: "bug",
    name: "QA & Debugging",
    category: "tech",
    emoji: "🐛",
    color: "text-amber-500 dark:text-amber-400",
    bgGradient: "from-amber-500/20 to-yellow-500/20 border-amber-500/30",
  },

  // ── Design & Creative ──
  {
    id: "palette",
    name: "Design Studio",
    category: "design",
    emoji: "🎨",
    color: "text-pink-500 dark:text-pink-400",
    bgGradient: "from-pink-500/20 to-rose-500/20 border-pink-500/30",
  },
  {
    id: "sparkles",
    name: "Creative Spark",
    category: "design",
    emoji: "✨",
    color: "text-amber-500 dark:text-amber-400",
    bgGradient: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
  },
  {
    id: "lightbulb",
    name: "Product Ideas",
    category: "design",
    emoji: "💡",
    color: "text-yellow-500 dark:text-yellow-400",
    bgGradient: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30",
  },
  {
    id: "layers",
    name: "UI / UX Layers",
    category: "design",
    emoji: "📐",
    color: "text-blue-500 dark:text-blue-400",
    bgGradient: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  },
  {
    id: "magic",
    name: "Magic & Animation",
    category: "design",
    emoji: "🪄",
    color: "text-purple-500 dark:text-purple-400",
    bgGradient: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
  },
  {
    id: "camera",
    name: "Media & Studio",
    category: "design",
    emoji: "🎬",
    color: "text-red-500 dark:text-red-400",
    bgGradient: "from-red-500/20 to-rose-500/20 border-red-500/30",
  },

  // ── Business & Growth ──
  {
    id: "chart",
    name: "Analytics & Growth",
    category: "business",
    emoji: "📈",
    color: "text-emerald-500 dark:text-emerald-400",
    bgGradient: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
  },
  {
    id: "briefcase",
    name: "Enterprise & Consulting",
    category: "business",
    emoji: "💼",
    color: "text-slate-600 dark:text-slate-300",
    bgGradient: "from-slate-500/20 to-zinc-500/20 border-slate-500/30",
  },
  {
    id: "building",
    name: "Real Estate & HQ",
    category: "business",
    emoji: "🏢",
    color: "text-blue-600 dark:text-blue-400",
    bgGradient: "from-blue-600/20 to-indigo-600/20 border-blue-600/30",
  },
  {
    id: "target",
    name: "Goals & OKRs",
    category: "business",
    emoji: "🎯",
    color: "text-rose-600 dark:text-rose-400",
    bgGradient: "from-rose-600/20 to-red-600/20 border-rose-600/30",
  },
  {
    id: "trophy",
    name: "Sales & Winning",
    category: "business",
    emoji: "🏆",
    color: "text-yellow-600 dark:text-yellow-400",
    bgGradient: "from-yellow-500/20 to-amber-600/20 border-yellow-500/30",
  },
  {
    id: "coin",
    name: "FinTech & Payments",
    category: "business",
    emoji: "💰",
    color: "text-emerald-600 dark:text-emerald-400",
    bgGradient: "from-emerald-600/20 to-teal-600/20 border-emerald-600/30",
  },

  // ── Operations & Tools ──
  {
    id: "zap",
    name: "Speed & DevOps",
    category: "operations",
    emoji: "⚡",
    color: "text-amber-500 dark:text-amber-400",
    bgGradient: "from-amber-500/20 to-yellow-500/20 border-amber-500/30",
  },
  {
    id: "gear",
    name: "Engineering Ops",
    category: "operations",
    emoji: "⚙️",
    color: "text-slate-500 dark:text-slate-400",
    bgGradient: "from-slate-500/20 to-gray-500/20 border-slate-500/30",
  },
  {
    id: "shield",
    name: "Security & Compliance",
    category: "operations",
    emoji: "🛡️",
    color: "text-blue-500 dark:text-blue-400",
    bgGradient: "from-blue-500/20 to-sky-500/20 border-blue-500/30",
  },
  {
    id: "box",
    name: "Logistics & Supply",
    category: "operations",
    emoji: "📦",
    color: "text-orange-600 dark:text-orange-400",
    bgGradient: "from-orange-500/20 to-amber-600/20 border-orange-500/30",
  },
  {
    id: "truck",
    name: "Delivery & Fleet",
    category: "operations",
    emoji: "🚚",
    color: "text-cyan-600 dark:text-cyan-400",
    bgGradient: "from-cyan-500/20 to-teal-500/20 border-cyan-500/30",
  },
  {
    id: "wrench",
    name: "Maintenance & Support",
    category: "operations",
    emoji: "🔧",
    color: "text-zinc-500 dark:text-zinc-400",
    bgGradient: "from-zinc-500/20 to-slate-500/20 border-zinc-500/30",
  },

  // ── Team & Lifestyle ──
  {
    id: "users",
    name: "Community & People",
    category: "lifestyle",
    emoji: "👥",
    color: "text-indigo-500 dark:text-indigo-400",
    bgGradient: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30",
  },
  {
    id: "flame",
    name: "Trending & Momentum",
    category: "lifestyle",
    emoji: "🔥",
    color: "text-orange-500 dark:text-orange-400",
    bgGradient: "from-orange-500/20 to-red-500/20 border-orange-500/30",
  },
  {
    id: "coffee",
    name: "Coffee & Casual",
    category: "lifestyle",
    emoji: "☕",
    color: "text-amber-700 dark:text-amber-500",
    bgGradient: "from-amber-700/20 to-orange-800/20 border-amber-700/30",
  },
  {
    id: "globe",
    name: "Global & Remote",
    category: "lifestyle",
    emoji: "🌍",
    color: "text-blue-500 dark:text-blue-400",
    bgGradient: "from-blue-500/20 to-emerald-500/20 border-blue-500/30",
  },
  {
    id: "heart",
    name: "Healthcare & Non-profit",
    category: "lifestyle",
    emoji: "❤️",
    color: "text-rose-500 dark:text-rose-400",
    bgGradient: "from-rose-500/20 to-pink-500/20 border-rose-500/30",
  },
  {
    id: "leaf",
    name: "Eco & Sustainability",
    category: "lifestyle",
    emoji: "🌿",
    color: "text-emerald-500 dark:text-emerald-400",
    bgGradient: "from-emerald-500/20 to-green-600/20 border-emerald-500/30",
  },
  {
    id: "gamepad",
    name: "Gaming & Esports",
    category: "lifestyle",
    emoji: "🎮",
    color: "text-purple-500 dark:text-purple-400",
    bgGradient: "from-purple-500/20 to-indigo-500/20 border-purple-500/30",
  },
  {
    id: "music",
    name: "Music & Audio",
    category: "lifestyle",
    emoji: "🎵",
    color: "text-fuchsia-500 dark:text-fuchsia-400",
    bgGradient: "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30",
  },
];

export function getWorkspaceIcon(id?: string | null): WorkspaceIconDef | null {
  if (!id) return null;
  return WORKSPACE_ICONS.find((icon) => icon.id === id) || null;
}
