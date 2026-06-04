#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(frontendRoot, "data", "restaurant");
const DEFAULT_CANDIDATE_LIMIT = 12;
const MINIMUM_CANDIDATES = 2;
const RECOMMENDED_CANDIDATES = 6;
const IDEAL_CANDIDATES = 12;
const STRONG_POSITIVE_MATCH_LIMIT = 6;
const STRONG_POSITIVE_MIN_SCORE = 24;
const ANCHOR_BOOST_MAX = 18;
const NORMAL_OFFICIAL_COVERAGE_TARGET = 474;
const EXTREME_COVERAGE_TARGET = 24;

const focusedCases = [
  caseSpec("重点 1｜晚餐 + 60元内 + 500米以内 + 不要香菜 + 想吃热乎的", {
    mealPurpose: "晚餐",
    branchPreference: "热乎的",
    budget: "60元内",
    distance: "500米以内",
    tasteTags: ["热乎"],
    avoidTags: ["不要香菜"]
  }),
  caseSpec("重点 2｜午餐 + 30元内 + 1公里内 + 不吃辣 + 快一点", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "1公里内",
    needTags: ["快一点"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("重点 3｜夜宵 + 80元内 + 1.5公里内 + 和朋友一起吃", {
    mealPurpose: "夜宵",
    budget: "80元内",
    distance: "1.5公里内",
    needTags: ["和朋友一起吃"]
  }),
  caseSpec("重点 4｜早餐 + 30元内 + 500米以内 + 清淡", {
    mealPurpose: "早餐",
    budget: "30元内",
    distance: "500米以内",
    tasteTags: ["清淡"]
  })
];

const mealDistanceBudgetCases = [
  ...[
    "早餐",
    "午餐",
    "晚餐",
    "夜宵",
    "一个人随便吃",
    "和朋友一起吃",
    "工作日快餐",
    "周末放松吃"
  ].flatMap((mealPurpose) => {
    return [
      { budget: "30元内", distance: "500米以内" },
      { budget: "60元内", distance: "1公里以内" },
      { budget: "80元内", distance: "1.5公里以内" }
    ].map((combo) => caseSpec(`抽样｜${mealPurpose} + ${combo.budget} + ${combo.distance}`, {
      mealPurpose,
      budget: combo.budget,
      distance: combo.distance
    }));
  })
];

const preferenceCases = [
  caseSpec("口味｜午餐低预算 500m + 不吃辣 + 快一点", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "500米以内",
    needTags: ["快一点"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("口味｜午餐低预算 500m + 不要香菜 + 清淡", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "500米以内",
    tasteTags: ["清淡"],
    avoidTags: ["不要香菜"]
  }),
  caseSpec("口味｜晚餐 500m + 不吃辣 + 热乎的", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "500米以内",
    needTags: ["热乎的"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("口味｜晚餐 1km + 不要香菜 + 下饭", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "1公里以内",
    needTags: ["下饭"],
    avoidTags: ["不要香菜"]
  }),
  caseSpec("口味｜夜宵 1km + 不吃辣 + 和朋友一起吃", {
    mealPurpose: "夜宵",
    budget: "80元内",
    distance: "1公里以内",
    needTags: ["和朋友一起吃"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("口味｜一个人随便吃 500m + 清淡 + 不油腻", {
    mealPurpose: "一个人随便吃",
    branchPreference: "清淡点 / 不油腻",
    budget: "30元内",
    distance: "500米以内",
    tasteTags: ["清淡"],
    needTags: ["不油腻"]
  }),
  caseSpec("口味｜工作日快餐 500m + 快一点 + 管饱", {
    mealPurpose: "工作日快餐",
    branchPreference: "快一点 / 管饱",
    budget: "30元内",
    distance: "500米以内",
    needTags: ["快一点", "饱腹感强"]
  }),
  caseSpec("口味｜周末放松吃 1.5km + 鲜香 + 解馋", {
    mealPurpose: "周末放松吃",
    budget: "80元内",
    distance: "1.5公里以内",
    tasteTags: ["鲜香"],
    needTags: ["解馋"]
  })
];

const branchCases = [
  caseSpec("品类｜早餐 500m + 包子/点心", {
    mealPurpose: "早餐",
    branchPreference: "包子/点心",
    budget: "30元内",
    distance: "500米以内"
  }),
  caseSpec("品类｜早餐 500m + 粥", {
    mealPurpose: "早餐",
    branchPreference: "粥",
    budget: "30元内",
    distance: "500米以内",
    tasteTags: ["清淡"]
  }),
  caseSpec("品类｜早餐 500m + 面条/粉", {
    mealPurpose: "早餐",
    branchPreference: "面条/粉",
    budget: "30元内",
    distance: "500米以内"
  }),
  caseSpec("品类｜早餐 1km + 轻食", {
    mealPurpose: "早餐",
    branchPreference: "轻食",
    budget: "30元内",
    distance: "1公里以内",
    tasteTags: ["清淡"],
    needTags: ["轻负担"]
  }),
  caseSpec("品类｜午餐 500m + 中式简餐", {
    mealPurpose: "午餐",
    branchPreference: "中式简餐",
    budget: "30元内",
    distance: "500米以内"
  }),
  caseSpec("品类｜午餐 500m + 米饭套餐", {
    mealPurpose: "午餐",
    branchPreference: "米饭套餐",
    budget: "30元内",
    distance: "500米以内"
  }),
  caseSpec("品类｜午餐 1km + 粉面", {
    mealPurpose: "午餐",
    branchPreference: "粉面",
    budget: "30元内",
    distance: "1公里以内"
  }),
  caseSpec("品类｜晚餐 500m + 家常菜", {
    mealPurpose: "晚餐",
    branchPreference: "家常菜",
    budget: "60元内",
    distance: "500米以内"
  }),
  caseSpec("品类｜晚餐 1km + 火锅/冒菜", {
    mealPurpose: "晚餐",
    branchPreference: "火锅/冒菜",
    budget: "80元内",
    distance: "1公里以内"
  }),
  caseSpec("品类｜夜宵 1km + 烧烤", {
    mealPurpose: "夜宵",
    branchPreference: "烧烤",
    budget: "80元内",
    distance: "1公里以内"
  }),
  caseSpec("品类｜夜宵 1.5km + 粉面", {
    mealPurpose: "夜宵",
    branchPreference: "粉面",
    budget: "80元内",
    distance: "1.5公里以内"
  }),
  caseSpec("品类｜周末放松吃 1.5km + 西餐", {
    mealPurpose: "周末放松吃",
    branchPreference: "西餐",
    budget: "80元内",
    distance: "1.5公里以内"
  })
];

const temporaryAvoidCases = [
  caseSpec("临时避开｜午餐 1km + 不想吃油炸", {
    mealPurpose: "午餐",
    budget: "60元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃油炸"]
  }),
  caseSpec("临时避开｜午餐 1km + 不想吃太辣", {
    mealPurpose: "午餐",
    budget: "60元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃太辣"]
  }),
  caseSpec("临时避开｜午餐 1km + 不想吃米饭", {
    mealPurpose: "午餐",
    budget: "60元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃米饭"]
  }),
  caseSpec("临时避开｜晚餐 1km + 不想吃面", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃面"]
  }),
  caseSpec("临时避开｜晚餐 1km + 不想吃汤粉", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃汤粉"]
  }),
  caseSpec("临时避开｜下午茶 1km + 不想吃甜口", {
    mealPurpose: "下午茶",
    budget: "30元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃甜口"]
  }),
  caseSpec("临时避开｜早餐 500m + 不想吃冷食", {
    mealPurpose: "早餐",
    budget: "30元内",
    distance: "500米以内",
    temporaryAvoidTags: ["不想吃冷食"]
  }),
  caseSpec("临时避开｜夜宵 1km + 不想吃重口", {
    mealPurpose: "夜宵",
    budget: "80元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃重口"]
  })
];

const budgetPressureCases = [
  caseSpec("预算压力｜早餐 10元内 + 500m + 清淡", {
    mealPurpose: "早餐",
    budget: "10元内",
    distance: "500米以内",
    tasteTags: ["清淡"]
  }),
  caseSpec("预算压力｜早餐 10元内 + 1km + 热乎", {
    mealPurpose: "早餐",
    budget: "10元内",
    distance: "1公里以内",
    needTags: ["热乎的"]
  }),
  caseSpec("预算压力｜早餐 20元内 + 500m + 包子/点心", {
    mealPurpose: "早餐",
    branchPreference: "包子/点心",
    budget: "20元内",
    distance: "500米以内"
  }),
  caseSpec("预算压力｜早餐 20元内 + 1km + 粥", {
    mealPurpose: "早餐",
    branchPreference: "粥",
    budget: "20元内",
    distance: "1公里以内",
    tasteTags: ["清淡"]
  }),
  caseSpec("预算压力｜午餐 20元内 + 500m + 不吃辣 + 快一点", {
    mealPurpose: "午餐",
    budget: "20元内",
    distance: "500米以内",
    needTags: ["快一点"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("预算压力｜午餐 20元内 + 1km + 不要香菜 + 清淡", {
    mealPurpose: "午餐",
    budget: "20元内",
    distance: "1公里以内",
    tasteTags: ["清淡"],
    avoidTags: ["不要香菜"]
  }),
  caseSpec("预算压力｜晚餐 40元内 + 500m + 不要葱蒜 + 热乎", {
    mealPurpose: "晚餐",
    budget: "40元内",
    distance: "500米以内",
    needTags: ["热乎的"],
    avoidTags: ["不要葱蒜"]
  }),
  caseSpec("预算压力｜晚餐 40元内 + 1km + 平淡一点 + 不油腻", {
    mealPurpose: "晚餐",
    budget: "40元内",
    distance: "1公里以内",
    tasteTags: ["平淡一点"],
    needTags: ["不油腻"]
  }),
  caseSpec("预算压力｜夜宵 40元内 + 500m + 汤汤水水 + 不吃辣", {
    mealPurpose: "夜宵",
    budget: "40元内",
    distance: "500米以内",
    needTags: ["汤汤水水"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("预算压力｜夜宵 70元内 + 1km + 烧烤", {
    mealPurpose: "夜宵",
    branchPreference: "烧烤",
    budget: "70元内",
    distance: "1公里以内"
  }),
  caseSpec("预算压力｜下午茶 20元内 + 500m + 咖啡", {
    mealPurpose: "下午茶",
    branchPreference: "咖啡",
    budget: "20元内",
    distance: "500米以内"
  }),
  caseSpec("预算压力｜下午茶 30元内 + 500m + 奶茶", {
    mealPurpose: "下午茶",
    branchPreference: "奶茶",
    budget: "30元内",
    distance: "500米以内"
  }),
  caseSpec("预算压力｜下午茶 40元内 + 1km + 甜品", {
    mealPurpose: "下午茶",
    branchPreference: "甜品",
    budget: "40元内",
    distance: "1公里以内"
  }),
  caseSpec("预算压力｜午餐 100元内 + 2km + 和朋友一起吃", {
    mealPurpose: "午餐",
    budget: "100元内",
    distance: "2公里以内",
    needTags: ["适合朋友一起吃"]
  }),
  caseSpec("预算压力｜晚餐 100元内 + 远一点也行 + 周末放松", {
    mealPurpose: "晚餐",
    budget: "100元内",
    distance: "远一点也行",
    needTags: ["周末放松吃"]
  }),
  caseSpec("预算压力｜夜宵 70元内 + 2km + 和朋友一起吃", {
    mealPurpose: "夜宵",
    budget: "70元内",
    distance: "2公里以内",
    needTags: ["适合朋友一起吃"]
  })
];

const restrictionStressCases = [
  caseSpec("忌口压力｜午餐 30元内 + 500m + 不吃辣 + 清淡", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "500米以内",
    tasteTags: ["清淡"],
    avoidTags: ["不吃辣"],
    spicyLevel: "不吃辣"
  }),
  caseSpec("忌口压力｜午餐 30元内 + 500m + 不要葱蒜", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "500米以内",
    avoidTags: ["不要葱蒜"]
  }),
  caseSpec("忌口压力｜午餐 30元内 + 1km + 不吃海鲜", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "1公里以内",
    avoidTags: ["不吃海鲜"]
  }),
  caseSpec("忌口压力｜晚餐 60元内 + 500m + 不吃内脏", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "500米以内",
    avoidTags: ["不吃内脏"]
  }),
  caseSpec("忌口压力｜晚餐 60元内 + 1km + 不吃牛羊肉", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "1公里以内",
    avoidTags: ["不吃牛羊肉"]
  }),
  caseSpec("忌口压力｜夜宵 80元内 + 1km + 过敏/不能吃", {
    mealPurpose: "夜宵",
    budget: "80元内",
    distance: "1公里以内",
    avoidTags: ["过敏/不能吃"]
  }),
  caseSpec("忌口压力｜早餐 20元内 + 500m + 不要香菜", {
    mealPurpose: "早餐",
    budget: "20元内",
    distance: "500米以内",
    avoidTags: ["不要香菜"]
  }),
  caseSpec("忌口压力｜下午茶 30元内 + 1km + 不吃牛羊肉", {
    mealPurpose: "下午茶",
    budget: "30元内",
    distance: "1公里以内",
    avoidTags: ["不吃牛羊肉"]
  }),
  caseSpec("忌口压力｜和朋友一起吃 60元内 + 1km + 不吃海鲜", {
    mealPurpose: "和朋友一起吃",
    budget: "60元内",
    distance: "1公里以内",
    avoidTags: ["不吃海鲜"]
  }),
  caseSpec("忌口压力｜工作日快餐 30元内 + 500m + 不要葱蒜 + 快一点", {
    mealPurpose: "工作日快餐",
    budget: "30元内",
    distance: "500米以内",
    needTags: ["快一点"],
    avoidTags: ["不要葱蒜"]
  })
];

const distancePressureCases = [
  caseSpec("距离压力｜早餐 30元内 + 2km + 豆浆", {
    mealPurpose: "早餐",
    branchPreference: "豆浆",
    budget: "30元内",
    distance: "2公里以内"
  }),
  caseSpec("距离压力｜午餐 40元内 + 2km + 米饭套餐", {
    mealPurpose: "午餐",
    branchPreference: "米饭套餐",
    budget: "40元内",
    distance: "2公里以内"
  }),
  caseSpec("距离压力｜晚餐 60元内 + 2km + 家常菜", {
    mealPurpose: "晚餐",
    branchPreference: "家常菜",
    budget: "60元内",
    distance: "2公里以内"
  }),
  caseSpec("距离压力｜夜宵 80元内 + 2km + 甜品", {
    mealPurpose: "夜宵",
    branchPreference: "甜品",
    budget: "80元内",
    distance: "2公里以内"
  }),
  caseSpec("距离压力｜下午茶 50元内 + 2km + 水果/酸奶", {
    mealPurpose: "下午茶",
    branchPreference: "水果/酸奶",
    budget: "50元内",
    distance: "2公里以内"
  }),
  caseSpec("距离压力｜午餐 30元内 + 远一点也行 + 粉面", {
    mealPurpose: "午餐",
    branchPreference: "粉面",
    budget: "30元内",
    distance: "远一点也行"
  }),
  caseSpec("距离压力｜晚餐 80元内 + 远一点也行 + 火锅/冒菜", {
    mealPurpose: "晚餐",
    branchPreference: "火锅/冒菜",
    budget: "80元内",
    distance: "远一点也行"
  }),
  caseSpec("距离压力｜下午茶 30元内 + 远一点也行 + 不想吃甜口", {
    mealPurpose: "下午茶",
    budget: "30元内",
    distance: "远一点也行",
    temporaryAvoidTags: ["不想吃甜口"]
  })
];

const mixedNeedPressureCases = [
  caseSpec("需求压力｜午餐 30元内 + 500m + 平淡一点 + 不油腻", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "500米以内",
    tasteTags: ["平淡一点"],
    needTags: ["不油腻"]
  }),
  caseSpec("需求压力｜晚餐 60元内 + 500m + 热乎 + 汤汤水水", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "500米以内",
    needTags: ["热乎的", "汤汤水水"]
  }),
  caseSpec("需求压力｜午餐 30元内 + 1km + 快一点 + 饱腹感强", {
    mealPurpose: "午餐",
    budget: "30元内",
    distance: "1公里以内",
    needTags: ["快一点", "饱腹感强"]
  }),
  caseSpec("需求压力｜晚餐 80元内 + 1.5km + 解馋 + 适合朋友一起吃", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["解馋", "适合朋友一起吃"]
  }),
  caseSpec("需求压力｜一个人随便吃 20元内 + 1km + 便宜一点", {
    mealPurpose: "一个人随便吃",
    branchPreference: "便宜一点",
    budget: "20元内",
    distance: "1公里以内"
  }),
  caseSpec("需求压力｜一个人随便吃 30元内 + 500m + 快一点", {
    mealPurpose: "一个人随便吃",
    branchPreference: "快一点",
    budget: "30元内",
    distance: "500米以内",
    needTags: ["快一点"]
  }),
  caseSpec("需求压力｜工作日快餐 20元内 + 1km + 米饭套餐", {
    mealPurpose: "工作日快餐",
    branchPreference: "米饭套餐",
    budget: "20元内",
    distance: "1公里以内",
    needTags: ["快一点"]
  }),
  caseSpec("需求压力｜工作日快餐 40元内 + 500m + 轻食", {
    mealPurpose: "工作日快餐",
    branchPreference: "轻食",
    budget: "40元内",
    distance: "500米以内",
    tasteTags: ["清淡"],
    needTags: ["轻负担"]
  }),
  caseSpec("需求压力｜周末放松吃 60元内 + 1km + 日料", {
    mealPurpose: "周末放松吃",
    branchPreference: "日料",
    budget: "60元内",
    distance: "1公里以内",
    needTags: ["解馋"]
  }),
  caseSpec("需求压力｜周末放松吃 80元内 + 1.5km + 韩餐", {
    mealPurpose: "周末放松吃",
    branchPreference: "韩餐",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["适合朋友一起吃"]
  }),
  caseSpec("需求压力｜夜宵 40元内 + 1km + 粥 + 不想吃重口", {
    mealPurpose: "夜宵",
    branchPreference: "粥",
    budget: "40元内",
    distance: "1公里以内",
    temporaryAvoidTags: ["不想吃重口"]
  }),
  caseSpec("需求压力｜夜宵 70元内 + 1.5km + 小吃 + 不想吃油炸", {
    mealPurpose: "夜宵",
    branchPreference: "小吃",
    budget: "70元内",
    distance: "1.5公里以内",
    temporaryAvoidTags: ["不想吃油炸"]
  })
];

