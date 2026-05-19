const mockShops = [
  {
    id: 'shop_beef_noodle',
    name: '老街牛肉粉',
    category: '粉面',
    price: 28,
    distanceMeters: 800,
    rating: 4.7,
    tags: ['热乎的', '汤汤水水', '鲜香', '下饭', '饱腹感强'],
    avoidRisk: ['不吃牛羊肉', '不要葱蒜'],
    spicyLevel: '微辣',
    riskTips: ['可能排队较久']
  },
  {
    id: 'shop_congee',
    name: '清粥小菜',
    category: '粥店',
    price: 24,
    distanceMeters: 500,
    rating: 4.6,
    tags: ['清淡', '轻负担', '不油腻', '热乎的', '少油少盐'],
    avoidRisk: [],
    spicyLevel: '不吃辣',
    riskTips: []
  },
  {
    id: 'shop_hunan',
    name: '川湘小炒',
    category: '湘菜',
    price: 52,
    distanceMeters: 900,
    rating: 4.5,
    tags: ['香辣', '麻辣', '下饭', '解馋', '浓郁'],
    avoidRisk: ['不吃辣', '不要葱蒜'],
    spicyLevel: '重辣',
    riskTips: ['口味偏重']
  },
  {
    id: 'shop_tomato_noodle',
    name: '番茄汤粉',
    category: '粉面',
    price: 32,
    distanceMeters: 700,
    rating: 4.8,
    tags: ['酸甜', '汤汤水水', '热乎的', '爽口', '轻负担'],
    avoidRisk: [],
    spicyLevel: '不吃辣',
    riskTips: []
  },
  {
    id: 'shop_seafood_congee',
    name: '海鲜砂锅粥',
    category: '粥店',
    price: 58,
    distanceMeters: 1100,
    rating: 4.7,
    tags: ['鲜香', '汤汤水水', '热乎的', '清淡'],
    avoidRisk: ['不吃海鲜'],
    spicyLevel: '不吃辣',
    riskTips: ['出餐稍慢']
  },
  {
    id: 'shop_malatang',
    name: '麻辣烫研究所',
    category: '麻辣烫',
    price: 38,
    distanceMeters: 600,
    rating: 4.4,
    tags: ['麻辣', '香辣', '热乎的', '解馋', '饱腹感强'],
    avoidRisk: ['不吃辣', '不要香菜', '不要葱蒜'],
    spicyLevel: '中辣',
    riskTips: ['口味偏重']
  },
  {
    id: 'shop_bento',
    name: '日式便当',
    category: '简餐',
    price: 46,
    distanceMeters: 1000,
    rating: 4.5,
    tags: ['咸香', '不油腻', '饱腹感强', '轻负担'],
    avoidRisk: [],
    spicyLevel: '不吃辣',
    riskTips: []
  },
  {
    id: 'shop_fried_chicken',
    name: '脆皮炸鸡汉堡',
    category: '快餐',
    price: 42,
    distanceMeters: 550,
    rating: 4.3,
    tags: ['咸香', '解馋', '饱腹感强'],
    avoidRisk: ['不吃油炸'],
    spicyLevel: '不吃辣',
    riskTips: ['热量偏高']
  },
  {
    id: 'shop_sour_spicy',
    name: '酸辣粉小铺',
    category: '粉面',
    price: 25,
    distanceMeters: 450,
    rating: 4.6,
    tags: ['酸辣', '香辣', '爽口', '解馋'],
    avoidRisk: ['不吃辣', '不要葱蒜'],
    spicyLevel: '中辣',
    riskTips: ['口味偏酸辣']
  },
  {
    id: 'shop_veggie',
    name: '素食轻餐',
    category: '轻食',
    price: 35,
    distanceMeters: 650,
    rating: 4.6,
    tags: ['清淡', '爽口', '不油腻', '轻负担', '少油少盐'],
    avoidRisk: [],
    spicyLevel: '不吃辣',
    riskTips: []
  }
];

module.exports = {
  mockShops
};
