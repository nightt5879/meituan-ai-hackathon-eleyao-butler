const foodAiAdapter = require('../../services/foodAiAdapter');
const userMemoryAdapter = require('../../services/userMemoryAdapter');
const tagConfig = require('../../data/tasteTags');
const themeAdapter = require('../../services/themeAdapter');

const emptySelectedTags = {
  taste: [],
  need: [],
  avoid: [],
  spicyLevel: []
};

const adjustmentOptions = [
  { label: '太贵了', action: 'budget' },
  { label: '太远了', action: 'distance' },
  { label: '不想吃这个口味', action: 'taste' },
  { label: '想清淡一点', action: 'taste-light' },
  { label: '想重口一点', action: 'taste-heavy' },
  { label: '想换个品类', action: 'category' },
  { label: '忌口没说清', action: 'avoid' },
  { label: '重新开始', action: 'restart' }
];

Page({
  data: {
    session: foodAiAdapter.createInitialSession(),
    currentQuestion: null,
    currentOptions: [],
    tagGroups: [],
    isTagQuestion: false,
    showManualInput: true,
    selectedOptions: [],
    selectedTags: emptySelectedTags,
    manualAnswer: '',
    manualInputs: {},
    selectionHistory: [],
    answerHistory: [],
    isFinished: false,
    chatMessages: [],
    showSlotSummaryDetail: false,
    slotSummaryText: '',
    summaryFields: [],
    slotItems: [],
    recommendations: [],
    recommendationBatchIndex: 0,
    recommendationNotice: '',
    showAdjustmentOptions: false,
    adjustmentOptions,
    currentTheme: 'warm',
    hasSavedCurrentRecord: false
  },

  onLoad() {
    this.syncTheme();

    if (!wx.getStorageSync('isLoggedIn')) {
      wx.reLaunch({
        url: '/pages/login/login'
      });
      return;
    }

    this.startSession();
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    this.setData({
      currentTheme: themeAdapter.getCurrentThemeKey()
    });
  },

  startSession() {
    const session = foodAiAdapter.createInitialSession();
    this.hasSavedCurrentRecordFlag = false;
    this.setData({
      hasSavedCurrentRecord: false
    });
    this.updateQuestionState(session);
  },

  handleOptionTap(event) {
    const value = event.currentTarget.dataset.value;

    this.toggleOption(value);
  },

  handleTagTap(event) {
    const tagId = event.currentTarget.dataset.id;
    const tagType = event.currentTarget.dataset.type;
    const mode = event.currentTarget.dataset.mode;
    const selectedTags = this.cloneSelectedTags(this.data.selectedTags);
    const currentValues = selectedTags[tagType] || [];
    const selectedIndex = currentValues.indexOf(tagId);

    if (mode === 'single') {
      selectedTags[tagType] = selectedIndex >= 0 ? [] : [tagId];
    } else if (tagType === 'avoid') {
      selectedTags[tagType] = this.toggleAvoidTag(currentValues, tagId, selectedIndex);
    } else if (selectedIndex >= 0) {
      currentValues.splice(selectedIndex, 1);
      selectedTags[tagType] = currentValues;
    } else {
      currentValues.push(tagId);
      selectedTags[tagType] = currentValues;
    }

    this.setData({
      selectedTags,
      tagGroups: this.formatTagGroups(this.data.currentQuestion, selectedTags)
    });
  },

  handleManualInput(event) {
    const val = event.detail.value;
    const currentQuestion = this.data.currentQuestion;
    const manualInputs = Object.assign({}, this.data.manualInputs);
    if (currentQuestion) {
      manualInputs[currentQuestion.id] = val;
    }
    this.setData({ manualAnswer: val, manualInputs });
  },

  handleConfirm() {
    const manualAnswer = this.data.manualAnswer.trim();
    const currentQuestion = this.data.currentQuestion;
    const selectedOptions = this.data.selectedOptions.slice();

    if (!currentQuestion) {
      return;
    }

    if (currentQuestion.kind === 'tag') {
      if (!currentQuestion.optional && !currentQuestion.allowEmpty) {
        const hasTagSelection =
          this.data.selectedTags.taste.length > 0 ||
          this.data.selectedTags.need.length > 0 ||
          this.data.selectedTags.avoid.length > 0 ||
          this.data.selectedTags.spicyLevel.length > 0;
        if (!hasTagSelection && !manualAnswer) {
          wx.showToast({ title: '请先选择或填写一个偏好', icon: 'none' });
          return;
        }
      }
      this.submitAnswer({
        preferences: this.buildPreferencesFromSelectedTags(currentQuestion, manualAnswer)
      });
      return;
    }

    if (currentQuestion.kind === 'multi-choice') {
      if (!selectedOptions.length && !manualAnswer) {
        if (currentQuestion.allowEmpty) {
          this.submitAnswer('未选择');
          return;
        }
        wx.showToast({ title: '请先选择或填写一个偏好', icon: 'none' });
        return;
      }
      this.submitAnswer(selectedOptions.length ? selectedOptions.join('、') : manualAnswer);
      return;
    }

    // choice question — required
    if (!selectedOptions.length && !manualAnswer) {
      wx.showToast({ title: '请先选择或填写一个偏好', icon: 'none' });
      return;
    }

    // mealPurpose-only: canonicalize manual input and detect conflicts with selected option.
    if (currentQuestion.id === 'mealPurpose') {
      const detected = detectMealPurposeFromText(manualAnswer);

      if (selectedOptions.length) {
        const pickedOption = selectedOptions[0];

        if (detected && detected.canonical !== pickedOption) {
          const self = this;
          wx.showModal({
            title: '确认就餐场景',
            content: '你选择了"' + pickedOption + '"，但补充里提到了"' + detected.keyword + '"。你想把就餐场景改成"' + detected.canonical + '"吗？',
            confirmText: '确认修改',
            cancelText: '保持原选',
            success: function (res) {
              if (res.confirm) {
                // Adopt the manual keyword: clear conflicting manual text, submit canonical.
                const nextManualInputs = Object.assign({}, self.data.manualInputs);
                nextManualInputs[currentQuestion.id] = '';
                self.setData({ manualAnswer: '', manualInputs: nextManualInputs });
                self.submitAnswer(detected.canonical);
              } else {
                // Keep the selected option; manual input stays as a supplementary note.
                self.submitAnswer(pickedOption);
              }
            }
          });
          return;
        }

        // No conflict (no keyword in manual, or its canonical matches the selected option).
        this.submitAnswer(pickedOption);
        return;
      }

      // No option selected — submit canonical mealPurpose if manual text contains a keyword.
      if (detected) {
        this.submitAnswer(detected.canonical);
        return;
      }
      this.submitAnswer(manualAnswer);
      return;
    }

    this.submitAnswer(selectedOptions.length ? selectedOptions.join('、') : manualAnswer);
  },

  restartSession() {
    this.hasSavedCurrentRecordFlag = false;
    this.setData({
      manualInputs: {},
      selectionHistory: [],
      answerHistory: [],
      showSlotSummaryDetail: false,
      recommendationBatchIndex: 0,
      recommendationNotice: '',
      showAdjustmentOptions: false,
      hasSavedCurrentRecord: false
    });
    this.startSession();
  },

  toggleSlotSummary() {
    this.setData({
      showSlotSummaryDetail: !this.data.showSlotSummaryDetail
    });
  },

  handleSummaryFieldTap(event) {
    const questionId = event.currentTarget.dataset.questionId;
    const isAvailable = event.currentTarget.dataset.available;

    if (isAvailable === false || isAvailable === 'false') {
      return;
    }

    this.jumpToQuestionById(questionId);
  },

  handleRefreshRecommendations() {
    const currentRecommendations = this.data.recommendations || [];
    const currentIds = currentRecommendations.map(function (item) {
      return item.id;
    });
    const nextBatchIndex = this.data.recommendationBatchIndex + 1;
    const nextRecommendations = foodAiAdapter.generateRecommendations(
      this.data.session.slots,
      this.data.session.preferences,
      {
        excludeIds: currentIds,
        batchIndex: nextBatchIndex
      }
    );
    const nextIds = nextRecommendations.map(function (item) {
      return item.id;
    });
    const isSameBatch = areSameRecommendationIds(currentIds, nextIds);

    this.setData({
      recommendations: nextRecommendations,
      recommendationBatchIndex: nextBatchIndex,
      recommendationNotice: isSameBatch
        ? '暂时没有更多合适方案，我再帮你放宽一点条件试试'
        : '我换了一批，你可以看看有没有更顺眼的方案。',
      showAdjustmentOptions: false
    });
  },

  handleStartAdjustment() {
    this.setData({
      showAdjustmentOptions: true,
      recommendationNotice: ''
    });
  },

  handleAdjustmentOptionTap(event) {
    const action = event.currentTarget.dataset.action;
    const label = event.currentTarget.dataset.label;

    if (action === 'restart') {
      this.restartSession();
      return;
    }

    const targetQuestionId = this.getAdjustmentTargetQuestionId(action);

    if (!targetQuestionId) {
      if (action === 'avoid') {
        wx.showToast({
          title: '这个场景暂时不单独追问忌口，你可以在输入框补充',
          icon: 'none'
        });
      }
      return;
    }

    this.jumpToQuestionById(targetQuestionId, {
      feedbackText: label,
      noticeText: this.getAdjustmentNoticeText(action)
    });
  },

  handleGoBack() {
    const session = this.data.session;
    const currentQuestion = this.data.currentQuestion;

    if (!currentQuestion || session.questionIndex <= 0) { return; }

    // Save current selection state before navigating back
    let selectionHistory = this.data.selectionHistory.slice();
    selectionHistory[session.questionIndex] = {
      selectedOptions: this.data.selectedOptions.slice(),
      selectedTags: this.cloneSelectedTags(this.data.selectedTags)
    };

    const prevSession = foodAiAdapter.goBack(session);
    const prevQuestion = foodAiAdapter.getNextQuestion(prevSession);

    if (!prevQuestion) { return; }

    // When returning to mealPurpose, clear branch-specific history so stale
    // branch answers from the old branch are not restored if the user picks differently.
    if (prevSession.questionIndex === 0) {
      selectionHistory = selectionHistory.slice(0, 1);
    }

    const restored = selectionHistory[prevSession.questionIndex] || {};
    const selectedOptions = restored.selectedOptions || [];
    const selectedTags = restored.selectedTags || this.cloneSelectedTags(emptySelectedTags);
    const manualAnswer = this.data.manualInputs[prevQuestion.id] || '';

    this.setData({
      session: prevSession,
      currentQuestion: prevQuestion,
      selectionHistory,
      answerHistory: this.data.answerHistory.slice(0, prevSession.questionIndex),
      selectedOptions,
      selectedTags,
      manualAnswer,
      currentOptions: (prevQuestion.kind === 'choice' || prevQuestion.kind === 'multi-choice')
        ? this.formatQuestionOptions(prevQuestion, selectedOptions)
        : [],
      tagGroups: prevQuestion.kind === 'tag'
        ? this.formatTagGroups(prevQuestion, selectedTags)
        : [],
      isTagQuestion: prevQuestion.kind === 'tag',
      showManualInput: true,
      isFinished: false,
      chatMessages: this.buildChatMessages(prevSession, prevQuestion),
      slotSummaryText: this.buildSlotSummaryText(prevSession.slots, prevSession.preferences),
      summaryFields: this.buildSummaryFields(prevSession),
      slotItems: this.formatSlotItems(prevSession.slots, prevSession.preferences)
    });
  },

  submitAnswer(answer) {
    const prevIndex = this.data.session.questionIndex;
    const prevSession = this.data.session;
    const session = foodAiAdapter.answerQuestion(prevSession, answer);
    let answerHistory = this.data.answerHistory;

    if (session !== prevSession && session.questionIndex > prevIndex) {
      answerHistory = this.data.answerHistory.slice(0, prevIndex);
      answerHistory[prevIndex] = cloneAnswerForHistory(answer);
    }

    this.updateQuestionState(session, prevIndex, answerHistory);
  },

  toggleOption(value) {
    const currentQuestion = this.data.currentQuestion;
    const isTasteQuestion = currentQuestion && currentQuestion.slot === 'taste';
    const isMultiChoice = currentQuestion && currentQuestion.kind === 'multi-choice';
    let selectedOptions = this.data.selectedOptions.slice();
    const selectedIndex = selectedOptions.indexOf(value);

    if (isTasteQuestion || isMultiChoice) {
      if (value === '都可以') {
        selectedOptions = selectedIndex >= 0 ? [] : ['都可以'];
      } else if (selectedIndex >= 0) {
        selectedOptions.splice(selectedIndex, 1);
      } else {
        selectedOptions = selectedOptions.filter(function (item) {
          return item !== '都可以';
        });
        selectedOptions.push(value);
      }
    } else {
      selectedOptions = selectedIndex >= 0 ? [] : [value];
    }

    this.setData({
      selectedOptions,
      currentOptions: this.formatQuestionOptions(currentQuestion, selectedOptions)
    });
  },

  updateQuestionState(session, savedFromIndex, nextAnswerHistory) {
    const currentQuestion = foodAiAdapter.getNextQuestion(session);
    const recommendations = currentQuestion
      ? []
      : foodAiAdapter.generateRecommendations(session.slots, session.preferences);
    const hasSavedCurrentRecord = this.hasSavedCurrentRecordFlag || this.data.hasSavedCurrentRecord;
    const shouldSavePreferenceRecord = !currentQuestion && !hasSavedCurrentRecord;

    if (!currentQuestion) {
      userMemoryAdapter.updateUserMemory({
        slots: session.slots,
        preferences: session.preferences
      });
      userMemoryAdapter.saveRecommendationHistory(recommendations);

      if (shouldSavePreferenceRecord) {
        this.hasSavedCurrentRecordFlag = true;
        userMemoryAdapter.savePreferenceRecord(
          this.buildPreferenceRecord(session, recommendations)
        );
      }
    }

    const selectedTags = this.cloneSelectedTags(emptySelectedTags);

    // Save the just-confirmed question's selection to history (single setData call).
    const selectionHistory = this.data.selectionHistory.slice();
    if (savedFromIndex !== undefined) {
      selectionHistory[savedFromIndex] = {
        selectedOptions: this.data.selectedOptions.slice(),
        selectedTags: this.cloneSelectedTags(this.data.selectedTags)
      };
    }

    this.setData({
      session,
      currentQuestion,
      currentOptions: currentQuestion && (currentQuestion.kind === 'choice' || currentQuestion.kind === 'multi-choice')
        ? this.formatQuestionOptions(currentQuestion, [])
        : [],
      tagGroups: currentQuestion && currentQuestion.kind === 'tag'
        ? this.formatTagGroups(currentQuestion, selectedTags)
        : [],
      isTagQuestion: !!currentQuestion && currentQuestion.kind === 'tag',
      showManualInput: !!currentQuestion,
      selectedOptions: [],
      selectedTags,
      answerHistory: nextAnswerHistory || this.data.answerHistory,
      selectionHistory,
      manualAnswer: currentQuestion ? (this.data.manualInputs[currentQuestion.id] || '') : '',
      isFinished: !currentQuestion,
      chatMessages: this.buildChatMessages(session, currentQuestion),
      slotSummaryText: this.buildSlotSummaryText(session.slots, session.preferences),
      summaryFields: this.buildSummaryFields(session),
      slotItems: this.formatSlotItems(session.slots, session.preferences),
      recommendations,
      recommendationBatchIndex: 0,
      recommendationNotice: '',
      showAdjustmentOptions: false,
      hasSavedCurrentRecord: !currentQuestion
        ? (hasSavedCurrentRecord || shouldSavePreferenceRecord)
        : this.data.hasSavedCurrentRecord
    });
  },

  buildChatMessages(session, currentQuestion) {
    const messages = [];
    const answers = session.answers || [];
    const questionList = this.getQuestionList(session);
    const manualInputs = this.data.manualInputs || {};

    answers.forEach(function (answer, index) {
      const question = questionList[index] || null;
      const manualText = question ? (manualInputs[question.id] || '') : '';
      const isTagAnswer = !!question && question.kind === 'tag';
      messages.push({
        id: 'answer-' + index,
        role: 'user',
        messageClass: 'user-message',
        bubbleClass: 'user-bubble',
        contentClass: 'user-content',
        showAvatar: false,
        avatarText: '',
        showQuickReplies: false,
        text: formatAnswerBubbleText(answer, manualText, isTagAnswer)
      });
    });

    if (currentQuestion) {
      messages.push({
        id: 'question-' + session.questionIndex,
        role: 'butler',
        messageClass: 'butler-message',
        bubbleClass: 'butler-bubble',
        contentClass: 'butler-content',
        showAvatar: true,
        avatarText: 'AI',
        showQuickReplies: true,
        text: this.getQuestionBubbleText(currentQuestion, session)
      });
    }

    return messages;
  },

  getQuestionBubbleText(question, session) {
    if (question.id === 'mealPurpose' && !(session.answers || []).length) {
      return '今天我来帮你快速定一餐～先告诉我，你现在想解决什么吃饭场景？';
    }

    return question.title;
  },

  formatQuestionOptions(question, selectedOptions) {
    return question.options.map(function (option) {
      return {
        value: option,
        isSelected: selectedOptions.indexOf(option) >= 0
      };
    });
  },

  formatTagGroups(question, selectedTags) {
    return (question.groups || []).map(function (group) {
      const selectedIds = selectedTags[group.type] || [];

      return {
        title: group.title,
        type: group.type,
        mode: group.mode,
        tags: group.tags.map(function (tag) {
          return Object.assign({}, tag, {
            isSelected: selectedIds.indexOf(tag.id) >= 0
          });
        })
      };
    });
  },

  jumpToQuestionById(questionId, jumpOptions) {
    if (!questionId) {
      return;
    }

    const questionList = this.getQuestionList(this.data.session);
    const targetIndex = questionList.findIndex(function (question) {
      return question.id === questionId;
    });

    if (targetIndex < 0 || targetIndex > this.data.session.questionIndex) {
      return;
    }

    if (targetIndex === this.data.session.questionIndex) {
      return;
    }

    const replayResult = this.replaySessionToIndex(targetIndex);
    const targetQuestion = foodAiAdapter.getNextQuestion(replayResult.session);

    if (!targetQuestion || targetQuestion.id !== questionId) {
      return;
    }

    const replayQuestions = this.getQuestionList(replayResult.session);
    const manualInputs = this.pruneManualInputs(this.data.manualInputs, replayQuestions, targetIndex);
    const selectionHistory = this.data.selectionHistory.slice(0, targetIndex + 1);
    const restored = selectionHistory[targetIndex] || {};
    const selectedOptions = restored.selectedOptions || [];
    const selectedTags = restored.selectedTags || this.cloneSelectedTags(emptySelectedTags);
    const manualAnswer = manualInputs[targetQuestion.id] || '';
    const restoredState = this.restoreQuestionUiState(targetQuestion, selectedOptions, selectedTags);

    const chatMessages = this.buildChatMessages(replayResult.session, targetQuestion);
    const extraMessages = this.buildAdjustmentJumpMessages(jumpOptions);

    if (extraMessages.length) {
      // Insert extraMessages before the last element (the current question bubble).
      // Written without spread-in-splice for broader WeChat runtime compatibility.
      Array.prototype.splice.apply(
        chatMessages,
        [Math.max(chatMessages.length - 1, 0), 0].concat(extraMessages)
      );
    }

    this.hasSavedCurrentRecordFlag = false;

    this.setData(Object.assign({
      session: replayResult.session,
      currentQuestion: targetQuestion,
      selectionHistory,
      answerHistory: replayResult.answerHistory,
      manualInputs,
      selectedOptions,
      selectedTags,
      manualAnswer,
      isFinished: false,
      showManualInput: true,
      chatMessages,
      slotSummaryText: this.buildSlotSummaryText(replayResult.session.slots, replayResult.session.preferences),
      summaryFields: this.buildSummaryFields(replayResult.session),
      slotItems: this.formatSlotItems(replayResult.session.slots, replayResult.session.preferences),
      recommendations: [],
      recommendationBatchIndex: 0,
      recommendationNotice: '',
      showAdjustmentOptions: false,
      hasSavedCurrentRecord: false
    }, restoredState));
  },

  buildAdjustmentJumpMessages(jumpOptions) {
    const safeOptions = jumpOptions || {};
    const messages = [];

    if (safeOptions.feedbackText) {
      messages.push({
        id: 'adjustment-feedback',
        role: 'user',
        messageClass: 'user-message',
        bubbleClass: 'user-bubble',
        contentClass: 'user-content',
        showAvatar: false,
        avatarText: '',
        showQuickReplies: false,
        text: safeOptions.feedbackText
      });
    }

    if (safeOptions.noticeText) {
      messages.push({
        id: 'adjustment-notice',
        role: 'butler',
        messageClass: 'butler-message',
        bubbleClass: 'butler-bubble',
        contentClass: 'butler-content',
        showAvatar: true,
        avatarText: 'AI',
        showQuickReplies: false,
        text: safeOptions.noticeText
      });
    }

    return messages;
  },

  getAdjustmentTargetQuestionId(action) {
    if (action === 'budget') {
      return this.findQuestionIdBySlot('budget');
    }

    if (action === 'distance') {
      return this.findQuestionIdBySlot('distance');
    }

    if (action === 'category') {
      return this.findBranchPreferenceQuestionId();
    }

    if (action === 'avoid') {
      return this.findQuestionIdById('avoid-preferences');
    }

    if (action === 'taste' || action === 'taste-light' || action === 'taste-heavy') {
      return this.findQuestionIdById('tag-preferences') || this.findBranchPreferenceQuestionId();
    }

    return '';
  },

  getAdjustmentNoticeText(action) {
    if (action === 'budget') {
      return '好呀，我带你回到预算这里调整一下～';
    }

    if (action === 'distance') {
      return '明白，我带你回到距离这里重新选一下～';
    }

    if (action === 'category') {
      return '好，我们回到品类偏好这里重新挑一下～';
    }

    if (action === 'avoid') {
      return '收到，我带你回到忌口这里补充清楚～';
    }

    return '好呀，我带你回到口味偏好这里调整一下～';
  },

  findQuestionIdById(questionId) {
    const question = this.getQuestionList(this.data.session).find(function (item) {
      return item.id === questionId;
    });

    return question ? question.id : '';
  },

  findQuestionIdBySlot(slot) {
    const question = this.getQuestionList(this.data.session).find(function (item) {
      return item.slot === slot;
    });

    return question ? question.id : '';
  },

  findBranchPreferenceQuestionId() {
    return this.findQuestionIdBySlot('branchPreference');
  },

  replaySessionToIndex(targetIndex) {
    let session = foodAiAdapter.createInitialSession();
    const answerHistory = this.data.answerHistory.slice(0, targetIndex);

    for (let index = 0; index < targetIndex; index += 1) {
      if (answerHistory[index] === undefined) {
        break;
      }
      session = foodAiAdapter.answerQuestion(session, cloneAnswerForHistory(answerHistory[index]));
    }

    return { session, answerHistory };
  },

  getQuestionList(session) {
    if (session && session.resolvedQuestions && session.resolvedQuestions.length) {
      return session.resolvedQuestions;
    }

    const currentQuestion = foodAiAdapter.getNextQuestion(session);
    return currentQuestion ? [currentQuestion] : [];
  },

  restoreQuestionUiState(question, selectedOptions, selectedTags) {
    return {
      currentOptions: (question.kind === 'choice' || question.kind === 'multi-choice')
        ? this.formatQuestionOptions(question, selectedOptions)
        : [],
      tagGroups: question.kind === 'tag'
        ? this.formatTagGroups(question, selectedTags)
        : [],
      isTagQuestion: question.kind === 'tag'
    };
  },

  pruneManualInputs(manualInputs, questions, targetIndex) {
    const nextManualInputs = {};
    const safeManualInputs = manualInputs || {};

    questions.slice(0, targetIndex + 1).forEach(function (question) {
      if (safeManualInputs[question.id] !== undefined) {
        nextManualInputs[question.id] = safeManualInputs[question.id];
      }
    });

    return nextManualInputs;
  },

  buildPreferencesFromSelectedTags(question, manualAnswer) {
    const selectedTags = this.data.selectedTags;
    const tasteTags = tagConfig.getLabelsByIds(selectedTags.taste);
    const needTags = tagConfig.getLabelsByIds(selectedTags.need);
    const avoidTags = tagConfig.getLabelsByIds(selectedTags.avoid);
    const manualTags = String(manualAnswer || '').split(/[、,，/ ]+/).filter(function (item) {
      return !!item;
    });

    if (question && question.id === 'tag-preferences') {
      manualTags.forEach(function (tag) {
        if (needTags.indexOf(tag) < 0) {
          needTags.push(tag);
        }
      });
    }

    if (question && question.id === 'avoid-preferences') {
      manualTags.forEach(function (tag) {
        if (avoidTags.indexOf(tag) < 0) {
          avoidTags.push(tag);
        }
      });
    }

    return {
      tasteTags,
      needTags,
      avoidTags,
      spicyLevel: tagConfig.getLabelsByIds(selectedTags.spicyLevel)[0] || ''
    };
  },

  toggleAvoidTag(currentValues, tagId, selectedIndex) {
    const avoidNoneId = 'avoid_none';

    if (tagId === avoidNoneId) {
      return selectedIndex >= 0 ? [] : [avoidNoneId];
    }

    if (selectedIndex >= 0) {
      currentValues.splice(selectedIndex, 1);
      return currentValues;
    }

    return currentValues.filter(function (id) {
      return id !== avoidNoneId;
    }).concat([tagId]);
  },

  cloneSelectedTags(selectedTags) {
    return {
      taste: (selectedTags.taste || []).slice(),
      need: (selectedTags.need || []).slice(),
      avoid: (selectedTags.avoid || []).slice(),
      spicyLevel: (selectedTags.spicyLevel || []).slice()
    };
  },

  buildSlotSummaryText(slots, preferences) {
    const summaryItems = this.buildSummaryItems(slots, preferences);
    const collectedItems = summaryItems.filter(function (item) {
      return hasUsefulSlotValue(item.value);
    });
    const missingLabels = summaryItems.filter(function (item) {
      return !hasUsefulSlotValue(item.value);
    }).map(function (item) {
      return item.label;
    });

    if (!collectedItems.length) {
      return '需求状态：已收集 0/' + summaryItems.length;
    }

    const leadValue = slots.mealPurpose || collectedItems[0].value;
    const keyMissingLabels = ['预算', '距离'].filter(function (label) {
      return missingLabels.indexOf(label) >= 0;
    });
    const visibleMissingLabels = keyMissingLabels.length ? keyMissingLabels : missingLabels.slice(0, 2);

    if (visibleMissingLabels.length) {
      return '已记下：' + leadValue + ' · 还差' + visibleMissingLabels.join('、');
    }

    return '需求状态：已收集 ' + collectedItems.length + '/' + summaryItems.length;
  },

  buildSummaryItems(slots, preferences) {
    const safePreferences = preferences || {};

    return [
      {
        label: '就餐场景',
        value: slots.mealPurpose || ''
      },
      {
        label: '就餐偏好',
        value: slots.branchPreference || ''
      },
      {
        label: '口味偏好',
        value: (safePreferences.tasteTags || []).join('、')
      },
      {
        label: '想吃感觉',
        value: (safePreferences.needTags || []).join('、')
      },
      {
        label: '忌口',
        value: (safePreferences.avoidTags || []).join('、')
      },
      {
        label: '辣度',
        value: safePreferences.spicyLevel || ''
      },
      {
        label: '预算',
        value: slots.budget || ''
      },
      {
        label: '距离',
        value: slots.distance || ''
      }
    ];
  },

  buildSummaryFields(session) {
    const slots = session.slots || {};
    const preferences = session.preferences || {};
    const manualInputs = this.data.manualInputs || {};
    const currentIndex = session.questionIndex || 0;

    return this.getQuestionList(session).map(function (question, index) {
      return buildSummaryField(question, index, currentIndex, slots, preferences, manualInputs);
    }).filter(function (field) {
      return !!field;
    });
  },

  formatSlotItems(slots, preferences) {
    const safePreferences = preferences || {};

    return [
      {
        label: '就餐场景',
        value: slots.mealPurpose || '待补充'
      },
      {
        label: '就餐偏好',
        value: slots.branchPreference || '待补充'
      },
      {
        label: '口味偏好',
        value: (safePreferences.tasteTags || []).join('、') || '未选择'
      },
      {
        label: '想吃感觉',
        value: (safePreferences.needTags || []).join('、') || '未选择'
      },
      {
        label: '忌口',
        value: (safePreferences.avoidTags || []).join('、') || '未选择'
      },
      {
        label: '辣度',
        value: safePreferences.spicyLevel || '未选择'
      },
      {
        label: '预算',
        value: slots.budget || '待补充'
      },
      {
        label: '距离',
        value: slots.distance || '待补充'
      }
    ];
  },

  buildPreferenceRecord(session, recommendations) {
    const slots = session.slots || {};
    const preferences = session.preferences || {};

    return {
      createdAt: new Date().toISOString(),
      mealPurpose: slots.mealPurpose || '',
      branchPreference: slots.branchPreference || '',
      tasteTags: (preferences.tasteTags || []).slice(),
      needTags: (preferences.needTags || []).slice(),
      avoidTags: (preferences.avoidTags || []).slice(),
      spicyLevel: preferences.spicyLevel || '',
      budget: slots.budget || '',
      distance: slots.distance || '',
      manualInputs: Object.assign({}, this.data.manualInputs || {}),
      recommendations: (recommendations || []).slice(0, 3).map(function (item) {
        return {
          id: item.id || '',
          name: item.name || '',
          type: item.type || item.category || '',
          price: item.price || item.perCapita || '',
          distanceText: item.distanceText || item.distance || '',
          distanceMeters: item.distanceMeters || ''
        };
      }),
      summaryText: buildPreferenceRecordSummary(slots, this.data.manualInputs || {})
    };
  }
});