const regressionCoverageCases = withCoverageGroup(focusedCases, "regression");
const pressureCoverageCases = withCoverageGroup([
  ...mealDistanceBudgetCases,
  ...preferenceCases,
  ...branchCases,
  ...temporaryAvoidCases,
  ...budgetPressureCases,
  ...restrictionStressCases,
  ...distancePressureCases,
  ...mixedNeedPressureCases
], "pressure");
const manualNormalCoverageCases = dedupeCases([
  ...regressionCoverageCases,
  ...pressureCoverageCases
]);
const exhaustiveNormalCoverageCases = buildExhaustiveNormalCoverageCases(
  manualNormalCoverageCases,
  NORMAL_OFFICIAL_COVERAGE_TARGET - manualNormalCoverageCases.length
);
const extremeCoverageCases = buildExtremeCoverageCases([
  ...manualNormalCoverageCases,
  ...exhaustiveNormalCoverageCases
], EXTREME_COVERAGE_TARGET);
const cases = dedupeCases([
  ...manualNormalCoverageCases,
  ...exhaustiveNormalCoverageCases,
  ...extremeCoverageCases
]);

const positivePreferenceCases = [
  positiveCase("正向｜午餐 60元内 + 1km + 粉面", {
    mealPurpose: "午餐",
    branchPreference: "粉面",
    budget: "60元内",
    distance: "1公里以内"
  }, ["noodles"], 6),
  positiveCase("正向｜午餐 60元内 + 1km + 简餐 / 快餐", {
    mealPurpose: "午餐",
    branchPreference: "简餐 / 快餐",
    budget: "60元内",
    distance: "1公里以内"
  }, ["fastMeal"], 6),
  positiveCase("正向｜晚餐 60元内 + 1km + 清淡", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "1公里以内",
    tasteTags: ["清淡"]
  }, ["light"], 4),
  positiveCase("正向｜晚餐 60元内 + 1km + 热乎", {
    mealPurpose: "晚餐",
    budget: "60元内",
    distance: "1公里以内",
    needTags: ["热乎"]
  }, ["warm"], 4),
  positiveCase("正向｜晚餐 80元内 + 1.5km + 汤汤水水", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["汤汤水水"]
  }, ["soupy"], 4),
  positiveCase("正向｜早餐 30元内 + 500m + 快一点", {
    mealPurpose: "早餐",
    budget: "30元内",
    distance: "500米以内",
    needTags: ["快一点"]
  }, ["breakfast", "quick"], 4),
  positiveCase("正向｜夜宵 80元内 + 1.5km + 热乎 / 饱腹", {
    mealPurpose: "夜宵",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["热乎", "饱腹感强"]
  }, ["lateNight", "warm", "filling"], 4),
  positiveCase("正向｜和朋友一起吃 80元内 + 1.5km + 适合聊天", {
    mealPurpose: "和朋友一起吃",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["适合聊天"]
  }, ["chat", "group"], 5),
  positiveCase("正向｜周末放松吃 100元内 + 2km + 适合聊天", {
    mealPurpose: "周末放松吃",
    budget: "100元内",
    distance: "2公里以内",
    needTags: ["适合聊天"]
  }, ["weekend", "chat"], 5),
  positiveCase("正向｜一个人随便吃 30元内 + 1km + 简餐 / 快餐", {
    mealPurpose: "一个人随便吃",
    branchPreference: "简餐 / 快餐",
    budget: "30元内",
    distance: "1公里以内"
  }, ["fastMeal"], 6),
  positiveCase("正向｜一个人随便吃 30元内 + 1km + 低预算", {
    mealPurpose: "一个人随便吃",
    budget: "30元内",
    distance: "1公里以内",
    needTags: ["低预算"]
  }, ["lowBudget"], 6)
];

const spicyPositivePreferenceCases = [
  positiveCase("辣味｜午餐 60元内 + 1km + 想吃辣", {
    mealPurpose: "午餐",
    budget: "60元内",
    distance: "1公里以内",
    needTags: ["想吃辣"]
  }, ["spicy"], 4),
  positiveCase("辣味｜晚餐 80元内 + 1.5km + 香辣", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["香辣"]
  }, ["spicy", "mala"], 4),
  positiveCase("辣味｜晚餐 80元内 + 1.5km + 麻辣", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["麻辣"]
  }, ["mala"], 4, { minimumClearlySpicyHits: 2 }),
  positiveCase("辣味｜夜宵 80元内 + 1.5km + 重口 / 解馋", {
    mealPurpose: "夜宵",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["重口", "解馋"]
  }, ["heavyTaste", "crave", "warm", "filling"], 4),
  positiveCase("辣味｜和朋友一起吃 100元内 + 2km + 川湘 / 香辣", {
    mealPurpose: "和朋友一起吃",
    branchPreference: "川湘 / 香辣",
    budget: "100元内",
    distance: "2公里以内",
    needTags: ["香辣", "适合聊天"]
  }, ["sichuanHunan", "spicy", "mala"], 4),
  positiveCase("辣味｜午餐 60元内 + 1km + 微辣", {
    mealPurpose: "午餐",
    budget: "60元内",
    distance: "1公里以内",
    tasteTags: ["微辣"]
  }, ["mildSpicy", "spicy"], 3),
  positiveCase("辣味｜晚餐 80元内 + 1.5km + 中辣", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    tasteTags: ["中辣"]
  }, ["spicy", "heavyTaste"], 4),
  positiveCase("辣味｜晚餐 80元内 + 1.5km + 重辣", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    tasteTags: ["重辣"]
  }, ["spicy", "heavyTaste"], 4, { minimumClearlySpicyHits: 2 }),
  positiveCase("辣味｜晚餐 80元内 + 1.5km + 想吃辣 + 不吃辣", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    needTags: ["想吃辣"],
    tasteTags: ["想吃辣"],
    spicyLevel: "不吃辣",
    avoidTags: ["不吃辣"]
  }, ["spicy"], 0, { maximumClearlySpicyViolations: 0 }),
  positiveCase("辣味｜午餐 60元内 + 1km + 解馋 + 不吃辣", {
    mealPurpose: "午餐",
    budget: "60元内",
    distance: "1公里以内",
    needTags: ["解馋"],
    spicyLevel: "不吃辣",
    avoidTags: ["不吃辣"]
  }, ["nonSpicyCrave"], 4, { maximumClearlySpicyViolations: 0 })
];

const fixedRandomRegressionCases = [
  positiveCase("随机回归｜晚餐 80元内 + 2km + 新疆菜", {
    mealPurpose: "晚餐",
    branchPreference: "新疆菜",
    budget: "80元内",
    distance: "2公里以内"
  }, ["xinjiangFood"], 3, { allowDataThinPass: true }),
  positiveCase("随机回归｜午餐 40元内 + 1km + 爽口 + 不吃辣", {
    mealPurpose: "午餐",
    budget: "40元内",
    distance: "1公里以内",
    tasteTags: ["爽口"],
    spicyLevel: "不吃辣",
    avoidTags: ["不吃辣"]
  }, ["refreshing", "light", "lowOil", "lightFood"], 4, { maximumClearlySpicyViolations: 0 }),
  positiveCase("随机回归｜晚餐 80元内 + 1.5km + 浓郁", {
    mealPurpose: "晚餐",
    budget: "80元内",
    distance: "1.5公里以内",
    tasteTags: ["浓郁"]
  }, ["richTaste"], 4),
  positiveCase("随机回归｜晚餐 60元内 + 1km + 家常菜普通口味", {
    mealPurpose: "晚餐",
    branchPreference: "家常菜",
    budget: "60元内",
    distance: "1公里以内"
  }, ["homeStyle"], 4, { maximumClearlySpicyViolations: 3 }),
  positiveCase("随机回归｜和朋友一起吃 80元内 + 2km + 东北菜", {
    mealPurpose: "和朋友一起吃",
    branchPreference: "东北菜",
    budget: "80元内",
    distance: "2公里以内"
  }, ["northeastFood"], 3, { allowDataThinPass: true })
];

positivePreferenceCases.push(...fixedRandomRegressionCases, ...spicyPositivePreferenceCases);

function caseSpec(label, input) {
  const request = {
    slots: {
      mealPurpose: input.mealPurpose,
      branchPreference: input.branchPreference ?? "",
      budget: input.budget,
      distance: input.distance,
      userNotes: input.userNotes ?? ""
    },
    preferences: {
      tasteTags: input.tasteTags ?? [],
      needTags: input.needTags ?? [],
      temporaryAvoidTags: input.temporaryAvoidTags ?? [],
      avoidTags: input.avoidTags ?? [],
      spicyLevel: input.spicyLevel ?? ""
    },
    decisionSheet: input.decisionSheet,
    memoryProfile: input.memoryProfile,
    requestContext: input.requestContext
  };

  return {
    label,
    request,
    dimensions: {
      mealPurpose: input.mealPurpose,
      budget: input.budget,
      distance: input.distance,
      branchPreference: input.branchPreference || "(无)",
      tasteTags: joinDimension(input.tasteTags),
      needTags: joinDimension(input.needTags),
      temporaryAvoidTags: joinDimension(input.temporaryAvoidTags),
      avoidTags: joinDimension(input.avoidTags),
      spicyLevel: input.spicyLevel || "(无)"
    }
  };
}

function positiveCase(label, input, expectedIntents, threshold, options = {}) {
  return {
    ...caseSpec(label, input),
    expectedIntents,
    threshold,
    ...options
  };
}

function withCoverageGroup(items, coverageGroup) {
  return items.map((item) => ({
    ...item,
    coverageGroup
  }));
}

function coverageCaseKey(item) {
  return JSON.stringify(item.request);
}

function pushGeneratedCase(result, seen, coverageGroup, label, input) {
  const item = {
    ...caseSpec(label, input),
    coverageGroup
  };
  const key = coverageCaseKey(item);

  if (seen.has(key)) return false;

  seen.add(key);
  result.push(item);
  return true;
}

