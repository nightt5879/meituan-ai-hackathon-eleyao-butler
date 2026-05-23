const STORAGE_KEY = 'pageTheme';

const themes = [
  {
    key: 'bulletin',
    name: '公告板',
    description: '近白纸面、苔藓绿和编号信息流，适合比赛 demo 现场快速扫读',
    primary: '#2C5E3F',
    soft: '#E5EFE7',
    accent: '#2C5E3F',
    warn: '#A85A1A'
  }
];

function normalizeTheme(themeKey) {
  return themes.some(function (theme) {
    return theme.key === themeKey;
  }) ? themeKey : 'bulletin';
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

function getThemeByKey(themeKey) {
  const nextTheme = normalizeTheme(themeKey);
  return themes.find(function (theme) {
    return theme.key === nextTheme;
  }) || themes[0];
}

module.exports = {
  STORAGE_KEY,
  themes,
  getCurrentThemeKey,
  saveTheme,
  getThemeNames,
  getThemeByIndex,
  getThemeByKey
};
