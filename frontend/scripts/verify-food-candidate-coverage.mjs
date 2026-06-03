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

const cases = dedupeCases([
  ...focusedCases,
  ...mealDistanceBudgetCases,
  ...preferenceCases,
  ...branchCases,
  ...temporaryAvoidCases,
  ...budgetPressureCases,
  ...restrictionStressCases,
  ...distancePressureCases,
  ...mixedNeedPressureCases
]);

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

function joinDimension(values) {
  return (values ?? []).length ? values.join("/") : "(无)";
}

function dedupeCases(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = JSON.stringify(item.request);
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
      allow(["家常菜", "粤菜", "川湘菜", "潮汕菜", "东北菜"], ["家常菜", "下饭", "炒菜"]);
      block(["西餐", "日料", "韩餐", "咖啡", "奶茶", "甜品", "轻食"]);
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

function sortCandidateEvaluations(evaluations) {
  return evaluations.slice().sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
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

function evaluateFoodCandidate(shop, data, hardFilter) {
  const features = data.featuresByShopId.get(shop.id);
  const dishes = data.dishesByShopId.get(shop.id) ?? [];
  const text = buildFoodCandidateSearchText(shop, features, dishes);
  const hardViolations = collectFoodCandidateHardViolations(shop, data, hardFilter, text, features);
  const strictMatch = isStrictFoodCandidateMatch(shop, text, hardFilter);
  const score = scoreFoodCandidate(shop, data, hardFilter, text, strictMatch);

  return {
    shop,
    text,
    strictMatch,
    hardAllowed: hardViolations.length === 0,
    hardViolations,
    score
  };
}

function buildLocalFoodCandidates(data, request, limit) {
  const hardFilter = buildHardFoodFilterPolicy(request);
  const excludedIds = new Set(request.requestContext?.excludeIds ?? []);
  const evaluations = data.shops
    .filter((shop) => !excludedIds.has(shop.id))
    .map((shop) => evaluateFoodCandidate(shop, data, hardFilter));
  const allowed = evaluations.filter((evaluation) => evaluation.hardAllowed);
  const strict = allowed.filter((evaluation) => evaluation.strictMatch);
  const relaxed = allowed.filter((evaluation) => !evaluation.strictMatch);
  const hasExplicitIntent = hardFilter.allowedCategories.length > 0 || hardFilter.preferredTerms.length > 0;
  const ordered = hasExplicitIntent
    ? [...sortCandidateEvaluations(strict), ...sortCandidateEvaluations(relaxed)]
    : sortCandidateEvaluations(roundRobinByCategoryEvaluation(allowed));

  return {
    candidates: ordered.slice(0, Math.max(MINIMUM_CANDIDATES, limit)),
    allowed,
    strict,
    relaxed,
    evaluations,
    hardFilter
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

  console.log(`\n[${status}] ${item.label}`);
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

console.log("\nCoverage distribution summary");
console.log(`总测试数：${cases.length}`);
console.log(`候选 < 2：${belowMinimum}`);
console.log(`候选 2–5：${warningCount}`);
console.log(`候选 >= 6：${passCount}`);
console.log(`候选 >= 12：${idealCount}`);
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

if (belowMinimum > 0) {
  console.error(`\n${belowMinimum} food candidate coverage case(s) failed with fewer than ${MINIMUM_CANDIDATES} local candidates.`);
  process.exit(1);
}

if (warningCount > 0) {
  console.warn(`\n${warningCount} food candidate coverage case(s) are below the recommended ${RECOMMENDED_CANDIDATES} candidates but still clear the OpenClaw preflight minimum.`);
} else {
  console.log(`\nAll food candidate coverage cases reached the recommended ${RECOMMENDED_CANDIDATES}+ local candidates.`);
}