function buildExhaustiveNormalCoverageCases(seedCases, targetCount) {
  const seen = new Set(seedCases.map(coverageCaseKey));
  const result = [];
  const budgets = ["30元内", "60元内", "80元内"];
  const distances = ["500米以内", "1公里以内", "1.5公里以内"];
  const mealProfiles = [
    {
      mealPurpose: "早餐",
      templates: [
        { branchPreference: "包子/点心" },
        { branchPreference: "粥", tasteTags: ["清淡"] },
        { branchPreference: "面条/粉" },
        { branchPreference: "豆浆" },
        { needTags: ["快一点"] },
        { tasteTags: ["清淡"] },
        { branchPreference: "简餐 / 快餐", needTags: ["快一点"] },
        { branchPreference: "粉面", needTags: ["热乎"] }
      ]
    },
    {
      mealPurpose: "午餐",
      templates: [
        { branchPreference: "简餐 / 快餐" },
        { branchPreference: "粉面" },
        { branchPreference: "米饭套餐" },
        { branchPreference: "中式简餐" },
        { tasteTags: ["清淡"] },
        { needTags: ["快一点"] },
        { needTags: ["饱腹感强"] },
        { avoidTags: ["不吃辣"], spicyLevel: "不吃辣" },
        { temporaryAvoidTags: ["不想吃油炸"] },
        { branchPreference: "家常菜", needTags: ["下饭"] }
      ]
    },
    {
      mealPurpose: "晚餐",
      templates: [
        { branchPreference: "家常菜" },
        { branchPreference: "粉面" },
        { branchPreference: "火锅/冒菜" },
        { branchPreference: "简餐 / 快餐" },
        { tasteTags: ["清淡"] },
        { needTags: ["热乎"] },
        { needTags: ["汤汤水水"] },
        { needTags: ["解馋"] },
        { avoidTags: ["不要香菜"] },
        { temporaryAvoidTags: ["不想吃太辣"] }
      ]
    },
    {
      mealPurpose: "夜宵",
      templates: [
        { branchPreference: "粉面" },
        { branchPreference: "粥" },
        { branchPreference: "小吃" },
        { branchPreference: "甜品" },
        { needTags: ["热乎"] },
        { needTags: ["汤汤水水"] },
        { needTags: ["饱腹感强"] },
        { avoidTags: ["不吃辣"], spicyLevel: "不吃辣" }
      ]
    },
    {
      mealPurpose: "一个人随便吃",
      templates: [
        { branchPreference: "简餐 / 快餐" },
        { branchPreference: "粉面" },
        { branchPreference: "便宜一点" },
        { needTags: ["低预算"] },
        { needTags: ["快一点"] },
        { tasteTags: ["清淡"] },
        { needTags: ["不油腻"] },
        { temporaryAvoidTags: ["不想吃米饭"] }
      ]
    },
    {
      mealPurpose: "和朋友一起吃",
      templates: [
        { needTags: ["适合聊天"] },
        { needTags: ["适合朋友一起吃"] },
        { branchPreference: "家常菜" },
        { branchPreference: "西餐" },
        { branchPreference: "甜品" },
        { tasteTags: ["鲜香"] },
        { needTags: ["解馋"] },
        { avoidTags: ["不吃海鲜"] }
      ]
    },
    {
      mealPurpose: "工作日快餐",
      templates: [
        { branchPreference: "简餐 / 快餐" },
        { branchPreference: "米饭套餐" },
        { branchPreference: "粉面" },
        { needTags: ["快一点"] },
        { needTags: ["饱腹感强"] },
        { tasteTags: ["清淡"] },
        { temporaryAvoidTags: ["不想吃油炸"] },
        { avoidTags: ["不要葱蒜"] }
      ]
    },
    {
      mealPurpose: "周末放松吃",
      templates: [
        { needTags: ["适合聊天"] },
        { needTags: ["周末放松"] },
        { branchPreference: "西餐" },
        { branchPreference: "甜品" },
        { branchPreference: "咖啡" },
        { branchPreference: "家常菜" },
        { tasteTags: ["鲜香"] },
        { needTags: ["解馋"] }
      ]
    }
  ];

  for (const distance of distances) {
    for (const budget of budgets) {
      for (const profile of mealProfiles) {
        for (const template of profile.templates) {
          pushGeneratedCase(
            result,
            seen,
            "exhaustive_normal",
            `穷举｜${profile.mealPurpose} + ${budget} + ${distance} + ${describeGeneratedTemplate(template)}`,
            {
              mealPurpose: profile.mealPurpose,
              budget,
              distance,
              ...template
            }
          );

          if (result.length >= targetCount) {
            return result;
          }
        }
      }
    }
  }

  throw new Error(`Unable to build ${targetCount} exhaustive normal coverage cases; only generated ${result.length}.`);
}

function buildExtremeCoverageCases(seedCases, targetCount) {
  const seen = new Set(seedCases.map(coverageCaseKey));
  const result = [];
  const definitions = [
    { mealPurpose: "早餐", budget: "10元内", distance: "300米以内", tasteTags: ["清淡"] },
    { mealPurpose: "早餐", budget: "10元内", distance: "500米以内", needTags: ["热乎"] },
    { mealPurpose: "早餐", budget: "15元内", distance: "300米以内", branchPreference: "包子/点心" },
    { mealPurpose: "早餐", budget: "15元内", distance: "500米以内", branchPreference: "粥" },
    { mealPurpose: "午餐", budget: "20元内", distance: "300米以内", needTags: ["快一点"] },
    { mealPurpose: "午餐", budget: "20元内", distance: "500米以内", avoidTags: ["不吃辣"], spicyLevel: "不吃辣" },
    { mealPurpose: "午餐", budget: "20元内", distance: "1公里以内", branchPreference: "粉面" },
    { mealPurpose: "午餐", budget: "30元内", distance: "300米以内", temporaryAvoidTags: ["不想吃油炸"] },
    { mealPurpose: "晚餐", budget: "30元内", distance: "300米以内", needTags: ["热乎"] },
    { mealPurpose: "晚餐", budget: "30元内", distance: "500米以内", tasteTags: ["清淡"] },
    { mealPurpose: "晚餐", budget: "40元内", distance: "300米以内", avoidTags: ["不要香菜"] },
    { mealPurpose: "晚餐", budget: "40元内", distance: "500米以内", temporaryAvoidTags: ["不想吃太辣"] },
    { mealPurpose: "夜宵", budget: "30元内", distance: "300米以内", needTags: ["汤汤水水"] },
    { mealPurpose: "夜宵", budget: "40元内", distance: "300米以内", avoidTags: ["不吃辣"], spicyLevel: "不吃辣" },
    { mealPurpose: "夜宵", budget: "40元内", distance: "500米以内", branchPreference: "粥" },
    { mealPurpose: "夜宵", budget: "50元内", distance: "500米以内", temporaryAvoidTags: ["不想吃重口"] },
    { mealPurpose: "一个人随便吃", budget: "15元内", distance: "300米以内", needTags: ["低预算"] },
    { mealPurpose: "一个人随便吃", budget: "20元内", distance: "300米以内", needTags: ["快一点"] },
    { mealPurpose: "一个人随便吃", budget: "20元内", distance: "500米以内", branchPreference: "简餐 / 快餐" },
    { mealPurpose: "工作日快餐", budget: "20元内", distance: "300米以内", needTags: ["快一点"] },
    { mealPurpose: "工作日快餐", budget: "20元内", distance: "500米以内", branchPreference: "米饭套餐" },
    { mealPurpose: "和朋友一起吃", budget: "40元内", distance: "500米以内", needTags: ["适合聊天"] },
    { mealPurpose: "周末放松吃", budget: "50元内", distance: "500米以内", needTags: ["适合聊天"] },
    { mealPurpose: "下午茶", budget: "20元内", distance: "300米以内", branchPreference: "奶茶" },
    { mealPurpose: "下午茶", budget: "20元内", distance: "500米以内", branchPreference: "咖啡" },
    { mealPurpose: "和朋友一起吃", budget: "50元内", distance: "500米以内", avoidTags: ["不要香菜"] },
    { mealPurpose: "周末放松吃", budget: "60元内", distance: "500米以内", temporaryAvoidTags: ["不想吃甜口"] }
  ];

  for (const input of definitions) {
    pushGeneratedCase(
      result,
      seen,
      "extreme",
      `极限｜${input.mealPurpose} + ${input.budget} + ${input.distance} + ${describeGeneratedTemplate(input)}`,
      input
    );

    if (result.length >= targetCount) {
      return result;
    }
  }

  throw new Error(`Unable to build ${targetCount} extreme coverage cases; only generated ${result.length}.`);
}

function describeGeneratedTemplate(template) {
  return [
    template.branchPreference,
    ...(template.tasteTags ?? []),
    ...(template.needTags ?? []),
    ...(template.avoidTags ?? []),
    ...(template.temporaryAvoidTags ?? []),
    template.spicyLevel
  ].filter(Boolean).join("/") || "基础";
}

function joinDimension(values) {
  return (values ?? []).length ? values.join("/") : "(无)";
}

function dedupeCases(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = coverageCaseKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(dataDir, relativePath), "utf8");
  return JSON.parse(raw);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(from, to) {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function readNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function budgetTolerance(budgetMax) {
  return Math.max(6, Math.round(budgetMax * 0.2));
}

function distanceTolerance(distanceMaxMeters) {
  return Math.max(80, Math.round(distanceMaxMeters * 0.15));
}

function extractBudgetMax(value) {
  const text = String(value || "").trim();

  if (!text || /(以上|起|不设限|不限|无所谓)/.test(text)) {
    return undefined;
  }

  const numbers = Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0])).filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) : undefined;
}

function extractDistanceMaxMeters(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text || /远一点|远点|都可以|不限|无所谓/.test(text)) {
    return undefined;
  }

  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:公里|km|千米)/i);
  if (kmMatch) {
    return Math.round(Number(kmMatch[1]) * 1000);
  }

  const meterMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:米|m)/i);
  if (meterMatch) {
    return Math.round(Number(meterMatch[1]));
  }

  return undefined;
}

