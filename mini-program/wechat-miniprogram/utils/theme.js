const STORAGE_KEY = 'pageTheme';
const DEFAULT_THEME_ID = 'mint-green';

const themes = [
  {
    id: 'sky-blue',
    key: 'sky-blue',
    name: '天蓝色',
    description: '清爽、天空、轻盈',
    navigationBarColor: '#6EC6FF',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#6EC6FF',
      secondary: '#BDEBFF',
      background: '#EEF9FF',
      backgroundSoft: '#DDF4FF',
      card: '#FFFFFF',
      textPrimary: '#1F3A5F',
      textSecondary: '#5F7697',
      textSubtle: '#7890AE',
      border: '#CDEFFF',
      borderStrong: '#9ADFFF',
      chipBg: '#FFFFFF',
      onPrimary: '#10324E',
      warn: '#337596',
      warnSoft: '#DDF4FF',
      danger: '#B45A7B',
      dangerSoft: '#FFE6EF',
      shadow: '0 18rpx 48rpx rgba(31, 58, 95, 0.10)',
      buttonShadow: '0 12rpx 30rpx rgba(110, 198, 255, 0.30)'
    }
  },
  {
    id: 'sakura-pink',
    key: 'sakura-pink',
    name: '樱花粉',
    description: '柔和、可爱、温暖',
    navigationBarColor: '#FF9FBC',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#FF9FBC',
      secondary: '#FFD6E3',
      background: '#FFF3F7',
      backgroundSoft: '#FFE7EF',
      card: '#FFFFFF',
      textPrimary: '#5A2A3A',
      textSecondary: '#9A6074',
      textSubtle: '#B07B8E',
      border: '#FFD4E1',
      borderStrong: '#FFB8CE',
      chipBg: '#FFFFFF',
      onPrimary: '#5A2A3A',
      warn: '#9A5A22',
      warnSoft: '#FFF0D8',
      danger: '#A83E65',
      dangerSoft: '#FFE0EB',
      shadow: '0 18rpx 48rpx rgba(90, 42, 58, 0.10)',
      buttonShadow: '0 12rpx 30rpx rgba(255, 159, 188, 0.30)'
    }
  },
  {
    id: 'lemon-yellow',
    key: 'lemon-yellow',
    name: '柠檬黄',
    description: '明亮、元气、活泼',
    navigationBarColor: '#FFD84D',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#FFD84D',
      secondary: '#FFF0A6',
      background: '#FFFBEA',
      backgroundSoft: '#FFF4BB',
      card: '#FFFFFF',
      textPrimary: '#4A3B00',
      textSecondary: '#8A7517',
      textSubtle: '#A3923A',
      border: '#F7E59A',
      borderStrong: '#EACB55',
      chipBg: '#FFFFFF',
      onPrimary: '#4A3B00',
      warn: '#9A6900',
      warnSoft: '#FFF3C4',
      danger: '#A8442F',
      dangerSoft: '#FFE8DD',
      shadow: '0 18rpx 48rpx rgba(74, 59, 0, 0.10)',
      buttonShadow: '0 12rpx 30rpx rgba(255, 216, 77, 0.32)'
    }
  },
  {
    id: 'black-pink',
    key: 'black-pink',
    name: '黑粉',
    description: '酷、潮流、音乐感、夜店感',
    navigationBarColor: '#111111',
    navigationBarTextStyle: 'white',
    colors: {
      primary: '#FF4FA3',
      secondary: '#FFB3D9',
      background: '#111111',
      backgroundSoft: '#19161A',
      card: '#1E1E1E',
      textPrimary: '#FFFFFF',
      textSecondary: '#CFCFCF',
      textSubtle: '#A7A7A7',
      border: '#333333',
      borderStrong: '#4A3A44',
      chipBg: '#262026',
      onPrimary: '#111111',
      warn: '#FFB86B',
      warnSoft: '#2A2118',
      danger: '#FF7A8A',
      dangerSoft: '#2B1C22',
      shadow: '0 18rpx 48rpx rgba(0, 0, 0, 0.36)',
      buttonShadow: '0 12rpx 32rpx rgba(255, 79, 163, 0.32)'
    }
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
      backgroundSoft: '#16213A',
      card: '#1E293B',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textSubtle: '#94A3B8',
      border: '#334155',
      borderStrong: '#475569',
      chipBg: '#182235',
      onPrimary: '#0F172A',
      warn: '#FBBF24',
      warnSoft: '#2B2616',
      danger: '#FB7185',
      dangerSoft: '#2D1B24',
      shadow: '0 18rpx 48rpx rgba(0, 0, 0, 0.30)',
      buttonShadow: '0 12rpx 32rpx rgba(124, 140, 255, 0.28)'
    }
  },
  {
    id: 'mint-green',
    key: 'mint-green',
    name: '薄荷绿',
    description: '清新、健康、轻食感',
    navigationBarColor: '#5AD8B2',
    navigationBarTextStyle: 'black',
    colors: {
      primary: '#5AD8B2',
      secondary: '#BDF4E5',
      background: '#EFFFF8',
      backgroundSoft: '#DDF8EF',
      card: '#FFFFFF',
      textPrimary: '#164E3F',
      textSecondary: '#5D806F',
      textSubtle: '#78998A',
      border: '#C8F1E4',
      borderStrong: '#93E6CD',
      chipBg: '#FFFFFF',
      onPrimary: '#164E3F',
      warn: '#6A7A16',
      warnSoft: '#F4F8D8',
      danger: '#B54747',
      dangerSoft: '#FFE6E6',
      shadow: '0 18rpx 48rpx rgba(22, 78, 63, 0.10)',
      buttonShadow: '0 12rpx 30rpx rgba(90, 216, 178, 0.30)'
    }
  }
];

