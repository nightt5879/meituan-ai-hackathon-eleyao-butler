const STORAGE_KEY = 'pageTheme';

const themes = [
  {
    key: 'warm',
    name: '温暖橙',
    description: '默认主题，适合餐饮和日常生活场景',
    primary: '#E8743A',
    soft: '#FDEADC',
    accent: '#5B8C5A',
    warn: '#C77A1B'
  },
  {
    key: 'blue',
    name: '清爽蓝',
    description: '更冷静的工作日选择感',
    primary: '#3D7BD9',
    soft: '#DCE8FA',
    accent: '#3DAA8C',
    warn: '#C58A1B'
  },
  {
    key: 'pink',
    name: '樱花粉',
    description: '轻松一点的甜品和约会氛围',
    primary: '#D85C82',
    soft: '#FAD8E3',
    accent: '#6E9B7E',
    warn: '#C57A4A'
  },
  {
    key: 'dark',
    name: '夜间黑',
    description: '夜宵和低光环境更舒服',
    primary: '#F4925A',
    soft: '#3A2A1E',
    accent: '#6FB07E',
    warn: '#E3A04B'
  }
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