function splitPreferenceTokens(value) {
  return String(value || "")
    .split(/[、,，/／;；|｜\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripNegativePrefix(value) {
  return value
    .trim()
    .replace(/^(这次)?(不想吃|不想要|不要|别来|避开|不能吃|不吃)/, "")
    .trim();
}

function buildCategoryPreferencePolicy(values) {
  const tokens = values.flatMap(splitPreferenceTokens);
  const allowedCategories = [];
  const blockedCategories = [];
  const preferredTerms = [];
  const allow = (categories, terms = []) => {
    allowedCategories.push(...categories);
    preferredTerms.push(...terms);
  };
  const block = (categories) => blockedCategories.push(...categories);

  tokens.forEach((token) => {
    const clean = stripNegativePrefix(token);

    if (!clean || /都可以|随便|没想法|不限/.test(clean)) return;

    if (/中式简餐|中餐简餐|中式|中餐/.test(clean)) {
      allow(["快餐", "粉面", "家常菜", "粤菜", "潮汕菜", "东北菜"], ["中式", "简餐", "饭", "粉", "面"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/粉面|面条|汤粉|云吞|小面|粥粉面/.test(clean)) {
      allow(["粉面"], ["粉", "面", "云吞", "汤粉"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品"]);
      return;
    }

    if (/米饭|套餐|盖饭|便当|快餐|简餐/.test(clean)) {
      allow(["快餐", "家常菜", "粤菜", "潮汕菜", "东北菜"], ["饭", "套餐", "便当", "简餐"]);
      block(["咖啡", "奶茶", "甜品"]);
      return;
    }

    if (/家常菜|下饭|炒菜/.test(clean)) {
      allow(["家常菜", "快餐", "粤菜", "潮汕菜", "东北菜"], ["家常菜", "下饭", "炒菜", "套餐", "米饭", "汤饭"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/新疆菜|新疆|大盘鸡|手抓饭|新疆拌面|羊肉串|烤馕|馕/.test(clean)) {
      allow(["新疆菜"], ["新疆菜", "新疆", "大盘鸡", "手抓饭", "新疆拌面", "羊肉串", "烤馕", "馕"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/东北菜|东北|铁锅炖|锅包肉|地三鲜|东北大拉皮/.test(clean)) {
      allow(["东北菜"], ["东北菜", "东北", "铁锅炖", "锅包肉", "地三鲜", "东北大拉皮"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/粤菜|广式|烧腊|肠粉|茶餐厅|煲仔饭|老广|鸡煲/.test(clean)) {
      allow(["粤菜", "潮汕菜"], ["粤菜", "广式", "烧腊", "肠粉", "茶餐厅", "煲仔饭", "老广", "鸡煲"]);
      return;
    }

    if (/轻食|沙拉|减脂|低脂/.test(clean)) {
      allow(["轻食"], ["轻食", "沙拉", "清淡", "低脂"]);
      block(["火锅", "烧烤", "川湘菜", "新疆菜"]);
      return;
    }

    if (/西餐|披萨|意面|牛排/.test(clean)) {
      allow(["西餐"], ["西餐", "披萨", "意面", "牛排"]);
      return;
    }

    if (/日料|寿司|咖喱饭|日式/.test(clean)) {
      allow(["日料"], ["日料", "寿司", "日式"]);
      return;
    }

    if (/韩餐|韩式|年糕|部队锅/.test(clean)) {
      allow(["韩餐"], ["韩餐", "韩式"]);
      return;
    }

    if (/川湘|川菜|湘菜|香辣|麻辣|辣味|干锅|小炒/.test(clean)) {
      allow(["川湘菜", "家常菜"], ["川湘", "川菜", "湘菜", "香辣", "麻辣", "干锅", "小炒", "下饭"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/火锅|冒菜|麻辣烫/.test(clean)) {
      allow(["火锅", "川湘菜"], ["火锅", "冒菜", "麻辣烫"]);
      block(["咖啡", "奶茶", "甜品", "轻食"]);
      return;
    }

    if (/烧烤|烤串|炸物|炸鸡/.test(clean)) {
      allow(["烧烤", "快餐"], ["烧烤", "烤", "炸"]);
      return;
    }

    if (/奶茶|茶饮/.test(clean)) {
      allow(["奶茶"], ["奶茶", "茶饮"]);
      return;
    }

    if (/咖啡/.test(clean)) {
      allow(["咖啡"], ["咖啡"]);
      return;
    }

    if (/甜品|糖水/.test(clean)) {
      allow(["甜品"], ["甜品", "糖水"]);
    }
  });

  return {
    allowedCategories: uniqueStrings(allowedCategories),
    blockedCategories: uniqueStrings(blockedCategories),
    preferredTerms: uniqueStrings(preferredTerms)
  };
}

function buildTemporaryAvoidPolicy(values) {
  const blockedCategories = [];
  const avoidTerms = [];
  const block = (categories, terms = []) => {
    blockedCategories.push(...categories);
    avoidTerms.push(...terms);
  };

  values.flatMap(splitPreferenceTokens).forEach((token) => {
    const clean = stripNegativePrefix(token);

    if (!clean || /没有忌口|无忌口|都可以/.test(clean)) return;

    if (/油炸|炸物|炸鸡|薯条/.test(clean)) {
      block([], ["油炸", "炸物", "炸鸡", "薯条", "炸"]);
      return;
    }

    if (/太辣|重口|麻辣|香辣|辣/.test(clean)) {
      block(["川湘菜", "火锅", "烧烤"], ["麻辣", "香辣", "重辣", "中辣", "重口"]);
      return;
    }

    if (/米饭|饭|盖饭|便当|焗饭|炒饭|抓饭|套餐饭/.test(clean)) {
      block([], ["米饭", "盖饭", "便当", "焗饭", "炒饭", "抓饭", "套餐饭", "饭"]);
      return;
    }

    if (/汤粉|汤面|粉面|面条|面|云吞/.test(clean)) {
      block(["粉面"], ["汤粉", "汤面", "粉面", "面条", "云吞面", "小面"]);
      return;
    }

    if (/甜口|甜品|糖水|奶茶/.test(clean)) {
      block(["甜品", "奶茶"], ["甜", "糖水", "奶茶"]);
      return;
    }

    if (/冷食|沙拉/.test(clean)) {
      block(["轻食"], ["沙拉", "冷食"]);
      return;
    }

    if (/西餐|披萨|意面|牛排/.test(clean)) {
      block(["西餐"], ["西餐", "披萨", "意面", "牛排"]);
      return;
    }

    if (/日料|寿司|日式/.test(clean)) {
      block(["日料"], ["日料", "寿司", "日式"]);
      return;
    }

    if (/韩餐|韩式/.test(clean)) {
      block(["韩餐"], ["韩餐", "韩式"]);
      return;
    }

    avoidTerms.push(clean);
  });

  return {
    blockedCategories: uniqueStrings(blockedCategories),
    avoidTerms: uniqueStrings(avoidTerms)
  };
}

function buildHardFoodFilterPolicy(request) {
  const stableFoodPreferences = request.memoryProfile?.stableFoodPreferences;
  const adjustment = request.requestContext?.adjustment;
  const hardDynamicDimensions = (request.decisionSheet?.dynamic ?? []).filter((dimension) => dimension.hard === true);
  const categoryPolicy = buildCategoryPreferencePolicy([
    request.slots.branchPreference,
    ...hardDynamicDimensions.map((dimension) => dimension.value)
  ]);
  const temporaryAvoidPolicy = buildTemporaryAvoidPolicy(request.preferences.temporaryAvoidTags);
  const adjustmentAvoidPolicy = buildTemporaryAvoidPolicy([
    ...(adjustment?.avoidCategories ?? []),
    ...(adjustment?.types ?? []).filter((item) => /^不想|^不要|^避开/.test(item))
  ]);
  const rawAvoidTerms = uniqueStrings([
    ...request.preferences.avoidTags,
    ...request.preferences.temporaryAvoidTags,
    ...(stableFoodPreferences?.avoidTags ?? [])
  ]);
  const spicyText = [
    request.preferences.spicyLevel,
    stableFoodPreferences?.spicyLevel,
    ...rawAvoidTerms,
    ...temporaryAvoidPolicy.avoidTerms
  ].join(" ");

  return {
    budgetMax: extractBudgetMax(request.slots.budget),
    distanceMaxMeters: extractDistanceMaxMeters(request.slots.distance),
    noSpicy: /(不吃辣|不要辣|忌辣|不能吃辣|无辣|不想吃太辣|不想吃重口|重口|no.?spicy|non.?spicy)/i.test(spicyText),
    allowedCategories: categoryPolicy.allowedCategories,
    blockedCategories: uniqueStrings([
      ...categoryPolicy.blockedCategories,
      ...temporaryAvoidPolicy.blockedCategories,
      ...adjustmentAvoidPolicy.blockedCategories
    ]),
    preferredTerms: categoryPolicy.preferredTerms,
    avoidTerms: uniqueStrings([
      ...rawAvoidTerms.filter((term) => {
        return term.length >= 2 && !/(不吃辣|不要辣|忌辣|不能吃辣|无辣|辣度)/i.test(term);
      }),
      ...temporaryAvoidPolicy.avoidTerms,
      ...adjustmentAvoidPolicy.avoidTerms
    ]),
    avoidCategories: uniqueStrings([
      ...(adjustment?.avoidCategories ?? []),
      ...(adjustment?.types ?? []).filter((item) => /^不想|^不要|^避开/.test(item))
    ]),
    temporaryAvoidTags: request.preferences.temporaryAvoidTags,
    hardDynamicTerms: hardDynamicDimensions
      .flatMap((dimension) => splitPreferenceTokens(dimension.value))
      .filter((term) => /^不想|^不要|^避开|^不能/.test(term))
  };
}

function getShopDistanceCenter(shop, regions) {
  const region = regions.find((item) => item.id === shop.regionId) ?? regions.find((item) => item.id === "guangzhou_university_town");
  return region?.center;
}

function getShopDistanceInfo(shop, regions) {
  const center = getShopDistanceCenter(shop, regions);

  if (!center) {
    return {
      distanceMeters: undefined,
      walkMinutes: undefined
    };
  }

  const km = distanceKm(center, { latitude: shop.latitude, longitude: shop.longitude });
  const distanceMeters = Math.max(1, Math.round(km * 1000));

  return {
    distanceMeters,
    walkMinutes: Math.max(1, Math.round(distanceMeters / 80))
  };
}

function buildFoodCandidateSearchText(shop, features, dishes) {
  return [
    shop.name,
    shop.category,
    ...(shop.cuisines ?? []),
    ...shop.tags,
    ...(features?.featureTags ?? []),
    ...(features?.tasteTags ?? []),
    ...(features?.sceneTags ?? []),
    ...(features?.avoidTags ?? []),
    ...dishes.flatMap((dish) => [dish.name, dish.category, ...dish.tags])
  ].join(" ").toLowerCase();
}

function candidateTextIncludes(text, term) {
  return text.includes(term.trim().toLowerCase());
}

function isClearlySpicyCandidate(text, features) {
  if (features?.supportsNonSpicy === false) {
    return true;
  }

  const nonSpicyAvailable = /(不辣可选|不辣|无辣|清淡|non_spicy|non-spicy|no spicy)/i.test(text);
  const highSpice = /(麻辣|香辣|重辣|中辣|川菜|湘菜|火锅|冒菜|串串|烤鱼|酸辣粉|螺蛳粉|mala|hotpot|sichuan|hunan)/i.test(text);

  return highSpice && !nonSpicyAvailable;
}

function collectFoodCandidateHardViolations(shop, data, hardFilter, text, features) {
  const violations = [];

  if (hardFilter.budgetMax && shop.avgPrice !== null && shop.avgPrice > hardFilter.budgetMax + budgetTolerance(hardFilter.budgetMax)) {
    violations.push("budget");
  }

  if (hardFilter.distanceMaxMeters) {
    const distance = getShopDistanceInfo(shop, data.regions);
    if (distance.distanceMeters !== undefined && distance.distanceMeters > hardFilter.distanceMaxMeters + distanceTolerance(hardFilter.distanceMaxMeters)) {
      violations.push("distance");
    }
  }

  if (hardFilter.noSpicy && isClearlySpicyCandidate(text, features)) {
    violations.push("spicy");
  }

  if (hardFilter.blockedCategories.includes(shop.category)) {
    violations.push("blocked_category");
  }

  if (hardFilter.avoidCategories.some((term) => candidateTextIncludes(text, term))) {
    violations.push("avoid_category");
  }

  if (hardFilter.avoidTerms.some((term) => candidateTextIncludes(text, term))) {
    violations.push("avoid_term");
  }

  if (hardFilter.hardDynamicTerms.some((term) => candidateTextIncludes(text, stripNegativePrefix(term)))) {
    violations.push("dynamic_hard");
  }

  return violations;
}

function isStrictFoodCandidateMatch(shop, text, hardFilter) {
  const hasAllowedCategory = hardFilter.allowedCategories.length > 0;
  const hasPreferredTerms = hardFilter.preferredTerms.length > 0;

  if (!hasAllowedCategory && !hasPreferredTerms) {
    return true;
  }

  const categoryMatched = !hasAllowedCategory || hardFilter.allowedCategories.includes(shop.category);
  const termMatched = !hasPreferredTerms || hardFilter.preferredTerms.some((term) => candidateTextIncludes(text, term));

  return categoryMatched && (termMatched || !hasPreferredTerms);
}

function scoreFoodCandidate(shop, data, hardFilter, text, strictMatch) {
  const features = data.featuresByShopId.get(shop.id);
  const sceneFit = data.sceneFitByShopId.get(shop.id);
  const distance = getShopDistanceInfo(shop, data.regions);
  let score = strictMatch ? 100 : 40;

  if (hardFilter.allowedCategories.includes(shop.category)) {
    score += 42;
  }

  score += hardFilter.preferredTerms.filter((term) => candidateTextIncludes(text, term)).length * 10;

  if (shop.source === "manual_sample" || shop.source === "manual_public_curated") {
    score += 12;
  }

  if (shop.avgPrice !== null) {
    score += Math.max(0, 18 - Math.round(shop.avgPrice / 8));
  }

  if (hardFilter.budgetMax && shop.avgPrice !== null && shop.avgPrice <= hardFilter.budgetMax) {
    score += 18;
  }

  if (distance.distanceMeters !== undefined) {
    score += Math.max(0, 18 - Math.round(distance.distanceMeters / 120));
  }

  if (hardFilter.distanceMaxMeters && distance.distanceMeters !== undefined && distance.distanceMeters <= hardFilter.distanceMaxMeters) {
    score += 14;
  }

  if (features?.soloFriendly) {
    score += 8;
  }

  if (features?.queueRisk === "low") {
    score += 6;
  }

  score += Math.round(((sceneFit?.sceneScores.soloToday ?? 50) - 50) * 0.25);

  return score;
}

function buildPositiveFoodPreferencePolicy(request, hardFilter) {
  const softDynamicDimensions = (request.decisionSheet?.dynamic ?? []).filter((dimension) => dimension.hard !== true);
  const tokens = uniqueStrings([
    request.slots.mealPurpose,
    request.slots.branchPreference,
    ...request.preferences.tasteTags,
    ...request.preferences.needTags,
    ...softDynamicDimensions.map((dimension) => dimension.value)
  ].flatMap(splitPreferenceTokens).map(stripNegativePrefix))
    .filter((token) => token && !/都可以|随便|没想法|不限|无所谓|没有补充/.test(token));
  const text = tokens.join(" ");
  const intents = [];
  const addIntent = (intent, pattern) => {
    if (pattern.test(text)) {
      intents.push(intent);
    }
  };

  addIntent("noodles", /粉面|面条|汤粉|汤面|云吞|小面|粥粉面|米粉|河粉/);
  addIntent("fastMeal", /简餐|快餐|米饭|套餐|盖饭|便当|中式简餐/);
  addIntent("light", /清淡|平淡|不辣可选|少油|轻食|轻负担/);
  addIntent("lowOil", /不油腻|少油|低脂|减脂|轻负担|沙拉/);
  addIntent("warm", /热乎|热汤|热饮|热食|暖|温热/);
  addIntent("soupy", /汤汤水水|汤水|喝汤|汤粉|汤面|粥|云吞|糖水|汤饭/);
  addIntent("quick", /快一点|快点|快取|赶时间|不能排队|排队少|很饿要快|近一点/);
  addIntent("filling", /饱腹|管饱|下饭|很饿|饭量|顶饿/);
  addIntent("crave", /解馋|犒劳|重口|烧烤|烤串|火锅|炸物|炸鸡|麻辣烫|冒菜/);
  addIntent("xinjiangFood", /新疆菜|新疆|大盘鸡|手抓饭|新疆拌面|羊肉串|烤馕|馕/);
  addIntent("northeastFood", /东北菜|东北|铁锅炖|锅包肉|地三鲜|东北大拉皮/);
  addIntent("homeStyle", /家常菜|家常|下饭|炒菜|汤饭/);
  addIntent("cantoneseFood", /粤菜|广式|烧腊|肠粉|茶餐厅|煲仔饭|老广|鸡煲/);
  addIntent("japaneseFood", /日料|寿司|咖喱饭|日式|拉面|鳗鱼|和食/);
  addIntent("koreanFood", /韩餐|韩式|年糕|部队锅|拌饭|炸鸡/);
  addIntent("milkTea", /奶茶|茶饮|果茶|水果茶|柠檬茶/);
  addIntent("coffee", /咖啡|拿铁|美式|冷萃|摩卡/);
  addIntent("dessert", /甜品|糖水|蛋糕|布丁|芋圆|甜汤/);
  addIntent("lightFood", /轻食|沙拉|减脂|低脂|低卡/);
  addIntent("refreshing", /爽口|清爽/);
  addIntent("richTaste", /浓郁|咖喱|芝士|奶香|浓汤|酱香/);
  addIntent("sweetSour", /酸甜|糖醋|番茄|酸梅/);
  addIntent("freshSavory", /鲜香|鲜味|鲜美|菌汤|鸡汤/);
  addIntent("saltySavory", /咸香|卤味|烧腊|酱香|下饭/);
  if (!hardFilter.noSpicy) {
    addIntent("spicy", /想吃辣|辣一点|辣味|微辣|中辣|重辣|香辣|麻辣|川菜|湘菜|川湘|川味|湘味|重口|干锅|小炒|烧烤|烤串|火锅|冒菜|麻辣烫|串串|烤鱼|酸辣粉|螺蛳粉/);
    addIntent("mildSpicy", /微辣|小辣|辣一点|辣度可调|可选辣/);
    addIntent("mala", /麻辣|香辣|麻辣烫|冒菜|串串|烤鱼|酸辣粉|螺蛳粉/);
    addIntent("heavyTaste", /中辣|重辣|重口|重口味|干锅|小炒|下饭|香辣|麻辣|烧烤|烤串/);
    addIntent("sichuanHunan", /川湘|川菜|湘菜|川味|湘味/);
  }
  addIntent("chat", /适合聊天|聊天|安静|坐会|坐一会|慢慢聊|停留/);
  addIntent("group", /朋友|一起吃|多人|约饭|聚餐|和朋友一起吃/);
  addIntent("workdayFast", /工作日快餐|上班|上课|赶时间/);
  addIntent("weekend", /周末|放松|慢慢吃|想轻松坐会/);
  addIntent("breakfast", /早餐|早饭|早点|早上/);
  addIntent("lateNight", /夜宵|宵夜|深夜/);
  addIntent("lowBudget", /低预算|便宜|省钱|实惠|学生预算|便宜一点/);
  addIntent("nearby", /距离近|附近|就近|近一点|500米/);

  if (request.slots.mealPurpose === "和朋友一起吃") intents.push("group", "chat");
  if (request.slots.mealPurpose === "工作日快餐") intents.push("workdayFast", "quick", "fastMeal");
  if (request.slots.mealPurpose === "周末放松吃") intents.push("weekend", "chat");
  if (request.slots.mealPurpose === "早餐") intents.push("breakfast", "quick");
  if (request.slots.mealPurpose === "夜宵") intents.push("lateNight", "warm");
  if (hardFilter.allowedCategories.includes("粉面")) intents.push("noodles");
  if (hardFilter.allowedCategories.includes("快餐")) intents.push("fastMeal");
  if (hardFilter.allowedCategories.includes("新疆菜")) intents.push("xinjiangFood");
  if (hardFilter.allowedCategories.includes("东北菜")) intents.push("northeastFood");
  if (hardFilter.allowedCategories.includes("家常菜")) intents.push("homeStyle");
  if (hardFilter.allowedCategories.includes("粤菜") || hardFilter.allowedCategories.includes("潮汕菜")) intents.push("cantoneseFood");
  if (hardFilter.allowedCategories.includes("日料")) intents.push("japaneseFood");
  if (hardFilter.allowedCategories.includes("韩餐")) intents.push("koreanFood");
  if (hardFilter.allowedCategories.includes("奶茶")) intents.push("milkTea");
  if (hardFilter.allowedCategories.includes("咖啡")) intents.push("coffee");
  if (hardFilter.allowedCategories.includes("甜品")) intents.push("dessert");
  if (hardFilter.allowedCategories.includes("轻食")) intents.push("lightFood", "light", "lowOil");
  if (!hardFilter.noSpicy) {
    if (hardFilter.allowedCategories.includes("川湘菜")) intents.push("sichuanHunan", "spicy");
    if (hardFilter.allowedCategories.includes("火锅")) intents.push("spicy", "mala", "heavyTaste");
    if (hardFilter.allowedCategories.includes("烧烤")) intents.push("spicy", "heavyTaste");
  }

  const uniqueIntents = uniqueStrings(intents);

  return {
    tokens,
    intents: uniqueIntents,
    scene: inferPositiveFoodScene(uniqueIntents),
    hasExplicitIntent: uniqueIntents.length > 0,
    noSpicy: hardFilter.noSpicy
  };
}

function inferPositiveFoodScene(intents) {
  if (intents.includes("group") || intents.includes("chat")) return "groupMeetup";
  if (intents.includes("weekend")) return "weekendPlan";
  if (intents.includes("quick") || intents.includes("workdayFast") || intents.includes("breakfast")) return "soloToday";
  return undefined;
}

function scorePositiveFoodCandidate(shop, data, policy, hardText) {
  if (!policy.hasExplicitIntent) {
    return { score: 0, anchorScore: 0, reasons: [] };
  }

  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const sceneFit = data.sceneFitByShopId.get(shop.id);
  const distance = getShopDistanceInfo(shop, data.regions);
  const text = buildPositiveFoodCandidateSearchText(shop, features, dishes, sceneFit, hardText);
  let score = 0;
  let anchorScore = 0;
  const reasons = [];
  const hasIntent = (intent) => policy.intents.includes(intent);
  const add = (condition, points, reason) => {
    if (!condition) return;
    score += points;
    reasons.push(reason);
  };
  const addAnchor = (condition, points, reason) => {
    if (!condition) return;
    anchorScore += points;
    reasons.push(reason);
  };
  const addText = (terms, pointsPerMatch, maxPoints, reason) => {
    const matches = countCandidateTextMatches(text, terms);
    if (!matches) return;
    score += Math.min(maxPoints, matches * pointsPerMatch);
    reasons.push(reason);
  };
  const addSceneScore = (scene, maxPoints, reason) => {
    const sceneScore = sceneFit?.sceneScores?.[scene];
    if (sceneScore === undefined) return;
    const points = Math.max(0, Math.min(maxPoints, Math.round((sceneScore - 50) * 0.35)));
    if (points <= 0) return;
    score += points;
    reasons.push(reason);
  };
  const canScoreSpicy = !policy.noSpicy;
  const spicyCategories = ["川湘菜", "火锅", "烧烤"];
  const spicyTerms = [
    "香辣",
    "麻辣",
    "微辣",
    "中辣",
    "重辣",
    "辣味",
    "川湘",
    "川菜",
    "湘菜",
    "川味",
    "湘味",
    "火锅",
    "冒菜",
    "麻辣烫",
    "串串",
    "烤鱼",
    "烧烤",
    "烤串",
    "酸辣粉",
    "螺蛳粉",
    "干锅",
    "小炒",
    "重口味"
  ];
  const mildSpicyTerms = ["微辣", "小辣", "辣一点", "辣度可调", "可选辣"];
  const malaTerms = ["麻辣", "香辣", "麻辣烫", "冒菜", "串串", "烤鱼", "酸辣粉", "螺蛳粉"];
  const heavyTasteTerms = ["中辣", "重辣", "重口", "重口味", "干锅", "小炒", "下饭", "香辣", "麻辣", "烧烤", "烤串"];
  const sichuanHunanTerms = ["川湘", "川菜", "湘菜", "川味", "湘味", "香辣", "麻辣", "小炒"];
  const scoreDirectCategory = (intent, categories, terms, reason, relatedCategories = []) => {
    if (!hasIntent(intent)) return;
    add(categories.includes(shop.category), 26, reason);
    add(relatedCategories.includes(shop.category), 10, reason);
    addText(terms, 5, 22, reason);
    addAnchor(categories.includes(shop.category) || candidateMatchesAny(text, terms), 10, `${reason}锚点`);
  };

  scoreDirectCategory("xinjiangFood", ["新疆菜"], ["新疆菜", "新疆", "大盘鸡", "手抓饭", "新疆拌面", "羊肉串", "烤馕", "馕", "孜然"], "新疆菜");
  scoreDirectCategory("northeastFood", ["东北菜"], ["东北菜", "东北", "铁锅炖", "锅包肉", "地三鲜", "东北大拉皮"], "东北菜");
  scoreDirectCategory("homeStyle", ["家常菜"], ["家常菜", "家常", "下饭", "炒菜", "小炒", "套餐", "米饭", "便当", "汤饭", "盖饭", "饭堂", "小灶"], "家常菜", ["快餐", "粤菜", "潮汕菜", "东北菜"]);
  scoreDirectCategory("cantoneseFood", ["粤菜", "潮汕菜"], ["粤菜", "广式", "烧腊", "肠粉", "茶餐厅", "煲仔饭", "老广", "鸡煲", "潮汕"], "粤菜");
  scoreDirectCategory("japaneseFood", ["日料"], ["日料", "寿司", "咖喱饭", "日式", "拉面", "鳗鱼", "和食"], "日料");
  scoreDirectCategory("koreanFood", ["韩餐"], ["韩餐", "韩式", "年糕", "部队锅", "拌饭", "炸鸡"], "韩餐");
  scoreDirectCategory("milkTea", ["奶茶"], ["奶茶", "茶饮", "果茶", "水果茶", "柠檬茶"], "奶茶");
  scoreDirectCategory("coffee", ["咖啡"], ["咖啡", "拿铁", "美式", "冷萃", "摩卡"], "咖啡");
  scoreDirectCategory("dessert", ["甜品"], ["甜品", "糖水", "蛋糕", "布丁", "芋圆", "甜汤"], "甜品");
  scoreDirectCategory("lightFood", ["轻食"], ["轻食", "沙拉", "低脂", "低卡", "减脂", "轻负担", "不油腻"], "轻食");

  if (hasIntent("refreshing")) {
    add(["轻食", "奶茶", "甜品"].includes(shop.category), 14, "爽口清爽");
    add(features?.supportsNonSpicy === true, 4, "清爽不辣");
    addText(["爽口", "清爽", "沙拉", "轻食", "清淡", "不油腻", "少油", "低脂", "低卡", "酸甜", "水果茶", "柠檬茶", "冷饮"], 5, 24, "爽口清爽");
    addAnchor(["轻食", "奶茶"].includes(shop.category) || candidateMatchesAny(text, ["爽口", "清爽", "沙拉", "水果茶", "柠檬茶"]), 10, "爽口锚点");
  }

  if (hasIntent("richTaste")) {
    add(["日料", "西餐", "火锅", "烧烤", "咖啡", "甜品"].includes(shop.category), 10, "浓郁");
    addText(["浓郁", "咖喱", "芝士", "奶香", "浓汤", "火锅", "烧烤", "重口味", "酱香", "牛排", "奶油", "摩卡"], 6, 24, "浓郁");
    addAnchor(candidateMatchesAny(text, ["咖喱", "芝士", "浓汤", "火锅", "酱香"]), 10, "浓郁锚点");
  }

  if (hasIntent("sweetSour")) {
    addText(["酸甜", "糖醋", "番茄", "酸梅", "水果茶", "柠檬茶"], 6, 22, "酸甜");
    addAnchor(candidateMatchesAny(text, ["酸甜", "糖醋", "番茄"]), 8, "酸甜锚点");
  }

  if (hasIntent("freshSavory")) {
    add(["粤菜", "潮汕菜", "粉面", "家常菜"].includes(shop.category), 8, "鲜香");
    addText(["鲜香", "鲜味", "鲜美", "菌汤", "鸡汤", "清汤", "云吞", "潮汕", "热汤"], 5, 20, "鲜香");
  }

  if (hasIntent("saltySavory")) {
    add(["粤菜", "家常菜", "快餐"].includes(shop.category), 8, "咸香");
    addText(["咸香", "卤味", "烧腊", "酱香", "下饭", "盖饭", "便当"], 5, 20, "咸香");
  }

  if (hasIntent("noodles")) {
    add(shop.category === "粉面", 24, "粉面");
    addText(["粉面", "面条", "汤粉", "汤面", "云吞", "小面", "粥粉面", "米粉", "河粉"], 5, 18, "粉面");
    addAnchor(shop.category === "粉面" || candidateMatchesAny(text, ["汤粉", "汤面", "云吞"]), 8, "粉面锚点");
  }

  if (hasIntent("fastMeal")) {
    add(shop.category === "快餐", 22, "简餐快餐");
    add(["家常菜", "粤菜", "潮汕菜", "东北菜", "粉面"].includes(shop.category), 8, "简餐快餐");
    addText(["简餐", "快餐", "套餐", "便当", "盖饭", "单人快吃", "工作日快餐"], 5, 18, "简餐快餐");
    add(features?.queueRisk === "low", 6, "出餐较快");
    addAnchor(shop.category === "快餐" || candidateMatchesAny(text, ["工作日快餐", "quick_meal"]), 8, "简餐锚点");
  }

  if (hasIntent("light")) {
    add(features?.supportsNonSpicy === true, 8, "清淡可选");
    add(shop.category === "轻食", 16, "清淡轻负担");
    addText(["清淡", "清淡可选", "不辣可选", "少油", "轻食", "沙拉", "粥"], 4, 18, "清淡");
    addAnchor(candidateMatchesAny(text, ["清淡可选", "不辣可选", "轻食"]), 8, "清淡锚点");
  }

  if (hasIntent("lowOil")) {
    add(shop.category === "轻食", 16, "不油腻");
    addText(["不油腻", "少油", "低脂", "减脂", "轻负担", "沙拉", "清淡"], 5, 18, "不油腻");
    addAnchor(candidateMatchesAny(text, ["低脂", "轻食", "清淡可选"]), 8, "轻负担锚点");
  }

  if (hasIntent("warm")) {
    add(["粉面", "快餐", "家常菜", "火锅"].includes(shop.category), 8, "热乎");
    addText(["热乎", "热汤", "热饮", "热食", "汤粉", "汤面", "粥", "砂锅", "汤饭"], 5, 20, "热乎");
    addAnchor(candidateMatchesAny(text, ["热乎", "热汤", "汤粉", "汤面", "粥"]), 8, "热乎锚点");
  }

  if (hasIntent("soupy")) {
    add(["粉面", "甜品", "家常菜"].includes(shop.category), 8, "汤汤水水");
    addText(["汤", "汤粉", "汤面", "粥", "云吞", "糖水", "汤饭"], 5, 22, "汤汤水水");
    addAnchor(candidateMatchesAny(text, ["汤粉", "汤面", "粥", "云吞", "汤饭"]), 10, "汤水锚点");
  }

  if (hasIntent("quick")) {
    add(features?.queueRisk === "low", 14, "快一点");
    add(features?.soloFriendly === true, 6, "单人快吃");
    add(shop.category === "快餐", 10, "快一点");
    add(distance.distanceMeters !== undefined && distance.distanceMeters <= 500, 6, "距离近");
    addText(["快一点", "快取", "单人快吃", "工作日快餐", "quick_meal", "排队少"], 5, 16, "快一点");
  }

  if (hasIntent("filling")) {
    add(["快餐", "粉面", "家常菜", "东北菜", "新疆菜"].includes(shop.category), 10, "饱腹感强");
    addText(["饱腹", "管饱", "下饭", "套餐", "盖饭", "饭", "粉", "面", "顶饿"], 4, 18, "饱腹感强");
  }

  if (hasIntent("crave")) {
    if (policy.noSpicy) {
      add(["快餐", "粉面", "家常菜", "东北菜", "新疆菜"].includes(shop.category), 10, "解馋");
      addText(["解馋", "饱腹", "管饱", "下饭", "套餐", "盖饭", "饭", "粉", "面", "热乎", "热汤", "汤饭"], 4, 20, "解馋");
    } else {
      add(["烧烤", "火锅", "川湘菜", "新疆菜", "韩餐"].includes(shop.category), 12, "解馋");
      addText(["解馋", "烧烤", "烤串", "火锅", "炸物", "炸鸡", "麻辣烫", "冒菜", "重口味"], 5, 20, "解馋");
    }
  }

  if (canScoreSpicy && hasIntent("spicy")) {
    add(spicyCategories.includes(shop.category), 18, "辣味");
    addText(spicyTerms, 5, 24, "辣味");
    add(features?.supportsNonSpicy === false, 6, "辣味明确");
    addAnchor(spicyCategories.includes(shop.category) || candidateMatchesAny(text, ["香辣", "麻辣", "川湘", "火锅", "烧烤", "干锅"]), 8, "辣味锚点");
  }

  if (canScoreSpicy && hasIntent("mildSpicy")) {
    addText(mildSpicyTerms, 7, 18, "微辣");
    add(features?.supportsNonSpicy === true && candidateMatchesAny(text, ["微辣", "辣度可调", "可选辣"]), 8, "微辣可选");
    add(spicyCategories.includes(shop.category) && !isClearlySpicyCandidate(text, features), 8, "微辣候选");
    addAnchor(candidateMatchesAny(text, ["微辣", "辣度可调", "可选辣"]), 8, "微辣锚点");
  }

  if (canScoreSpicy && hasIntent("mala")) {
    add(["川湘菜", "火锅"].includes(shop.category), 20, "麻辣香辣");
    addText(malaTerms, 6, 24, "麻辣香辣");
    addAnchor(["川湘菜", "火锅"].includes(shop.category) || candidateMatchesAny(text, ["麻辣", "香辣", "麻辣烫", "冒菜", "串串"]), 10, "麻辣锚点");
  }

  if (canScoreSpicy && hasIntent("heavyTaste")) {
    add(["川湘菜", "火锅", "烧烤"].includes(shop.category), 18, "重口下饭");
    addText(heavyTasteTerms, 6, 24, "重口下饭");
    addAnchor(["川湘菜", "烧烤"].includes(shop.category) || candidateMatchesAny(text, ["重口", "重辣", "中辣", "干锅", "小炒", "烤串"]), 10, "重口锚点");
  }

  if (canScoreSpicy && hasIntent("sichuanHunan")) {
    add(shop.category === "川湘菜", 24, "川湘");
    addText(sichuanHunanTerms, 6, 24, "川湘");
    addAnchor(shop.category === "川湘菜" || candidateMatchesAny(text, ["川湘", "川菜", "湘菜", "川味", "湘味"]), 12, "川湘锚点");
  }

  if (hasIntent("chat")) {
    add(features?.chatFriendly === true, 18, "适合聊天");
    add(features?.groupFriendly === true, 8, "多人友好");
    add(features?.noiseLevel === "low" || features?.noiseLevel === "medium", 6, "聊天环境");
    addSceneScore("groupMeetup", 14, "适合聊天");
    addText(["适合聊天", "朋友聊天", "chat_friendly", "安静", "坐会", "停留"], 5, 20, "适合聊天");
    addAnchor(features?.chatFriendly === true || candidateMatchesAny(text, ["适合聊天", "朋友聊天"]), 12, "聊天锚点");
  }

  if (hasIntent("group")) {
    add(features?.groupFriendly === true, 16, "和朋友一起吃");
    add(features?.chatFriendly === true, 8, "适合聊天");
    addSceneScore("groupMeetup", 14, "多人约饭");
    addText(["多人约饭", "朋友聊天", "group_friendly", "聚餐", "朋友"], 5, 18, "和朋友一起吃");
    addAnchor(features?.groupFriendly === true || candidateMatchesAny(text, ["多人约饭", "group_friendly"]), 10, "朋友聚餐锚点");
  }

  if (hasIntent("workdayFast")) {
    add(features?.queueRisk === "low", 14, "工作日快餐");
    add(features?.soloFriendly === true, 8, "单人快吃");
    add(["快餐", "粉面"].includes(shop.category), 10, "工作日快餐");
    addSceneScore("soloToday", 10, "工作日快餐");
    addText(["工作日快餐", "工作日简餐", "单人快吃", "quick_meal"], 5, 18, "工作日快餐");
  }

  if (hasIntent("weekend")) {
    addSceneScore("weekendPlan", 18, "周末放松");
    add(features?.chatFriendly === true, 10, "适合停留聊天");
    add(features?.rainyDayFriendly === true, 6, "室内放松");
    add(["咖啡", "甜品", "轻食", "西餐", "日料", "韩餐"].includes(shop.category), 8, "周末放松");
    addText(["周末规划", "周末", "放松", "朋友聊天", "适合聊天"], 5, 20, "周末放松");
    addAnchor(candidateMatchesAny(text, ["周末规划", "朋友聊天"]) || features?.chatFriendly === true, 10, "周末锚点");
  }

  if (hasIntent("breakfast")) {
    add(["快餐", "粉面", "咖啡", "轻食"].includes(shop.category), 8, "早餐");
    addText(["早餐", "包子", "点心", "豆浆", "粥", "肠粉", "早饭"], 5, 20, "早餐");
  }

  if (hasIntent("lateNight")) {
    add(["烧烤", "火锅", "粉面", "快餐", "甜品"].includes(shop.category), 8, "夜宵");
    addText(["夜宵", "宵夜", "深夜", "热乎", "烧烤", "粉面", "粥"], 5, 20, "夜宵");
  }

  if (hasIntent("lowBudget")) {
    add(shop.avgPrice !== null && shop.avgPrice <= 30, 14, "低预算");
    addText(["低预算", "20-30", "student_budget", "便宜", "实惠"], 5, 16, "低预算");
  }

  if (hasIntent("nearby")) {
    add(distance.distanceMeters !== undefined && distance.distanceMeters <= 500, 12, "距离近");
    add(distance.distanceMeters !== undefined && distance.distanceMeters > 500 && distance.distanceMeters <= 1000, 6, "距离近");
  }

  return {
    score: Math.min(90, score),
    anchorScore: Math.min(ANCHOR_BOOST_MAX, anchorScore),
    reasons: uniqueStrings(reasons).slice(0, 6)
  };
}

function buildPositiveFoodCandidateSearchText(shop, features, dishes, sceneFit, hardText) {
  return [
    hardText,
    ...(features?.crowdTags ?? []),
    ...(features?.goodFor ?? []),
    ...(features?.explainHints ?? []),
    ...(features?.riskHints ?? []),
    ...Object.values(sceneFit?.explainHints ?? {}).flat(),
    ...Object.values(sceneFit?.riskHints ?? {}).flat(),
    ...dishes.flatMap((dish) => [dish.description ?? ""])
  ].join(" ").toLowerCase();
}

function candidateMatchesAny(text, terms) {
  return terms.some((term) => candidateTextIncludes(text, term));
}

function countCandidateTextMatches(text, terms) {
  return uniqueStrings(terms).filter((term) => candidateTextIncludes(text, term)).length;
}

function orderFoodCandidateEvaluations(evaluations, hardFilter) {
  const strict = evaluations.filter((evaluation) => evaluation.strictMatch);
  const relaxed = evaluations.filter((evaluation) => !evaluation.strictMatch);
  const hasExplicitIntent = hardFilter.allowedCategories.length > 0 || hardFilter.preferredTerms.length > 0;

  return hasExplicitIntent
    ? [...sortCandidateEvaluations(strict), ...sortCandidateEvaluations(relaxed)]
    : sortCandidateEvaluations(roundRobinByCategoryEvaluation(evaluations));
}

function selectStrongPositiveMatches(evaluations, policy, limit) {
  const categoryCap = isNarrowPositivePolicy(policy) ? limit : 3;
  const categoryCounts = new Map();
  const result = [];

  for (const evaluation of sortCandidateEvaluations(evaluations).filter((item) => {
    return item.positiveScore + item.anchorScore >= STRONG_POSITIVE_MIN_SCORE;
  })) {
    const category = evaluation.shop.category || "other";
    const used = categoryCounts.get(category) ?? 0;

    if (used >= categoryCap) continue;

    result.push(evaluation);
    categoryCounts.set(category, used + 1);

    if (result.length >= limit) break;
  }

  return result;
}

function isNarrowPositivePolicy(policy) {
  return policy.intents.some((intent) => {
    return [
      "noodles",
      "fastMeal",
      "xinjiangFood",
      "northeastFood",
      "homeStyle",
      "cantoneseFood",
      "japaneseFood",
      "koreanFood",
      "milkTea",
      "coffee",
      "dessert",
      "lightFood"
    ].includes(intent);
  });
}

function mergeStrongAndFillerCandidates(strong, ordered, limit, policy) {
  const usedIds = new Set();
  const categoryCounts = new Map();
  const categoryCap = isNarrowPositivePolicy(policy) ? Math.min(8, limit) : Math.min(4, limit);
  const result = [];
  const add = (evaluation, enforceCategoryCap) => {
    if (usedIds.has(evaluation.shop.id) || result.length >= limit) return;
    const category = evaluation.shop.category || "other";
    const usedCategoryCount = categoryCounts.get(category) ?? 0;
    if (enforceCategoryCap && usedCategoryCount >= categoryCap) return;

    usedIds.add(evaluation.shop.id);
    categoryCounts.set(category, usedCategoryCount + 1);
    result.push(evaluation);
  };

  strong.forEach((evaluation) => add(evaluation, true));
  ordered.forEach((evaluation) => add(evaluation, true));

  if (result.length < limit) {
    ordered.forEach((evaluation) => add(evaluation, false));
  }

  return result;
}

function sortCandidateEvaluations(evaluations) {
  return evaluations.slice().sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.baseScore !== a.baseScore) {
      return b.baseScore - a.baseScore;
    }

    return a.shop.name.localeCompare(b.shop.name, "zh-Hans-CN");
  });
}

function roundRobinByCategoryEvaluation(evaluations) {
  const sourceOrder = ["manual_sample", "manual_public_curated", "synthetic_mvp"];
  const orderedBySource = [
    ...sourceOrder.flatMap((source) => evaluations.filter((evaluation) => evaluation.shop.source === source)),
    ...evaluations.filter((evaluation) => !sourceOrder.includes(evaluation.shop.source))
  ];
  const groups = new Map();

  for (const evaluation of orderedBySource) {
    const key = evaluation.shop.category || "other";
    groups.set(key, [...(groups.get(key) ?? []), evaluation]);
  }

  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const result = [];
  let index = 0;

  while (result.length < orderedBySource.length) {
    let added = false;

    for (const key of keys) {
      const item = (groups.get(key) ?? [])[index];

      if (item) {
        result.push(item);
        added = true;
      }
    }

    if (!added) break;
    index += 1;
  }

  return result;
}

function evaluateFoodCandidate(shop, data, hardFilter, positivePolicy) {
  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const text = buildFoodCandidateSearchText(shop, features, dishes);
  const hardViolations = collectFoodCandidateHardViolations(shop, data, hardFilter, text, features);
  const strictMatch = isStrictFoodCandidateMatch(shop, text, hardFilter);
  const baseScore = scoreFoodCandidate(shop, data, hardFilter, text, strictMatch);
  const positive = scorePositiveFoodCandidate(shop, data, positivePolicy, text);

  return {
    shop,
    text,
    strictMatch,
    hardAllowed: hardViolations.length === 0,
    hardViolations,
    baseScore,
    positiveScore: positive.score,
    anchorScore: positive.anchorScore,
    score: baseScore + positive.score + positive.anchorScore,
    positiveReasons: positive.reasons
  };
}

function buildLocalFoodCandidates(data, request, limit) {
  const hardFilter = buildHardFoodFilterPolicy(request);
  const positivePolicy = buildPositiveFoodPreferencePolicy(request, hardFilter);
  const excludedIds = new Set(request.requestContext?.excludeIds ?? []);
  const evaluations = data.shops
    .filter((shop) => !excludedIds.has(shop.id))
    .map((shop) => evaluateFoodCandidate(shop, data, hardFilter, positivePolicy));
  const allowed = evaluations.filter((evaluation) => evaluation.hardAllowed);
  const strict = allowed.filter((evaluation) => evaluation.strictMatch);
  const relaxed = allowed.filter((evaluation) => !evaluation.strictMatch);
  const ordered = orderFoodCandidateEvaluations(allowed, hardFilter);
  const candidateLimit = Math.max(MINIMUM_CANDIDATES, limit);
  const strong = positivePolicy.hasExplicitIntent
    ? selectStrongPositiveMatches(allowed, positivePolicy, Math.min(STRONG_POSITIVE_MATCH_LIMIT, candidateLimit))
    : [];
  const candidates = positivePolicy.hasExplicitIntent && strong.length >= 2
    ? mergeStrongAndFillerCandidates(strong, ordered, candidateLimit, positivePolicy)
    : ordered.slice(0, candidateLimit);

  return {
    candidates,
    allowed,
    strict,
    relaxed,
    evaluations,
    hardFilter,
    positivePolicy
  };
}

function countFailures(evaluations) {
  const counts = {};

  evaluations.forEach((evaluation) => {
    evaluation.hardViolations.forEach((violation) => {
      counts[violation] = (counts[violation] ?? 0) + 1;
    });
  });

  return counts;
}

function emptyCoverageStats() {
  return {
    total: 0,
    belowMinimum: 0,
    warning: 0,
    pass: 0,
    ideal: 0
  };
}

function addCoverageStats(stats, candidateCount) {
  stats.total += 1;

  if (candidateCount < MINIMUM_CANDIDATES) {
    stats.belowMinimum += 1;
  } else if (candidateCount < RECOMMENDED_CANDIDATES) {
    stats.warning += 1;
  } else {
    stats.pass += 1;
  }

  if (candidateCount >= IDEAL_CANDIDATES) {
    stats.ideal += 1;
  }
}

function buildCoverageGroupStats(results) {
  const stats = new Map();

  for (const result of results) {
    const group = result.coverageGroup ?? "official";
    const current = stats.get(group) ?? emptyCoverageStats();
    addCoverageStats(current, result.candidateCount);
    stats.set(group, current);
  }

  return stats;
}

function mergeCoverageStats(items) {
  const merged = emptyCoverageStats();

  for (const item of items) {
    addCoverageStats(merged, item.candidateCount);
  }

  return merged;
}

function formatCoverageStats(stats) {
  return `total=${stats.total}; <${MINIMUM_CANDIDATES}=${stats.belowMinimum}; ${MINIMUM_CANDIDATES}-${RECOMMENDED_CANDIDATES - 1}=${stats.warning}; >=${RECOMMENDED_CANDIDATES}=${stats.pass}; >=${IDEAL_CANDIDATES}=${stats.ideal}`;
}

function summarizePolicy(hardFilter) {
  return uniqueStrings([
    hardFilter.budgetMax ? `budget<=${hardFilter.budgetMax}+${budgetTolerance(hardFilter.budgetMax)}` : "",
    hardFilter.distanceMaxMeters ? `distance<=${hardFilter.distanceMaxMeters}+${distanceTolerance(hardFilter.distanceMaxMeters)}m` : "",
    hardFilter.noSpicy ? "no_spicy" : "",
    hardFilter.avoidTerms.length ? `avoid=${hardFilter.avoidTerms.join("/")}` : "",
    hardFilter.allowedCategories.length ? `categories=${hardFilter.allowedCategories.join("/")}` : "",
    hardFilter.blockedCategories.length ? `blocked=${hardFilter.blockedCategories.join("/")}` : "",
    hardFilter.hardDynamicTerms.length ? `dynamicHard=${hardFilter.hardDynamicTerms.join("/")}` : ""
  ]).join("; ");
}

function summarizeInput(request) {
  return uniqueStrings([
    request.slots.mealPurpose ? `餐段/场景=${request.slots.mealPurpose}` : "",
    request.slots.branchPreference ? `想吃=${request.slots.branchPreference}` : "",
    request.slots.budget ? `预算=${request.slots.budget}` : "",
    request.slots.distance ? `距离=${request.slots.distance}` : "",
    request.preferences.spicyLevel ? `辣度=${request.preferences.spicyLevel}` : "",
    request.preferences.avoidTags.length ? `忌口=${request.preferences.avoidTags.join("/")}` : "",
    request.preferences.tasteTags.length ? `taste=${request.preferences.tasteTags.join("/")}` : "",
    request.preferences.needTags.length ? `need=${request.preferences.needTags.join("/")}` : "",
    request.preferences.temporaryAvoidTags.length ? `这次不想吃=${request.preferences.temporaryAvoidTags.join("/")}` : ""
  ]).join("；");
}

function inferWeaknessReasons(item, result, failureCounts) {
  const reasons = [];
  const hardFilter = result.hardFilter;
  const sortedFailureCounts = Object.entries(failureCounts).sort((a, b) => b[1] - a[1]);
  const violationLabels = {
    distance: "距离过紧",
    budget: "预算偏低",
    spicy: "不吃辣/辣度过滤",
    blocked_category: "品类与临时避开冲突",
    avoid_category: "避开品类过滤",
    avoid_term: "忌口或临时避开命中文本",
    dynamic_hard: "动态硬条件过滤"
  };

  sortedFailureCounts.slice(0, 3).forEach(([key, value]) => {
    if (value > 0) {
      reasons.push(`${violationLabels[key] ?? key}(${value})`);
    }
  });

  if (hardFilter.distanceMaxMeters && hardFilter.distanceMaxMeters <= 500) {
    reasons.push("500m 半径数据密度敏感");
  }

  if (hardFilter.budgetMax && hardFilter.budgetMax <= 30) {
    reasons.push("低预算可选池敏感");
  }

  if ((hardFilter.allowedCategories.length || hardFilter.preferredTerms.length) && result.strict.length < RECOMMENDED_CANDIDATES) {
    reasons.push(`品类意图严格命中仅 ${result.strict.length} 家`);
  }

  if (item.request.slots.mealPurpose === "早餐" && result.candidates.length < RECOMMENDED_CANDIDATES) {
    reasons.push("早餐近距离数据不足");
  }

  if (item.request.preferences.temporaryAvoidTags.length && result.candidates.length < RECOMMENDED_CANDIDATES) {
    reasons.push("临时避开过滤后池子偏薄");
  }

  return uniqueStrings(reasons).join("；") || "暂无明显硬过滤瓶颈，主要是排序截断前候选密度偏薄";
}

function candidateRow(evaluation, index, data) {
  const distance = getShopDistanceInfo(evaluation.shop, data.regions);
  return `${index + 1}. ${evaluation.shop.name} / ${evaluation.shop.category} / ¥${evaluation.shop.avgPrice ?? "?"} / ${distance.distanceMeters ?? "?"}m`;
}

function positiveCandidateRow(evaluation, index, data, expectedIntents) {
  const marker = candidateHitsPositiveCase(evaluation, data, expectedIntents) ? "*" : " ";
  return `${marker} ${candidateRow(evaluation, index, data)} / positive=${evaluation.positiveScore}+${evaluation.anchorScore} / ${evaluation.positiveReasons.join("/") || "基础补位"}`;
}

function candidateHitsPositiveCase(evaluation, data, expectedIntents) {
  return expectedIntents.some((intent) => candidateHitsPositiveIntent(evaluation, data, intent));
}

function candidateClearlySpicy(evaluation, data) {
  const features = data.featuresByShopId.get(evaluation.shop.id);
  const dishes = data.dishesByShopId.get(evaluation.shop.id) ?? [];
  const text = buildFoodCandidateSearchText(evaluation.shop, features, dishes);

  return isClearlySpicyCandidate(text, features);
}

function candidateHitsPositiveIntent(evaluation, data, intent) {
  const shop = evaluation.shop;
  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const sceneFit = data.sceneFitByShopId.get(shop.id);
  const text = buildPositiveFoodCandidateSearchText(shop, features, dishes, sceneFit, evaluation.text);
  const has = (terms) => candidateMatchesAny(text, terms);

  if (intent === "noodles") {
    return shop.category === "粉面" || has(["粉面", "面条", "汤粉", "汤面", "云吞", "小面", "粥粉面", "米粉", "河粉"]);
  }

  if (intent === "fastMeal") {
    return shop.category === "快餐" || has(["简餐", "快餐", "套餐", "便当", "盖饭", "单人快吃", "工作日快餐", "quick_meal"]);
  }

  if (intent === "light") {
    return features?.supportsNonSpicy === true || shop.category === "轻食" || has(["清淡", "清淡可选", "不辣可选", "少油", "轻食", "沙拉", "粥"]);
  }

  if (intent === "lowOil") {
    return shop.category === "轻食" || has(["不油腻", "少油", "低脂", "减脂", "轻负担", "沙拉", "清淡"]);
  }

  if (intent === "warm") {
    return ["粉面", "快餐", "家常菜", "火锅"].includes(shop.category) || has(["热乎", "热汤", "热饮", "热食", "汤粉", "汤面", "粥", "砂锅", "汤饭"]);
  }

  if (intent === "soupy") {
    return ["粉面", "甜品", "家常菜"].includes(shop.category) || has(["汤", "汤粉", "汤面", "粥", "云吞", "糖水", "汤饭"]);
  }

  if (intent === "quick") {
    return features?.queueRisk === "low" || shop.category === "快餐" || has(["快一点", "快取", "单人快吃", "工作日快餐", "quick_meal", "排队少"]);
  }

  if (intent === "filling") {
    return ["快餐", "粉面", "家常菜", "东北菜", "新疆菜"].includes(shop.category) || has(["饱腹", "管饱", "下饭", "套餐", "盖饭", "饭", "粉", "面", "顶饿"]);
  }

  if (intent === "crave") {
    return ["烧烤", "火锅", "川湘菜", "新疆菜", "韩餐"].includes(shop.category) || has(["解馋", "烧烤", "烤串", "火锅", "炸物", "炸鸡", "麻辣烫", "冒菜", "重口味"]);
  }

  if (intent === "spicy") {
    return ["川湘菜", "火锅", "烧烤"].includes(shop.category) || has(["香辣", "麻辣", "微辣", "中辣", "重辣", "辣味", "川湘", "川菜", "湘菜", "川味", "湘味", "冒菜", "麻辣烫", "串串", "烤鱼", "酸辣粉", "螺蛳粉", "干锅", "小炒", "重口味"]);
  }

  if (intent === "mildSpicy") {
    return has(["微辣", "小辣", "辣一点", "辣度可调", "可选辣"]) || (!candidateClearlySpicy(evaluation, data) && candidateHitsPositiveIntent(evaluation, data, "spicy"));
  }

  if (intent === "mala") {
    return ["川湘菜", "火锅"].includes(shop.category) || has(["麻辣", "香辣", "麻辣烫", "冒菜", "串串", "烤鱼", "酸辣粉", "螺蛳粉"]);
  }

  if (intent === "heavyTaste") {
    return ["川湘菜", "火锅", "烧烤"].includes(shop.category) || has(["中辣", "重辣", "重口", "重口味", "干锅", "小炒", "下饭", "香辣", "麻辣", "烤串"]);
  }

  if (intent === "sichuanHunan") {
    return shop.category === "川湘菜" || has(["川湘", "川菜", "湘菜", "川味", "湘味", "香辣", "麻辣", "小炒"]);
  }

  if (intent === "xinjiangFood") {
    return shop.category === "新疆菜" || has(["新疆菜", "新疆", "大盘鸡", "手抓饭", "新疆拌面", "羊肉串", "烤馕", "馕", "孜然"]);
  }

  if (intent === "northeastFood") {
    return shop.category === "东北菜" || has(["东北菜", "东北", "铁锅炖", "锅包肉", "地三鲜", "东北大拉皮"]);
  }

  if (intent === "homeStyle") {
    return shop.category === "家常菜" || has(["家常菜", "家常", "下饭", "炒菜", "小炒", "套餐", "米饭", "便当", "汤饭", "盖饭", "饭堂", "小灶"]);
  }

  if (intent === "cantoneseFood") {
    return ["粤菜", "潮汕菜"].includes(shop.category) || has(["粤菜", "广式", "烧腊", "肠粉", "茶餐厅", "煲仔饭", "老广", "鸡煲", "潮汕"]);
  }

  if (intent === "japaneseFood") {
    return shop.category === "日料" || has(["日料", "寿司", "咖喱饭", "日式", "拉面", "鳗鱼", "和食"]);
  }

  if (intent === "koreanFood") {
    return shop.category === "韩餐" || has(["韩餐", "韩式", "年糕", "部队锅", "拌饭", "炸鸡"]);
  }

  if (intent === "milkTea") {
    return shop.category === "奶茶" || has(["奶茶", "茶饮", "果茶", "水果茶", "柠檬茶"]);
  }

  if (intent === "coffee") {
    return shop.category === "咖啡" || has(["咖啡", "拿铁", "美式", "冷萃", "摩卡"]);
  }

  if (intent === "dessert") {
    return shop.category === "甜品" || has(["甜品", "糖水", "蛋糕", "布丁", "芋圆", "甜汤"]);
  }

  if (intent === "lightFood") {
    return shop.category === "轻食" || has(["轻食", "沙拉", "低脂", "低卡", "减脂", "轻负担", "不油腻"]);
  }

  if (intent === "refreshing") {
    return ["轻食", "奶茶", "甜品"].includes(shop.category)
      || has(["爽口", "清爽", "沙拉", "轻食", "清淡", "不油腻", "少油", "低脂", "低卡", "酸甜", "水果茶", "柠檬茶", "冷饮"]);
  }

  if (intent === "richTaste") {
    return ["日料", "西餐", "火锅", "烧烤", "咖啡", "甜品"].includes(shop.category)
      || has(["浓郁", "咖喱", "芝士", "奶香", "浓汤", "火锅", "烧烤", "重口味", "酱香", "牛排", "奶油", "摩卡"]);
  }

  if (intent === "sweetSour") {
    return has(["酸甜", "糖醋", "番茄", "酸梅", "水果茶", "柠檬茶"]);
  }

  if (intent === "freshSavory") {
    return ["粤菜", "潮汕菜", "粉面", "家常菜"].includes(shop.category)
      || has(["鲜香", "鲜味", "鲜美", "菌汤", "鸡汤", "清汤", "云吞", "潮汕", "热汤"]);
  }

  if (intent === "saltySavory") {
    return ["粤菜", "家常菜", "快餐"].includes(shop.category)
      || has(["咸香", "卤味", "烧腊", "酱香", "下饭", "盖饭", "便当"]);
  }

  if (intent === "nonSpicyCrave") {
    return !candidateClearlySpicy(evaluation, data)
      && (["快餐", "粉面", "家常菜", "东北菜", "新疆菜"].includes(shop.category)
        || has(["解馋", "饱腹", "管饱", "下饭", "套餐", "盖饭", "热乎", "热汤", "汤饭"]));
  }

  if (intent === "chat") {
    return features?.chatFriendly === true || has(["适合聊天", "朋友聊天", "chat_friendly", "安静", "坐会", "停留"]);
  }

  if (intent === "group") {
    return features?.groupFriendly === true || has(["多人约饭", "朋友聊天", "group_friendly", "聚餐", "朋友"]);
  }

  if (intent === "workdayFast") {
    return features?.queueRisk === "low" || ["快餐", "粉面"].includes(shop.category) || has(["工作日快餐", "工作日简餐", "单人快吃", "quick_meal"]);
  }

  if (intent === "weekend") {
    return (sceneFit?.sceneScores?.weekendPlan ?? 0) >= 65 || features?.chatFriendly === true || has(["周末规划", "周末", "放松", "朋友聊天", "适合聊天"]);
  }

  if (intent === "breakfast") {
    return ["快餐", "粉面", "咖啡", "轻食"].includes(shop.category) || has(["早餐", "包子", "点心", "豆浆", "粥", "肠粉", "早饭"]);
  }

  if (intent === "lateNight") {
    return ["烧烤", "火锅", "粉面", "快餐", "甜品"].includes(shop.category) || has(["夜宵", "宵夜", "深夜", "热乎", "烧烤", "粉面", "粥"]);
  }

  if (intent === "lowBudget") {
    return (shop.avgPrice !== null && shop.avgPrice <= 30) || has(["低预算", "20-30", "student_budget", "便宜", "实惠"]);
  }

  if (intent === "nearby") {
    const distance = getShopDistanceInfo(shop, data.regions);
    return distance.distanceMeters !== undefined && distance.distanceMeters <= 1000;
  }

  return false;
}

function inferPositiveAuditFailureReasons(result, item, hitCount, allowedHitCount) {
  const reasons = [];

  if (result.allowed.length < item.threshold) {
    reasons.push(`硬过滤后候选仅 ${result.allowed.length} 家`);
  }

  if (allowedHitCount < item.threshold) {
    reasons.push(`硬过滤后正向可命中仅 ${allowedHitCount} 家，可能需要补特征或数据`);
  } else if (hitCount < item.threshold) {
    reasons.push(`正向候选足够但 top12 截断前排序仍不足，需调高 soft score`);
  }

  const strongCount = result.allowed.filter((evaluation) => {
    return evaluation.positiveScore + evaluation.anchorScore >= STRONG_POSITIVE_MIN_SCORE;
  }).length;

  if (strongCount < item.threshold) {
    reasons.push(`strong positive matches 仅 ${strongCount} 家`);
  }

  return reasons.join("；") || "未达阈值，需查看 top12 多样性补位是否挤占强相关候选";
}

function addWeakDimensionScores(scores, item, count) {
  if (count > RECOMMENDED_CANDIDATES) return;

  const weight = count < MINIMUM_CANDIDATES ? 4 : count < RECOMMENDED_CANDIDATES ? 2 : 1;
  const entries = [
    ["餐段/场景", item.dimensions.mealPurpose],
    ["预算", item.dimensions.budget],
    ["距离", item.dimensions.distance],
    ["想吃", item.dimensions.branchPreference],
    ["tasteTags", item.dimensions.tasteTags],
    ["needTags", item.dimensions.needTags],
    ["temporaryAvoidTags", item.dimensions.temporaryAvoidTags],
    ["avoidTags", item.dimensions.avoidTags],
    ["spicyLevel", item.dimensions.spicyLevel]
  ];

  entries.forEach(([dimension, value]) => {
    if (!value || value === "(无)") return;
    const key = `${dimension}=${value}`;
    scores.set(key, (scores.get(key) ?? 0) + weight);
  });
}

function addWeakDimensionBreakdown(breakdown, item, count) {
  if (count > RECOMMENDED_CANDIDATES) return;

  const weight = count < MINIMUM_CANDIDATES ? 4 : count < RECOMMENDED_CANDIDATES ? 2 : 1;
  const entries = [
    ["餐段/场景", item.dimensions.mealPurpose],
    ["预算", item.dimensions.budget],
    ["距离", item.dimensions.distance],
    ["想吃", item.dimensions.branchPreference],
    ["tasteTags", item.dimensions.tasteTags],
    ["needTags", item.dimensions.needTags],
    ["temporaryAvoidTags", item.dimensions.temporaryAvoidTags],
    ["avoidTags", item.dimensions.avoidTags],
    ["spicyLevel", item.dimensions.spicyLevel]
  ];

  entries.forEach(([dimension, value]) => {
    if (!value || value === "(无)") return;
    if (!breakdown.has(dimension)) {
      breakdown.set(dimension, new Map());
    }
    const dimensionScores = breakdown.get(dimension);
    dimensionScores.set(value, (dimensionScores.get(value) ?? 0) + weight);
  });
}

function formatTopWeakDimensions(scores, limit = 10) {
  const rows = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .slice(0, limit);

  return rows.length ? rows.map(([key, score]) => `${key}(${score})`).join("；") : "无";
}

function formatWeakDimensionBreakdown(breakdown, limit = 5) {
  const dimensionOrder = [
    "预算",
    "距离",
    "餐段/场景",
    "avoidTags",
    "spicyLevel",
    "temporaryAvoidTags",
    "tasteTags",
    "needTags",
    "想吃"
  ];

  return dimensionOrder
    .filter((dimension) => breakdown.has(dimension))
    .map((dimension) => {
      const rows = Array.from(breakdown.get(dimension).entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
        .slice(0, limit)
        .map(([value, score]) => `${value}(${score})`);

      return `${dimension}：${rows.join("；")}`;
    });
}

async function loadData() {
  const [
    regionFile,
    gutShopsFile,
    syntheticShopsFile,
    gutDishesFile,
    syntheticDishesFile,
    gutFeaturesFile,
    syntheticFeaturesFile,
    sceneFitsFile
  ] = await Promise.all([
    readJson(path.join("regions", "guangzhou_university_town.json")),
    readJson("shops.gut.seed.json"),
    readJson("shops.synthetic.seed.json"),
    readJson("dishes.gut.seed.json"),
    readJson("dishes.synthetic.seed.json"),
    readJson("shop-features.gut.seed.json"),
    readJson("shop-features.synthetic.seed.json"),
    readJson("scene-fit.synthetic.seed.json")
  ]);

  const shops = [...gutShopsFile.shops, ...syntheticShopsFile.shops];
  const dishes = [...gutDishesFile.dishes, ...syntheticDishesFile.dishes];
  const features = [...gutFeaturesFile.features, ...syntheticFeaturesFile.features];
  const sceneFits = sceneFitsFile.sceneFits;
  const dishesByShopId = new Map();

  dishes.forEach((dish) => {
    const current = dishesByShopId.get(dish.shopId) ?? [];
    current.push(dish);
    dishesByShopId.set(dish.shopId, current);
  });

  return {
    regions: regionFile.regions,
    shops,
    dishes,
    features,
    sceneFits,
    dishesByShopId,
    featuresByShopId: new Map(features.map((feature) => [feature.shopId, feature])),
    sceneFitByShopId: new Map(sceneFits.map((sceneFit) => [sceneFit.shopId, sceneFit]))
  };
}

const data = await loadData();
const limit = readNumberEnv("OPENCLAW_FOOD_CANDIDATE_LIMIT", DEFAULT_CANDIDATE_LIMIT);
const weakDimensionScores = new Map();
const weakDimensionBreakdown = new Map();
const results = [];
let belowMinimum = 0;
let warningCount = 0;
let passCount = 0;
let idealCount = 0;

console.log("Food candidate coverage audit");
console.log(`Data: ${data.shops.length} shops, ${data.dishes.length} dishes, ${data.features.length} feature records, ${data.sceneFits.length} scene-fit records`);
console.log(`Candidate limit: ${limit}`);
console.log(`Coverage cases: ${cases.length}`);
console.log(`Thresholds: <${MINIMUM_CANDIDATES}=FAIL, ${MINIMUM_CANDIDATES}-${RECOMMENDED_CANDIDATES - 1}=WARN, >=${RECOMMENDED_CANDIDATES}=PASS, >=${IDEAL_CANDIDATES}=IDEAL`);

for (const item of cases) {
  const result = buildLocalFoodCandidates(data, item.request, limit);
  const candidateCount = result.candidates.length;
  const coverageGroup = item.coverageGroup ?? "official";
  const isExtreme = coverageGroup === "extreme";
  const failureCounts = countFailures(result.evaluations);
  const below2 = candidateCount < MINIMUM_CANDIDATES;
  const below6 = candidateCount < RECOMMENDED_CANDIDATES;
  const status = below2 ? "FAIL" : below6 ? "WARN" : candidateCount >= IDEAL_CANDIDATES ? "IDEAL" : "PASS";
  const reason = inferWeaknessReasons(item, result, failureCounts);
  const candidateNames = result.candidates.slice(0, 6).map((evaluation, index) => candidateRow(evaluation, index, data));

  if (below2) belowMinimum += 1;
  else if (below6) warningCount += 1;
  else passCount += 1;
  if (candidateCount >= IDEAL_CANDIDATES) idealCount += 1;

  addWeakDimensionScores(weakDimensionScores, item, candidateCount);
  addWeakDimensionBreakdown(weakDimensionBreakdown, item, candidateCount);
  results.push({
    label: item.label,
    coverageGroup,
    isExtreme,
    input: summarizeInput(item.request),
    candidateCount,
    hardAllowedTotal: result.allowed.length,
    strictTotal: result.strict.length,
    below2,
    below6,
    status,
    reason,
    candidates: candidateNames,
    hardFilter: summarizePolicy(result.hardFilter) || "none",
    failureCounts
  });

  console.log(`\n[${status}] [${coverageGroup}] ${item.label}`);
  console.log(`input: ${summarizeInput(item.request)}`);
  console.log(`hardFilter: ${summarizePolicy(result.hardFilter) || "none"}`);
  console.log(`candidateCount: ${candidateCount} (hardAllowedTotal=${result.allowed.length}, strictIntentTotal=${result.strict.length})`);
  console.log(`top6:\n${candidateNames.join("\n") || "(none)"}`);
  console.log(`<2: ${below2 ? "YES" : "NO"}；<6: ${below6 ? "YES" : "NO"}`);
  console.log(`reason: ${reason}`);

  if (below6 || required(process.env.FOOD_COVERAGE_VERBOSE_FAILURE_COUNTS)) {
    console.log(`failureReasonCounts: ${JSON.stringify(failureCounts)}`);
  }
}

const weakCombos = results
  .filter((item) => item.below6 || item.candidateCount === RECOMMENDED_CANDIDATES)
  .sort((a, b) => a.candidateCount - b.candidateCount || a.hardAllowedTotal - b.hardAllowedTotal)
  .slice(0, 10);
const failedOrWarnedCombos = results
  .filter((item) => item.below6)
  .sort((a, b) => a.candidateCount - b.candidateCount || a.hardAllowedTotal - b.hardAllowedTotal);
const normalOfficialResults = results.filter((item) => !item.isExtreme);
const extremeResults = results.filter((item) => item.isExtreme);
const normalOfficialStats = mergeCoverageStats(normalOfficialResults);
const extremeStats = mergeCoverageStats(extremeResults);
const groupStats = buildCoverageGroupStats(results);

console.log("\nCoverage distribution summary");
console.log(`总测试数：${cases.length}`);
console.log(`normal / official：${normalOfficialStats.total}`);
console.log(`extreme：${extremeStats.total}`);
console.log(`候选 < 2：${belowMinimum}`);
console.log(`候选 2–5：${warningCount}`);
console.log(`候选 >= 6：${passCount}`);
console.log(`候选 >= 12：${idealCount}`);
console.log(`normal / official 分布：${formatCoverageStats(normalOfficialStats)}`);
console.log(`extreme 分布：${formatCoverageStats(extremeStats)}`);
console.log("分组分布：");
for (const [group, stats] of Array.from(groupStats.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"))) {
  console.log(`${group}：${formatCoverageStats(stats)}`);
}
console.log(`最薄弱维度：${formatTopWeakDimensions(weakDimensionScores)}`);
console.log("按维度薄弱统计：");
const weakBreakdownRows = formatWeakDimensionBreakdown(weakDimensionBreakdown);
if (weakBreakdownRows.length) {
  weakBreakdownRows.forEach((row) => console.log(row));
} else {
  console.log("无");
}
console.log("最薄弱组合：");
if (weakCombos.length) {
  weakCombos.forEach((item, index) => {
    console.log(`${index + 1}. ${item.label} -> ${item.candidateCount} 家；${item.reason}`);
  });
} else {
  console.log("无 <6 组合，且没有刚好 6 家的薄边界组合");
}
console.log("失败/警告组合：");
if (failedOrWarnedCombos.length) {
  failedOrWarnedCombos.forEach((item, index) => {
    console.log(`${index + 1}. [${item.status}] ${item.label} -> ${item.candidateCount} 家`);
    console.log(`   top candidates: ${item.candidates.join(" | ") || "(none)"}`);
    console.log(`   reason: ${item.reason}`);
  });
} else {
  console.log("无");
}

console.log("\nPositive preference hit audit");
console.log(`Positive cases: ${positivePreferenceCases.length} (base=${positivePreferenceCases.length - fixedRandomRegressionCases.length - spicyPositivePreferenceCases.length}, fixedRandom=${fixedRandomRegressionCases.length}, spicy=${spicyPositivePreferenceCases.length})`);
let positiveFailureCount = 0;

for (const item of positivePreferenceCases) {
  const result = buildLocalFoodCandidates(data, item.request, limit);
  const hitCandidates = result.candidates.filter((evaluation) => {
    return candidateHitsPositiveCase(evaluation, data, item.expectedIntents);
  });
  const allowedHitCount = result.allowed.filter((evaluation) => {
    return candidateHitsPositiveCase(evaluation, data, item.expectedIntents);
  }).length;
  const clearlySpicyCandidates = result.candidates.filter((evaluation) => candidateClearlySpicy(evaluation, data));
  const clearlySpicyHitCount = clearlySpicyCandidates.length;
  const maximumClearlySpicyViolations = item.maximumClearlySpicyViolations;
  const minimumClearlySpicyHits = item.minimumClearlySpicyHits;
  const clearSpicyViolationPassed = maximumClearlySpicyViolations === undefined || clearlySpicyHitCount <= maximumClearlySpicyViolations;
  const clearSpicyMinimumPassed = minimumClearlySpicyHits === undefined || clearlySpicyHitCount >= minimumClearlySpicyHits;
  const dataThinPassed = item.allowDataThinPass === true
    && allowedHitCount > 0
    && allowedHitCount < item.threshold
    && hitCandidates.length >= allowedHitCount;
  const passed = (hitCandidates.length >= item.threshold || dataThinPassed) && clearSpicyViolationPassed && clearSpicyMinimumPassed;
  const topRows = result.candidates.map((evaluation, index) => {
    return positiveCandidateRow(evaluation, index, data, item.expectedIntents);
  });
  const hitNames = hitCandidates.map((evaluation) => evaluation.shop.name);

  if (!passed) {
    positiveFailureCount += 1;
  }

  console.log(`\n[${passed ? "PASS" : "FAIL"}] ${item.label}`);
  console.log(`input: ${summarizeInput(item.request)}`);
  console.log(`positivePolicy: intents=${result.positivePolicy.intents.join("/") || "none"}; tokens=${result.positivePolicy.tokens.join("/") || "none"}`);
  console.log(`candidateCount: ${result.candidates.length} (hardAllowedTotal=${result.allowed.length}, positiveAllowedHits=${allowedHitCount})`);
  console.log(`top12:\n${topRows.join("\n") || "(none)"}`);
  console.log(`positiveHits: ${hitCandidates.length}/${item.threshold}`);
  if (dataThinPassed) {
    console.log(`dataThin: hard-filtered positive hits only ${allowedHitCount}; all available hits surfaced in top12`);
  }
  if (maximumClearlySpicyViolations !== undefined || minimumClearlySpicyHits !== undefined) {
    console.log(`clearlySpicyTop12: ${clearlySpicyHitCount}; min=${minimumClearlySpicyHits ?? "(无)"}; maxViolation=${maximumClearlySpicyViolations ?? "(无)"}`);
  }
  console.log(`hitNames: ${hitNames.join("、") || "(none)"}`);

  if (!passed) {
    const reasons = [];
    if (hitCandidates.length < item.threshold) {
      reasons.push(inferPositiveAuditFailureReasons(result, item, hitCandidates.length, allowedHitCount));
    }
    if (!clearSpicyMinimumPassed) {
      reasons.push(`明显辣候选仅 ${clearlySpicyHitCount} 家，低于要求 ${minimumClearlySpicyHits} 家`);
    }
    if (!clearSpicyViolationPassed) {
      reasons.push(`不吃辣冲突下明显辣候选 ${clearlySpicyHitCount} 家，超过允许 ${maximumClearlySpicyViolations} 家`);
    }
    console.log(`reason: ${reasons.join("；")}`);
  }
}

if (normalOfficialStats.belowMinimum > 0) {
  console.error(`\n${normalOfficialStats.belowMinimum} normal / official food candidate coverage case(s) failed with fewer than ${MINIMUM_CANDIDATES} local candidates.`);
  process.exit(1);
}

if (normalOfficialStats.warning > 0) {
  console.error(`\n${normalOfficialStats.warning} normal / official food candidate coverage case(s) only produced ${MINIMUM_CANDIDATES}-${RECOMMENDED_CANDIDATES - 1} local candidates.`);
  process.exit(1);
}

if (extremeStats.belowMinimum > 0) {
  console.error(`\n${extremeStats.belowMinimum} extreme food candidate coverage case(s) failed with fewer than ${MINIMUM_CANDIDATES} local candidates.`);
  process.exit(1);
}

if (positiveFailureCount > 0) {
  console.error(`\n${positiveFailureCount} positive preference audit case(s) failed to reach their top12 hit thresholds.`);
  process.exit(1);
}

if (warningCount > 0) {
  console.warn(`\n${warningCount} food candidate coverage case(s) are below the recommended ${RECOMMENDED_CANDIDATES} candidates; only extreme cases may remain in this band.`);
} else {
  console.log(`\nAll food candidate coverage cases reached the recommended ${RECOMMENDED_CANDIDATES}+ local candidates.`);
}

console.log("All normal / official food candidate coverage cases reached the recommended local candidate threshold.");
console.log("All extreme food candidate coverage cases cleared the OpenClaw preflight minimum.");

console.log("All positive preference audit cases reached their top12 hit thresholds.");
