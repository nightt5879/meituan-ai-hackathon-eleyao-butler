const themeService = require('../utils/theme');

const STORAGE_KEY = themeService.STORAGE_KEY;
const DEFAULT_THEME_ID = themeService.DEFAULT_THEME_ID;
const themes = themeService.themes.map(function (theme) {
  return Object.assign({}, theme, {
    key: theme.id,
    primary: theme.colors.primary,
    soft: theme.colors.backgroundSoft,
    accent: theme.colors.secondary,
    warn: theme.colors.warn
  });
});

function normalizeTheme(themeKey) {
  return themeService.normalizeThemeId(themeKey);
}

function getCurrentThemeKey() {
  return themeService.getSavedThemeId();
}

function getCurrentTheme() {
  return themeService.getSavedTheme();
}

function saveTheme(themeKey) {
  return themeService.saveTheme(themeKey).id;
}

function getThemeNames() {
  return themes.map(function (theme) {
    return theme.name;
  });
}

function getThemeByIndex(index) {
  return themes[index] || themes[themes.length - 1];
}

function getThemeByKey(themeKey) {
  return themeService.getTheme(themeKey);
}

function getThemeCards(currentThemeKey) {
  return themeService.getThemeCards(currentThemeKey);
}

function getPageThemeData(themeKey) {
  return themeService.getPageThemeData(themeKey);
}

function applyNavigationBar(themeKey) {
  themeService.applyNavigationBar(themeKey);
}

module.exports = {
  STORAGE_KEY,
  DEFAULT_THEME_ID,
  themes,
  normalizeTheme,
  getCurrentThemeKey,
  getCurrentTheme,
  saveTheme,
  getThemeNames,
  getThemeByIndex,
  getThemeByKey,
  getThemeCards,
  getPageThemeData,
  applyNavigationBar
};
