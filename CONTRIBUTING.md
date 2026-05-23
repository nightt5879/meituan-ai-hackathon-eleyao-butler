# 贡献规范

## Pull Request 关联 Issue 规则

每个 Pull Request 都必须在 PR 描述里使用 GitHub closing keyword 关联它要完成的 issue。

可接受示例：

```md
Closes #23
Fixes #23
Resolves #23
```

规则：

- closing keyword 必须写在 PR body，不要只写在评论里。
- 必须填写具体 issue 编号；模板里的 `Closes #` 占位符不算合格。
- 如果还没有对应 issue，请先开 issue，再开 PR。
- 缺少 `Closes #xx`、`Fixes #xx` 或 `Resolves #xx` 的 PR 会触发检查失败，并收到 bot 评论说明如何修正。

这个规则用于保证需求、实现、review 和最终关闭都能在 GitHub 里追踪起来。