const legacyThemeMap = {
  bulletin: 'mint-green',
  warm: 'mint-green',
  blue: 'sky-blue',
  pink: 'sakura-pink',
  dark: 'night'
};

function findTheme(themeId) {
  return themes.find(function (theme) {
    return theme.id === themeId || theme.key === themeId;
  });
}

function normalizeThemeId(themeId) {
  const rawThemeId = themeId && themeId.id ? themeId.id : themeId;
  const mappedThemeId = legacyThemeMap[rawThemeId] || rawThemeId;
  return findTheme(mappedThemeId) ? mappedThemeId : DEFAULT_THEME_ID;
}

function getTheme(themeId) {
  return findTheme(normalizeThemeId(themeId)) || findTheme(DEFAULT_THEME_ID);
}

function getSavedThemeId() {
  return normalizeThemeId(wx.getStorageSync(STORAGE_KEY));
}

function getSavedTheme() {
  return getTheme(getSavedThemeId());
}

function saveTheme(themeId) {
  const theme = getTheme(themeId);
  wx.setStorageSync(STORAGE_KEY, theme.id);
  return theme;
}

function buildThemeStyle(themeId) {
  const theme = getTheme(themeId);
  const colors = theme.colors;

  return [
    '--bg: ' + colors.background,
    '--bg-soft: ' + colors.backgroundSoft,
    '--card: ' + colors.card,
    '--ink: ' + colors.textPrimary,
    '--ink-2: ' + colors.textPrimary,
    '--muted: ' + colors.textSecondary,
    '--subtle: ' + colors.textSubtle,
    '--hair: ' + colors.border,
    '--hair-strong: ' + colors.borderStrong,
    '--accent: ' + colors.primary,
    '--accent-ink: ' + colors.textPrimary,
    '--accent-soft: ' + colors.backgroundSoft,
    '--on-accent: ' + colors.onPrimary,
    '--warn: ' + colors.warn,
    '--warn-soft: ' + colors.warnSoft,
    '--bad: ' + colors.danger,
    '--bad-soft: ' + colors.dangerSoft,
    '--ok: ' + colors.primary,
    '--theme-bg: ' + colors.background,
    '--theme-bg-soft: ' + colors.backgroundSoft,
    '--theme-primary: ' + colors.primary,
    '--theme-primary-deep: ' + colors.textPrimary,
    '--theme-primary-soft: ' + colors.backgroundSoft,
    '--theme-primary-ghost: ' + colors.backgroundSoft,
    '--theme-soft: ' + colors.backgroundSoft,
    '--theme-secondary: ' + colors.secondary,
    '--theme-card: ' + colors.card,
    '--theme-card-muted: ' + colors.backgroundSoft,
    '--theme-text: ' + colors.textPrimary,
    '--theme-muted: ' + colors.textSecondary,
    '--theme-subtle: ' + colors.textSubtle,
    '--theme-border: ' + colors.border,
    '--theme-border-strong: ' + colors.borderStrong,
    '--theme-chip-bg: ' + colors.chipBg,
    '--theme-chip-text: ' + colors.textPrimary,
    '--theme-on-primary: ' + colors.onPrimary,
    '--theme-ai-bubble: ' + colors.card,
    '--theme-user-bubble: ' + colors.backgroundSoft,
    '--theme-user-text: ' + colors.textPrimary,
    '--theme-accent: ' + colors.primary,
    '--theme-warn: ' + colors.warn,
    '--theme-danger: ' + colors.danger,
    '--theme-risk-bg: ' + colors.warnSoft,
    '--theme-risk-text: ' + colors.warn,
    '--theme-shadow-card: ' + colors.shadow,
    '--theme-shadow-button: ' + colors.buttonShadow
  ].join('; ') + ';';
}

function getPageThemeData(themeId) {
  const theme = getTheme(themeId || getSavedThemeId());

  return {
    theme,
    currentTheme: theme.id,
    themeClass: 'theme-' + theme.id,
    themeStyle: buildThemeStyle(theme.id),
    switchColor: theme.colors.primary
  };
}

function getThemeCards(currentThemeId) {
  const activeThemeId = normalizeThemeId(currentThemeId || getSavedThemeId());

  return themes.map(function (theme) {
    return Object.assign({}, theme, {
      key: theme.id,
      primary: theme.colors.primary,
      soft: theme.colors.backgroundSoft,
      accent: theme.colors.secondary,
      warn: theme.colors.warn,
      previewStyle: 'background: linear-gradient(135deg, ' + theme.colors.primary + ' 0%, ' + theme.colors.secondary + ' 56%, ' + theme.colors.background + ' 100%);',
      isActive: theme.id === activeThemeId,
      cardClass: theme.id === activeThemeId ? 'active' : ''
    });
  });
}

function applyNavigationBar(themeId) {
  const theme = getTheme(themeId);
  const frontColor = theme.navigationBarTextStyle === 'white' ? '#ffffff' : '#000000';

  if (wx.setNavigationBarColor) {
    wx.setNavigationBarColor({
      frontColor,
      backgroundColor: theme.navigationBarColor
    });
  }

  if (wx.setBackgroundColor) {
    wx.setBackgroundColor({
      backgroundColor: theme.colors.background,
      backgroundColorTop: theme.colors.background,
      backgroundColorBottom: theme.colors.background
    });
  }
}

module.exports = {
  STORAGE_KEY,
  DEFAULT_THEME_ID,
  themes,
  normalizeThemeId,
  getTheme,
  getSavedThemeId,
  getSavedTheme,
  saveTheme,
  buildThemeStyle,
  getPageThemeData,
  getThemeCards,
  applyNavigationBar
};
