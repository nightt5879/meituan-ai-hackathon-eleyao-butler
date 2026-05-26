function getCustomNavMetrics() {
  let statusBarHeight = 0;
  let navBarHeight = 44;
  let navRightPadding = 16;
  let navTitleSidePadding = 48;
  let menuButtonTop = 0;
  let menuButtonHeight = 32;

  try {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const windowWidth = systemInfo.windowWidth || systemInfo.screenWidth || 0;

    statusBarHeight = Number(systemInfo.statusBarHeight) || 0;

    if (menuButton && menuButton.top && menuButton.height) {
      menuButtonTop = menuButton.top;
      menuButtonHeight = menuButton.height;
      navBarHeight = Math.max(44, (menuButtonTop - statusBarHeight) * 2 + menuButtonHeight);

      if (windowWidth && menuButton.left) {
        navRightPadding = Math.max(16, windowWidth - menuButton.left + 12);
      }
    }
  } catch (error) {
    statusBarHeight = 0;
    navBarHeight = 44;
    navRightPadding = 16;
  }

  navTitleSidePadding = Math.max(48, navRightPadding);

  return {
    statusBarHeight,
    navBarHeight,
    customNavTotalHeight: statusBarHeight + navBarHeight,
    navRightPadding,
    navTitleSidePadding,
    menuButtonTop,
    menuButtonHeight
  };
}

module.exports = {
  getCustomNavMetrics
};
