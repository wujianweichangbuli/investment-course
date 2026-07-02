# 投资基础交互课程

这是一个静态网页投资入门课程，当前覆盖 Day 1-14。

## 本地打开

直接打开 `index.html`，或在目录中启动本地服务器：

```bash
python3 -m http.server 8765
```

然后访问 `http://127.0.0.1:8765/`。

## 当前功能

- Day 1-14 正式课程内容
- 测试题、评分和答案解释
- 课程目录折叠
- 当前学习进度
- 概念和西班牙语词汇检索
- 本地浏览器进度保存

## 同步说明

当前版本支持两种模式：

- 未配置 Supabase：课程进度保存在浏览器本地。
- 配置 Supabase：登录后同步当前学习、完成状态、测验得分和界面状态。

计算器输入可能包含个人金额，默认不云同步；登录后可以在网页里手动开启。

## Supabase 配置

1. 创建 Supabase 项目。
2. 在 Supabase SQL Editor 中执行 `supabase-schema.sql`。
3. 复制 `supabase-config.example.js` 为 `supabase-config.js`。
4. 在 `supabase-config.js` 中填入项目 URL 和 anon key。
5. 在 Supabase Auth URL Configuration 中加入 GitHub Pages 地址和本地测试地址：

```text
https://wujianweichangbuli.github.io/investment-course/
http://127.0.0.1:8765/
http://localhost:8765/
```

anon key 是前端公开 key；进度表通过 Row Level Security 限制为用户只能读写自己的记录。

6. 提交并推送更新。
