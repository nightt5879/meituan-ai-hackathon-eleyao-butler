const STORAGE_KEY = 'pageTheme';

const themes = [
  {
    key: 'warm',
    name: '奶橙美食',
    description: '默认主题，温暖轻盈，适合餐饮和本地生活场景',
    primary: '#F07030',
    soft: '#FCEFE7',
    accent: '#5B8C5A',
    warn: '#C77A1B'
  },
  {
    key: 'mint',
    name: '薄荷绿',
    description: '清爽、轻负担，适合日常规划',
    primary: '#2DBF82',
    soft: '#E5F7F0',
    accent: '#2A9D8F',
    warn: '#C58A1B'
  },
  {
    key: 'cat',
    name: '黄猫管家',
    description: '奶油黄底，轻松但不过度幼稚',
    primary: '#F5A623',
    soft: '#FFF4D6',
    accent: '#FF6B6B',
    warn: '#C77A1B'
  },
  {
    key: 'blue',
    name: '蓝白管家',
    description: '干净可靠的 AI 管家感',
    primary: '#3D7EF5',
    soft: '#EAF2FF',
    accent: '#FF7043',
    warn: '#C58A1B'
  },
  {
    // Restored from HEAD — the previous default before the new palette
    // refresh. Kept as a selectable option so users who preferred the older
    // deeper-orange identity can still use it.
    key: 'original',
    name: '原始主题',
    description: '改版前的温暖橙配色，保留给习惯老版的用户',
    primary: '#E8743A',
    soft: '#FDEADC',
    accent: '#5B8C5A',
    warn: '#C77A1B'
  },
  {
    // Restored from HEAD — kept as a separate sakura-pink theme so users
    // who prefer the dessert / date vibe can switch back.
    key: 'pink',
    name: '樱花粉',
    description: '轻松一点的甜品和约会氛围',
    primary: '#D85C82',
    soft: '#FAD8E3',
    accent: '#6E9B7E',
    warn: '#C57A4A'
  },
  {
    // Restored from HEAD — dark mode for night dining / low-light reading.
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
