# 任务 2：GitHub 协作流程 & 上传你的选题想法

> **截止时间：2026-04-28（周二）22:00**
> **建议节奏：分两天，每天 30-40 分钟**
> **卡住超过 20 分钟 → 发群里截图，别硬撑**

---

## 为什么要做这个任务

我们接下来几周要协作写代码、写文档、写选题方案。每个人都能**独立地改东西**而不互相覆盖，这是协作的底线。这次任务把整套流程走一遍，以后你做任何改动（改代码、加文档、交作业）都是同一套流程，不用重新学。

一句话：**这个任务学会了，后面整个比赛的 Git 操作你都够用了**。

---

## 你今天结束时会掌握什么

- ✅ Clone 仓库到本地
- ✅ 理解"本地"和"远程"的区别
- ✅ 创建自己的分支、提交改动
- ✅ 发 Pull Request 让队长审核合并
- ✅ 同步其他人的最新改动

---

## 整体流水线（先有个图在脑子里）

```
  接受邀请
     ↓
  Clone 仓库到本地（Day 1）
     ↓
  创建分支 ideas/你的名字
     ↓
  复制模板 → 填写你的想法
     ↓
  Commit（存到本地）
     ↓
  Publish branch（传到远程）
     ↓
  开 Pull Request
     ↓
  @队长 review + merge
     ↓
  切回 main 并 Pull（看到自己的改动被合并）
```

全程都在 GitHub Desktop 点按钮，**不需要打任何命令**。

---

# Day 1（建议 04/26 或 04/27 完成）

## Step 1：接受仓库邀请

我（队长）把你加进仓库之后，你会从**两个地方**收到通知，任选一个：

- **邮箱**：收到一封来自 GitHub 的邮件，标题类似 "[Your name] invited you to [repo name]"，点里面的 **"View invitation"** 按钮
- **GitHub 网页**：登录 github.com 后，右上角的**铃铛图标**（通知）会亮红点，点开能看到邀请

两种入口打开后都是同一个页面，点绿色的 **"Accept invitation"** 按钮即可。

---

## Step 2：在 GitHub Desktop 里 Clone 仓库

"Clone（克隆）" = 把远程仓库**下载一份到你电脑上**。

### 操作

1. 打开 在线仓库
2. 顶部菜单：**code → Open with Github Desktop**

![[Pasted image 20260423183338.png]]
![[Pasted image 20260423183435.png]]

### 成功标志

GitHub Desktop 左上角显示仓库名称，去文件资源管理器打开你刚才选的 Local path，能看到 `README.md`、`docs/`、`ideas/` 这些文件和文件夹。
![[Pasted image 20260423183454.png]]


---

## Step 3：理解本地和远程（读一下，脑子里有概念就行）

| 名称 | 是什么 | 怎么看 |
|---|---|---|
| **本地（Local）** | 你自己电脑上的那份文件 | 打开文件资源管理器，找到你 Clone 下来的文件夹 |
| **远程（Remote / origin）** | GitHub 服务器上的那份文件 | 浏览器打开 github.com 进仓库 |

同步方式：

- 你改本地的东西 → **Commit（保存到本地历史）** → **Push（上传到远程）**
- 别人改了远程 → 你 **Fetch（检查更新）** → **Pull（下载到本地）**

"Commit" 就是给"这一版"拍个快照存起来，"Push" 才是传到服务器。所以 Commit 了不等于队友能看见，**一定要 Push**。

---

## Day 1 到这里就够了

不用急着做 Day 2。先把这三步消化一下，去仓库里随便看看文件都有什么。明天再继续。

---

# Day 2（推荐 04/28 ddl 当天或前一天）

## Step 4：创建属于你的分支（Branch）

### 为什么要分支

如果三个人都直接改 `main`（主分支），就像三个人同时编辑同一份 Word 文档——谁保存晚谁就会覆盖别人。

**分支（branch）= 一个独立的工作空间**，你在自己分支里怎么改都不影响别人。改完了再通过 PR（下面会讲）合并回 main。

### 操作

1. GitHub Desktop 顶部中间有个按钮：**"new branch"**，点它
2. 下拉菜单里点 **"New branch"**
3. 分支名填：**`ideas/你的拼音或英文名`**（例如 `ideas/lilei`、`ideas/zhangsan`）
   - ⚠️ 注意是英文斜杠 `/`，不是反斜杠
   - ⚠️ 全小写、用拼音或英文，不要中文
4. "Create branch based on" 选择 **main**
5. 点 **Create branch**


![[Pasted image 20260423183519.png]]
![[Pasted image 20260423183546.png]]
如果不是空白的分支改变，会出现让你带走你的change还是留下change 这就要具体情况具体分析了，这里因为main里面我修改了我的部分 所以我选择了bring
![[Pasted image 20260423192633.png]]
### 成功标志

顶部按钮从 "Current branch: main" 变成 "Current branch: ideas/你的名字"。

---

## Step 5：复制模板、填写你的想法

### 操作

1. 打开文件资源管理器（Windows 按 Win+E / Mac 用 Finder）
2. 进入你 Clone 下来的仓库文件夹 → `docs/ideas/` 子文件夹
3. 看到一个文件叫 **`_template_选题想法.md`**
4. **复制它**（Ctrl+C / Cmd+C），然后**粘贴到同一个文件夹**（Ctrl+V / Cmd+V）
5. 把复制出来的文件重命名为 **`你的名字-想法.md`**（例如 `lilei-想法.md`）
6. 用任何编辑器打开这个文件（推荐 **VS Code** / **Obsidian** / 甚至记事本都行）
7. 按里面的提示把每一节填一下
8. 保存（Ctrl+S / Cmd+S）

### 模板里都有啥

