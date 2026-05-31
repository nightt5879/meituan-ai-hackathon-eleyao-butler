"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode
} from "react";
import { findSiteTheme, siteThemes, themeStorageKey, themeSwatch, type SiteTheme } from "@/lib/siteThemes";

type ThemeReveal = { themeId: string; x: number; y: number; radius: number; phase: "fill" | "fade" };

type SiteThemeContextValue = {
  activeTheme: SiteTheme;
  themeId: string;
  selectTheme: (nextThemeId: string, event?: MouseEvent<HTMLElement>) => void;
  setTheme: (nextThemeId: string) => void;
};

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null);
const bodyThemeClasses = siteThemes.map((theme) => theme.bodyClassName);

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState("mint-green");
  const [themeReveal, setThemeReveal] = useState<ThemeReveal | null>(null);
  const themeTimerRef = useRef<number[]>([]);
  const activeTheme = useMemo(() => findSiteTheme(themeId), [themeId]);
  const revealTheme = themeReveal ? findSiteTheme(themeReveal.themeId) : activeTheme;
  const themeRevealStyle = themeReveal ? {
    "--reveal-x": `${themeReveal.x}px`,
    "--reveal-y": `${themeReveal.y}px`,
    "--reveal-radius": `${themeReveal.radius}px`,
    background: `radial-gradient(140% 140% at ${themeReveal.x}px ${themeReveal.y}px, color-mix(in srgb, ${revealTheme.primary} 60%, ${revealTheme.bg1}) 0%, ${revealTheme.bg1} 46%, ${revealTheme.bg2} 100%)`
  } as CSSProperties : undefined;

  useEffect(() => {
    const storedThemeId = window.localStorage.getItem(themeStorageKey);
    setThemeId(findSiteTheme(storedThemeId).id);
  }, []);

  useEffect(() => {
    document.body.classList.remove(...bodyThemeClasses);
    document.body.classList.add(activeTheme.bodyClassName);
    document.documentElement.style.setProperty("--sb", activeTheme.siteAccent);
    document.documentElement.style.setProperty("--theme-color", activeTheme.siteAccent);
  }, [activeTheme]);

  useEffect(() => {
    function syncStorage(event: StorageEvent) {
      if (event.key === themeStorageKey) {
        setThemeId(findSiteTheme(event.newValue).id);
      }
    }

    window.addEventListener("storage", syncStorage);
    return () => window.removeEventListener("storage", syncStorage);
  }, []);

  useEffect(() => {
    return () => {
      themeTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
      themeTimerRef.current = [];
    };
  }, []);

  function clearThemeTimers() {
    themeTimerRef.current.forEach((timerId) => window.clearTimeout(timerId));
    themeTimerRef.current = [];
  }

  function queueThemeTimer(callback: () => void, delay: number) {
    const timerId = window.setTimeout(() => {
      themeTimerRef.current = themeTimerRef.current.filter((item) => item !== timerId);
      callback();
    }, delay);
    themeTimerRef.current.push(timerId);
  }

  function setTheme(nextThemeId: string) {
    const nextTheme = findSiteTheme(nextThemeId);
    setThemeId(nextTheme.id);
    window.localStorage.setItem(themeStorageKey, nextTheme.id);
  }

  function selectTheme(nextThemeId: string, event?: MouseEvent<HTMLElement>) {
    const nextTheme = findSiteTheme(nextThemeId);
    if (nextTheme.id === themeId) return;

    clearThemeTimers();
    const prefersReducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setThemeReveal(null);
      setTheme(nextTheme.id);
      return;
    }

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? 60;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40;
    setThemeReveal({ themeId: nextTheme.id, x, y, radius, phase: "fill" });
    queueThemeTimer(() => setTheme(nextTheme.id), 330);
    queueThemeTimer(() => {
      setThemeReveal((current) => current && current.themeId === nextTheme.id ? { ...current, phase: "fade" } : current);
      queueThemeTimer(() => setThemeReveal(null), 440);
    }, 660);
  }

  const value = useMemo(() => ({ activeTheme, themeId, selectTheme, setTheme }), [activeTheme, themeId]);

  return (
    <SiteThemeContext.Provider value={value}>
      {children}
      {themeReveal ? <div aria-hidden="true" className={`theme-reveal ${themeReveal.phase === "fade" ? "is-fading" : ""}`} style={themeRevealStyle} /> : null}
    </SiteThemeContext.Provider>
  );
}

export function useSiteTheme() {
  const context = useContext(SiteThemeContext);
  if (!context) {
    throw new Error("useSiteTheme must be used inside SiteThemeProvider");
  }
  return context;
}

export function ThemePipPicker() {
  const { activeTheme, selectTheme, themeId } = useSiteTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  return (
    <div className={`hero-theme ${open ? "open" : ""}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="切换主题"
        className="hero-theme-btn"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        type="button"
      >
        <span className="ht-dot" style={{ background: themeSwatch(activeTheme) }} />
      </button>
      <div className="hero-theme-menu" role="menu" aria-label="主题">
        {siteThemes.map((theme) => (
          <button
            aria-label={theme.name}
            className={`ht-pip ${theme.id === themeId ? "on" : ""}`}
            key={theme.id}
            onClick={(event) => {
              setOpen(false);
              selectTheme(theme.id, event);
            }}
            style={{ background: themeSwatch(theme) }}
            title={theme.name}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

export function ThemeNavPicker({ compact = false }: { compact?: boolean }) {
  const { activeTheme, selectTheme, themeId } = useSiteTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  return (
    <div className={`nav-theme ${open ? "open" : ""} ${compact ? "compact" : ""}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="切换主题"
        className="nav-theme-btn"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        type="button"
      >
        <span className="nd" style={{ background: themeSwatch(activeTheme) }} />
        <span>主题</span>
      </button>
      <div className="nav-theme-menu" role="menu" aria-label="主题">
        <div className="ntm-list">
          {siteThemes.map((theme) => (
            <button
              className={`nt-row ${theme.id === themeId ? "on" : ""}`}
              key={theme.id}
              onClick={(event) => {
                setOpen(false);
                selectTheme(theme.id, event);
              }}
              type="button"
            >
              <span className="swatches">
                <i style={{ background: theme.primary }} />
                <i style={{ background: theme.accent }} />
                <i style={{ background: theme.warn }} />
              </span>
              <span className="nm">{theme.name}</span>
              <span className="ck">✓</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
