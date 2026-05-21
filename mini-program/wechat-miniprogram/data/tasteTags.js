const tags = [
  { id: 'taste_light', label: '清淡', type: 'taste' },
  { id: 'taste_fresh', label: '鲜香', type: 'taste' },
  { id: 'taste_salty', label: '咸香', type: 'taste' },
  { id: 'taste_spicy', label: '香辣', type: 'taste' },
  { id: 'taste_mala', label: '麻辣', type: 'taste' },
  { id: 'taste_sour_spicy', label: '酸辣', type: 'taste' },
  { id: 'taste_sour_sweet', label: '酸甜', type: 'taste' },
  { id: 'taste_rich', label: '浓郁', type: 'taste' },
  { id: 'taste_refreshing', label: '爽口', type: 'taste' },

  { id: 'need_hot', label: '热乎的', type: 'need' },
  { id: 'need_soup', label: '汤汤水水', type: 'need' },
  { id: 'need_rice', label: '下饭', type: 'need' },
  { id: 'need_less_oil', label: '不油腻', type: 'need' },
  { id: 'need_light', label: '轻负担', type: 'need' },
  { id: 'need_craving', label: '解馋', type: 'need' },
  { id: 'need_full', label: '饱腹感强', type: 'need' },

  { id: 'avoid_spicy', label: '不吃辣', type: 'avoid' },
  { id: 'avoid_cilantro', label: '不要香菜', type: 'avoid' },
  { id: 'avoid_garlic', label: '不要葱蒜', type: 'avoid' },
  { id: 'avoid_seafood', label: '不吃海鲜', type: 'avoid' },
  { id: 'avoid_offal', label: '不吃内脏', type: 'avoid' },
  { id: 'avoid_beef_lamb', label: '不吃牛羊肉', type: 'avoid' },
  { id: 'avoid_fried', label: '不吃油炸', type: 'avoid' },
  { id: 'avoid_low_oil_salt', label: '少油少盐', type: 'avoid' },
  { id: 'avoid_none', label: '没有忌口', type: 'avoid' },

  { id: 'spicy_none', label: '不吃辣', type: 'spicyLevel' },
  { id: 'spicy_light', label: '微辣', type: 'spicyLevel' },
  { id: 'spicy_medium', label: '中辣', type: 'spicyLevel' },
  { id: 'spicy_heavy', label: '重辣', type: 'spicyLevel' }
];

function getTagsByType(type) {
  return tags.filter(function (tag) {
    return tag.type === type;
  });
}

function getTagById(id) {
  return tags.find(function (tag) {
    return tag.id === id;
  });
}

function getLabelsByIds(ids) {
  return (ids || []).map(function (id) {
    const tag = getTagById(id);
    return tag ? tag.label : '';
  }).filter(function (label) {
    return !!label;
  });
}

module.exports = {
  tags,
  getTagsByType,
  getTagById,
  getLabelsByIds
};