模板里有 8 个小节，不是每节都要写得很满，写不出来就写"暂无想法"——**有尝试就比空着强**。重点写好的三节是：**第 1 节（一句话描述）、第 4 节（MVP）、第 6 节（你为什么想做）**。

### 可不可以传多份想法

**可以，也鼓励**。你可以传 `lilei-想法-01.md`、`lilei-想法-02.md`，但要都在同一个 PR 里提交。

### 可不可以用 Word

可以（`.docx`），但推荐 `.md`——后面队长对比几份想法时 md 更容易看 diff。

---

## Step 6：Commit 到本地

### 操作

1. 回到 GitHub Desktop
2. 左侧面板会自动显示**你改动了哪些文件**（新增文件会有加号，改动过的会有打勾）
3. 确认新增的文件确实是你刚才创建的 `你的名字-想法.md`（没问题就保持打勾）
4. 左下方有两个输入框：
   - **Summary（必填）**：写这次 commit 在干嘛。示例：`feat: 添加李雷的选题想法`
   - **Description（选填）**：可以不填，想多说两句也行
5. 点蓝色按钮 **"Commit to ideas/你的名字"**

### Commit message 写法（很重要）

**不要写**：`修改`、`aaa`、`1`、`改了一下`

**要写**：`feat: 添加李雷的选题想法`、`docs: 补充选题想法-02 的技术方向`、`fix: 修正想法里的错字`

这个规则不是洁癖——以后出了 bug 想翻历史，看到"aaa"你自己都不知道那次改了什么。
![[Pasted image 20260423192844.png]]

---

## Step 7：Publish 分支到远程

Commit 完成后，GitHub Desktop 右上角会出现一个蓝色按钮 **"Publish branch"**（如果是已经 Publish 过的分支，会是 "Push origin"）。

点它。几秒钟后你的分支就上传到 GitHub 服务器了。
![[Pasted image 20260423192909.png]]


---

## Step 8：开 Pull Request（PR）

**什么是 PR**：你向队长"申请把我的改动合并到 main"。队长看过觉得 OK 就 merge（合并），有问题会留评论让你改。

### 操作

1. Publish 成功后，GitHub Desktop 会显示 **"Create Pull Request"** 按钮，点它
2. 浏览器会自动打开 GitHub 网页上的 PR 创建页面
3. 确认：
   - **base: main** ← 往 main 合并
   - **compare: ideas/你的名字** ← 从你的分支来
4. 填 Title（标题），例如：`添加 李雷 的选题想法`
5. Description（正文）可以留空，或写一行"最想做第 3 个想法，见文件"这种提示
6. 点绿色按钮 **"Create pull request"**



---

## Step 9：通知队长 + 等合并

1. 复制 PR 的网页链接
2. 发到群里，@队长，格式示例：
   ```
   @队长 选题想法已上传，请 review
   PR 链接：https://github.com/xxx/yyy/pull/1
   ```
3. 等队长 merge（我会在 12 小时内处理）

---

## Step 10：合并后同步 main

队长 merge 之后，你本地还在 `ideas/你的名字` 分支上，看到的 main 还是旧版本。**要同步一下**：

1. GitHub Desktop 顶部 **"Current branch"** → 切换到 **main**
2. 顶部点 **Fetch origin**（或 Pull origin，有更新时按钮会自动变）
3. Done！你本地的 main 现在和远程一样了，能看到你自己和其他队友的想法都合并进去了

---

# 常见问题速查表

| 遇到的情况 | 怎么办 |
|---|---|
| 找不到 Clone 下来的位置 | GitHub Desktop 顶部 **Repository → Show in Explorer / Show in Finder** |
| 改错了想撤销某个文件 | 左侧文件右键 → **Discard changes** |
| Commit 之前不想提交某个文件 | 左侧文件名前的**勾去掉**（只 commit 打勾的） |
| 提示 "You must specify a name and email" | File → Options → Git，填你的名字和注册邮箱 |
| Push 失败说 "updates were rejected" | 先点 **Fetch origin → Pull origin**，再 Push |
| 不小心在 main 上改了东西 | **先别 Commit**！直接创建新分支，改动会自动带过去 |
| PR 里显示 "This branch has conflicts" | **不要自己瞎点**，@队长帮你处理 |
| 文件名写错了想改 | 在文件管理器里改名，GitHub Desktop 会识别到"重命名" |
| 中文文件显示乱码 | 用 VS Code 打开，右下角编码切到 **UTF-8** |

---

# 三条铁律（重要）

1. **永远不要直接在 `main` 分支 commit**。先切到自己的分支再改。
2. **Commit message 要写人话**。写"修改"、"aa" 这种 = 不合格，会被打回让你重写。
3. **搞不定先问，不要硬闯**。GUI 操作一般没法搞出什么灾难，但"我感觉我删了什么东西"这种情况，**立刻停手 @队长**，问完再动。

---

# Checklist

**Day 1**
- [ ] 接受仓库邀请（Step 1）
- [ ] Clone 仓库到本地（Step 2）
- [ ] 看一眼本地文件夹，知道仓库长什么样

**Day 2**
- [ ] 创建分支 `ideas/你的名字`（Step 4）
- [ ] 在 `ideas/` 文件夹新建 `你的名字-想法.md` 并填写完（Step 5）
- [ ] Commit 并写清楚 Summary（Step 6）
- [ ] Publish branch 到远程（Step 7）
- [ ] 开 Pull Request（Step 8）
- [ ] 群里 @队长 贴 PR 链接（Step 9）
- [ ] 队长 merge 后切回 main 并 Pull origin（Step 10）

**全部完成 = 你的选题想法正式进入项目仓库了 🎉**

---

**截止：2026-04-28（周二）22:00**

卡住超过 20 分钟 → 群里截图 @我
