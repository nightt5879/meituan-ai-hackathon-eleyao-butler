const STORAGE_KEY = 'pageTheme';

const themes = [
  { key: 'warm', name: '温暖橙' },
  { key: 'blue', name: '清爽蓝' },
  { key: 'pink', name: '樱花粉' },
  { key: 'dark', name: '夜间黑' }
];

function normalizeTheme(themeKey) {
  return themes.some(function (theme) {
    return theme.key === themeKey;
  }) ? themeKey : 'warm';
}

function getCurrentThemeKey() {
  return normalizeTheme(wx.getStorageSync(STORAGE_KEY));
}

function saveTheme(themeKey) {
  const nextTheme = normalizeTheme(themeKey);
  wx.setStorageSync(STORAGE_KEY, nextTheme);
  return nextTheme;
}

function getThemeNames() {
  return themes.map(function (theme) {
    return theme.name;
  });
}

function getThemeByIndex(index) {
  return themes[index] || themes[0];
}

module.exports = {
  STORAGE_KEY,
  themes,
  getCurrentThemeKey,
  saveTheme,
  getThemeNames,
  getThemeByIndex
};
