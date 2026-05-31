export const themeStorageKey = "ey-theme";

export const siteThemes = [
  {
    id: "sky-blue",
    bodyClassName: "t-sky-blue",
    className: "theme-sky-blue",
    name: "天蓝色",
    description: "清爽、天空、轻盈",
    shortDescription: "清爽 · 天空感",
    primary: "#6EC6FF",
    soft: "#BDEBFF",
    accent: "#4F9FE6",
    siteAccent: "#1f6eaa",
    warn: "#F2B84B",
    bg1: "#f2faff",
    bg2: "#e4f1fb"
  },
  {
    id: "sakura-pink",
    bodyClassName: "t-sakura-pink",
    className: "theme-sakura-pink",
    name: "樱花粉",
    description: "柔和、可爱、温暖",
    shortDescription: "柔和 · 温暖",
    primary: "#FF9FBC",
    soft: "#FFD6E3",
    accent: "#7EC6A4",
    siteAccent: "#c1496f",
    warn: "#D58B2D",
    bg1: "#fff5f9",
    bg2: "#ffe9f1"
  },
  {
    id: "lemon-yellow",
    bodyClassName: "t-lemon-yellow",
    className: "theme-lemon-yellow",
    name: "柠檬黄",
    description: "明亮、元气、活泼",
    shortDescription: "明亮 · 元气",
    primary: "#FFD84D",
    soft: "#FFF0A6",
    accent: "#5AD8B2",
    siteAccent: "#997400",
    warn: "#D88724",
    bg1: "#fffdf2",
    bg2: "#fff4c9"
  },
  {
    id: "black-pink",
    bodyClassName: "t-black-pink",
    className: "theme-black-pink",
    name: "暗夜粉",
    description: "酷、潮流、音乐感",
    shortDescription: "酷 · 潮流",
    primary: "#FF4FA3",
    soft: "#3A2230",
    accent: "#FFB3D9",
    siteAccent: "#d63a86",
    warn: "#FFD166",
    bg1: "#160a12",
    bg2: "#0b0309"
  },
  {
    id: "night",
    bodyClassName: "t-night",
    className: "theme-night",
    name: "午夜蓝",
    description: "低亮度、护眼、安静",
    shortDescription: "低亮 · 护眼",
    primary: "#7C8CFF",
    soft: "#2F3A5F",
    accent: "#5AD8B2",
    siteAccent: "#5b66cc",
    warn: "#FBBF24",
    bg1: "#0f172a",
    bg2: "#070b16"
  },
  {
    id: "mint-green",
    bodyClassName: "t-mint-green",
    className: "theme-mint-green",
    name: "薄荷绿",
    description: "清新、健康、轻食感",
    shortDescription: "清新 · 轻食",
    primary: "#5AD8B2",
    soft: "#BDF4E5",
    accent: "#3CB995",
    siteAccent: "#047857",
    warn: "#D68C21",
    bg1: "#f7fbf7",
    bg2: "#eef8f5"
  }
] as const;

export type SiteTheme = (typeof siteThemes)[number];
export type SiteThemeId = SiteTheme["id"];

export function findSiteTheme(themeId: string | null | undefined): SiteTheme {
  return siteThemes.find((theme) => theme.id === themeId) || siteThemes[siteThemes.length - 1];
}

export function themeSwatch(theme: SiteTheme) {
  return `conic-gradient(from 200deg, ${theme.primary}, ${theme.accent}, ${theme.warn}, ${theme.primary})`;
}