function formatAnswerBubbleText(answer, manualText, isTagAnswer) {
  const label = answer.label || '你的选择';
  const value = answer.value || '未选择';
  // Tag answers already have manual text merged into their structured value
  // via buildPreferencesFromSelectedTags — skip appending to avoid duplication.
  const displayValue = isTagAnswer ? value : combineWithManualNote(value, manualText);
  return label + '：' + displayValue;
}

function hasUsefulSlotValue(value) {
  return !!value && value !== '待补充' && value !== '未选择';
}

// Display-only helper. Combines a structured slot value with the user's free-form
// manual input as "structured；补充：manual". Submission/scoring code never goes
// through this — it only changes how bubbles, summary chips, and record summaries
// render. The substring check prevents duplication when the structured value
// already contains the manual text (e.g. tag-merged answers).
function combineWithManualNote(structuredValue, manualText) {
  const note = String(manualText || '').trim();
  if (!note) {
    return structuredValue;
  }
  if (!structuredValue || structuredValue === '未选择' || structuredValue === '待补充') {
    return note;
  }
  if (String(structuredValue).indexOf(note) >= 0) {
    return structuredValue;
  }
  return structuredValue + '；补充：' + note;
}

function buildPreferenceRecordSummary(slots, manualInputs) {
  const baseTokens = [slots.mealPurpose, slots.branchPreference, slots.budget, slots.distance]
    .filter(function (item) { return hasUsefulSlotValue(item); });
  const safeManualInputs = manualInputs || {};
  const manualNotes = Object.keys(safeManualInputs).map(function (id) {
    return String(safeManualInputs[id] || '').trim();
  }).filter(function (text) {
    return !!text;
  });

  const baseText = baseTokens.length ? baseTokens.join(' · ') : '';
  if (manualNotes.length) {
    const notesText = manualNotes.join('；');
    return baseText ? baseText + '；补充：' + notesText : '补充：' + notesText;
  }
  return baseText || '一次吃饭偏好';
}

