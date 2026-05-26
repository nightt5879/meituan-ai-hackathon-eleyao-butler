const STORAGE_KEY = 'pageTheme';
const DEFAULT_THEME_ID = 'mint-green';

const themes = [
  {
    id: 'sky-blue',
    key: 'sky-blue',
    name: '天蓝色',
    description: '清爽、天空、轻盈',
    navigationBarColor: '#EEF9FF',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#6EC6FF',
      secondary: '#BDEBFF',
      background: '#EEF9FF',
      card: '#FFFFFF',
      text: '#1F3A5F',
      subtext: '#5C789A'
    },
    primary: '#6EC6FF',
    soft: '#BDEBFF',
    accent: '#4F9FE6',
    warn: '#F2B84B'
  },
  {
    id: 'sakura-pink',
    key: 'sakura-pink',
    name: '樱花粉',
    description: '柔和、可爱、温暖',
    navigationBarColor: '#FFF3F7',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#FF9FBC',
      secondary: '#FFD6E3',
      background: '#FFF3F7',
      card: '#FFFFFF',
      text: '#5A2A3A',
      subtext: '#9A6072'
    },
    primary: '#FF9FBC',
    soft: '#FFD6E3',
    accent: '#7EC6A4',
    warn: '#D58B2D'
  },
  {
    id: 'lemon-yellow',
    key: 'lemon-yellow',
    name: '柠檬黄',
    description: '明亮、元气、活泼',
    navigationBarColor: '#FFFBEA',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#FFD84D',
      secondary: '#FFF0A6',
      background: '#FFFBEA',
      card: '#FFFFFF',
      text: '#4A3B00',
      subtext: '#806A1E'
    },
    primary: '#FFD84D',
    soft: '#FFF0A6',
    accent: '#5AD8B2',
    warn: '#D88724'
  },
  {
    id: 'black-pink',
    key: 'black-pink',
    name: '黑粉',
    description: '酷、潮流、音乐感',
    navigationBarColor: '#111111',
    navigationBarTextStyle: 'white',
    colors: {
      primary: '#FF4FA3',
      secondary: '#FFB3D9',
      background: '#111111',
      card: '#1E1E1E',
      text: '#FFFFFF',
      subtext: '#CFCFCF'
    },
    primary: '#FF4FA3',
    soft: '#3A2230',
    accent: '#FFB3D9',
    warn: '#FFD166'
  },
  {
    id: 'night',
    key: 'night',
    name: '夜间模式',
    description: '低亮度、护眼、安静',
    navigationBarColor: '#0F172A',
    navigationBarTextStyle: 'white',
    colors: {
      primary: '#7C8CFF',
      secondary: '#2F3A5F',
      background: '#0F172A',
      card: '#1E293B',
      text: '#F8FAFC',
      subtext: '#CBD5E1'
    },
    primary: '#7C8CFF',
    soft: '#2F3A5F',
    accent: '#5AD8B2',
    warn: '#FBBF24'
  },
  {
    id: 'mint-green',
    key: 'mint-green',
    name: '薄荷绿',
    description: '清新、健康、轻食感',
    navigationBarColor: '#EFFFF8',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#5AD8B2',
      secondary: '#BDF4E5',
      background: '#EFFFF8',
      card: '#FFFFFF',
      text: '#164E3F',
      subtext: '#4F7D70'
    },
    primary: '#5AD8B2',
    soft: '#BDF4E5',
    accent: '#3CB995',
    warn: '#D68C21'
  }
];

const legacyThemeMap = {
  warm: DEFAULT_THEME_ID,
  original: DEFAULT_THEME_ID,
  mint: DEFAULT_THEME_ID,
  cat: 'lemon-yellow',
  blue: 'sky-blue',
  pink: 'sakura-pink',
  dark: 'night',
  light: DEFAULT_THEME_ID
};

function normalizeThemeId(themeId) {
  const raw = String(themeId || '').trim();

  if (!raw) {
    return DEFAULT_THEME_ID;
  }

  for (let i = 0; i < themes.length; i += 1) {
    if (themes[i].id === raw || themes[i].key === raw) {
      return themes[i].id;
    }
  }

  return legacyThemeMap[raw] || DEFAULT_THEME_ID;
}

function getThemeById(themeId) {
  const id = normalizeThemeId(themeId);

  for (let i = 0; i < themes.length; i += 1) {
    if (themes[i].id === id) {
      return themes[i];
    }
  }

  return themes[0];
}

function getCurrentThemeId() {
  try {
    return normalizeThemeId(wx.getStorageSync(STORAGE_KEY));
  } catch (error) {
    return DEFAULT_THEME_ID;
  }
}

function saveTheme(themeId) {
  const id = normalizeThemeId(themeId);

  try {
    wx.setStorageSync(STORAGE_KEY, id);
  } catch (error) {}

  return id;
}

function getThemeCards(currentThemeId) {
  const activeId = normalizeThemeId(currentThemeId || getCurrentThemeId());

  return themes.map(function (theme) {
    return Object.assign({}, theme, {
      isActive: theme.id === activeId,
      cardClass: theme.id === activeId ? 'active' : ''
    });
  });
}

function getPageThemeData(themeId) {
  const id = normalizeThemeId(themeId || getCurrentThemeId());
  const theme = getThemeById(id);

  return {
    currentTheme: id,
    themeClass: 'theme-' + id,
    theme: theme,
    pageTheme: theme,
    themeData: theme,
    switchColor: theme.colors.primary,
    switchTrackColor: theme.colors.secondary
  };
}

function applyNavigationBar(themeId) {
  const theme = getThemeById(themeId || getCurrentThemeId());
  const frontColor = theme.navigationBarTextStyle === 'white' ? '#ffffff' : '#000000';

  try {
    wx.setNavigationBarColor({
      frontColor: frontColor,
      backgroundColor: theme.navigationBarColor || theme.colors.background,
      animation: {
        duration: 180,
        timingFunc: 'easeInOut'
      }
    });
  } catch (error) {}

  try {
    wx.setBackgroundColor({
      backgroundColor: theme.colors.background,
      backgroundColorTop: theme.colors.background,
      backgroundColorBottom: theme.colors.background
    });
  } catch (error) {}

  return theme;
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  DEFAULT_THEME_ID: DEFAULT_THEME_ID,
  themes: themes,
  legacyThemeMap: legacyThemeMap,
  normalizeThemeId: normalizeThemeId,
  getThemeById: getThemeById,
  getCurrentThemeId: getCurrentThemeId,
  saveTheme: saveTheme,
  getThemeCards: getThemeCards,
  getPageThemeData: getPageThemeData,
  applyNavigationBar: applyNavigationBar
};
