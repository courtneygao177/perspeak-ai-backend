# PerspeakAI · Group Project MVP

可运行的 Level 1「Project Kickoff」多人协作模拟器。它实现了：观察协作信号、Social Awareness 小测、选择入场角色、专业化共享任务板、动态互动 moves、任务认领及 Replay & Coach。

## Start

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。

运行场景规则测试：

```bash
npm run test:scenario
```

## Current scope

当前为可接入 OpenAI-compatible 聚合 API 的 MVP。Level 1 的剧情推进由受控状态机决定；模型只负责生成同伴回应与评估用户原话。技能牌不会自动发言，且只有在用户选择当前技能、并用自己的话完成相应沟通动作时才会变为已使用。

关键规则位于 `server/scenario-engine.mjs`，包含：技能顺序、可达事件、证据校验和防跳关逻辑。真实 API 配置见 `.env.example`；没有配置时，场景入口会明确提示而不会伪造 AI 回复。