function buildSummaryField(question, index, currentIndex, slots, preferences, manualInputs) {
  let label = '';
  let value = '';
  let isTagField = false;

  if (question.id === 'mealPurpose') {
    label = '就餐场景';
    value = slots.mealPurpose || '待补充';
  } else if (question.id === 'tag-preferences') {
    label = '口味偏好';
    value = buildTasteSummaryValue(preferences) || '未选择';
    isTagField = true;
  } else if (question.id === 'avoid-preferences') {
    label = '忌口';
    value = buildAvoidSummaryValue(preferences) || '未选择';
    isTagField = true;
  } else if (question.slot === 'branchPreference') {
    label = question.label || '就餐偏好';
    value = slots.branchPreference || '待补充';
  } else if (question.slot === 'budget') {
    label = '预算';
    value = slots.budget || '待补充';
  } else if (question.slot === 'distance') {
    label = '距离';
    value = slots.distance || '待补充';
  }

  if (!label) {
    return null;
  }

  // Tag fields already have manual tokens merged structurally — skip the suffix.
  const safeManualInputs = manualInputs || {};
  const manualText = question ? (safeManualInputs[question.id] || '') : '';
  const displayValue = isTagField ? value : combineWithManualNote(value, manualText);

  const isAvailable = index <= currentIndex;
  const isCollected = hasUsefulSlotValue(displayValue);
  const stateClass = isCollected ? 'collected' : 'pending';
  const disabledClass = isAvailable ? '' : ' disabled';

  return {
    label,
    value: displayValue,
    questionId: question.id,
    questionIndex: index,
    isAvailable,
    isCollected,
    fieldClass: stateClass + disabledClass,
    rowClass: disabledClass
  };
}

