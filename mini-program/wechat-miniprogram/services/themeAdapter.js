const themeUtils = require('../utils/theme');

function getCurrentThemeKey() {
  return themeUtils.getCurrentThemeId();
}

function saveTheme(themeKey) {
  return themeUtils.saveTheme(themeKey);
}

function getThemeNames() {
  return themeUtils.themes.map(function (theme) {
    return theme.name;
  });
}

function getThemeByIndex(index) {
  return themeUtils.themes[index] || themeUtils.themes[0];
}

function getThemeByKey(themeKey) {
  return themeUtils.getThemeById(themeKey);
}

module.exports = Object.assign({}, themeUtils, {
  getCurrentThemeKey: getCurrentThemeKey,
  saveTheme: saveTheme,
  getThemeNames: getThemeNames,
  getThemeByIndex: getThemeByIndex,
  getThemeByKey: getThemeByKey
});