function buildTasteSummaryValue(preferences) {
  const safePreferences = preferences || {};
  return (safePreferences.tasteTags || []).concat(safePreferences.needTags || []).join('、');
}

function buildAvoidSummaryValue(preferences) {
  const safePreferences = preferences || {};
  const avoidText = (safePreferences.avoidTags || []).join('、');
  const spicyText = safePreferences.spicyLevel ? '辣度：' + safePreferences.spicyLevel : '';

  return [avoidText, spicyText].filter(function (item) {
    return !!item;
  }).join('，');
}

function cloneAnswerForHistory(answer) {
  if (!answer || typeof answer !== 'object') {
    return answer;
  }

  return JSON.parse(JSON.stringify(answer));
}

function areSameRecommendationIds(prevIds, nextIds) {
  if (prevIds.length !== nextIds.length) {
    return false;
  }

  return prevIds.every(function (id, index) {
    return id === nextIds[index];
  });
}

// mealPurpose keyword → canonical option (must match one of mealPurposeQuestion.options
// in services/foodAiAdapter.js). Aliases like 轻食/减脂 collapse to the same canonical
// so they are not flagged as conflicts when the user already selected that option.
var MEAL_PURPOSE_KEYWORD_MAP = {
  '早餐': '早餐',
  '午餐': '午餐',
  '晚餐': '晚餐',
  '下午茶': '下午茶',
  '夜宵': '夜宵',
  '随便吃点': '随便吃点',
  '轻食': '轻食/减脂',
  '减脂': '轻食/减脂',
  '没想法': '没想法'
};
var MEAL_PURPOSE_KEYWORDS = Object.keys(MEAL_PURPOSE_KEYWORD_MAP);

// Returns { keyword, canonical } for the first mealPurpose keyword found in text,
// or null if none matches. keyword is the raw substring (shown in modal text);
// canonical is the option-aligned value (used for structured submission).
function detectMealPurposeFromText(text) {
  if (!text) { return null; }
  for (var i = 0; i < MEAL_PURPOSE_KEYWORDS.length; i++) {
    var kw = MEAL_PURPOSE_KEYWORDS[i];
    if (text.indexOf(kw) >= 0) {
      return { keyword: kw, canonical: MEAL_PURPOSE_KEYWORD_MAP[kw] };
    }
  }
  return null;
}
