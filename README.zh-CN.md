<div align="right">

[English](README.md) | **简体中文**

</div>

# PerspeakAI — AI 演讲教练

在真正上台**之前**，先把演讲练到位。PerspeakAI 是面向非英语母语者的 AI 演讲模拟器：上传幻灯片、选择台下坐着谁、开口演讲——然后像真实场景一样被打断、被追问、被打分。

## 功能

- **真实幻灯片解析** — 上传 PDF / PPT / PPTX，页面本地解析（PyMuPDF / python-pptx）；开启 AI 后，PDF 页面还会经视觉模型分析出标题、摘要与核心论点。
- **可配置的模拟** — 选择听众（**教授** / **同学** / **风险投资人**）、场景（**课堂展示** / **论文答辩** / **MBA 案例路演**）和难度（**简单** / **中等** / **困难**）。
- **实时演练舱** — 幻灯片浏览、计时器，语音旁白由浏览器原生 Web Speech API 采集（无需任何 API key）。
- **中途打断挑战** — MBA 案例路演模式下，AI 考官会在演讲中途切入发起针对性质询，并动态追问最多 2 轮。
- **演讲后问答** — 课堂展示使用双轨题库（1 道 AI 自由提问 + 1 道锚定题）；论文答辩按难度从答辩题库抽取 3 / 5 / 8 道题，每道题都会结合你的实际幻灯片内容定制。
- **发音诊断**（可选）— 每页幻灯片的音频经 SpeechAce API 做音素级打分，并可用 DashScope 生成 TTS 发音示范。
- **多维评估** — 三条评估管线并行运行（演讲质量支柱、沟通质量、逐页内容质量），汇总为带雷达图/柱状图（Chart.js）的报告和 4 周训练计划。
- **Mock 模式** — 以上全部功能都能优雅降级：**不配置任何 API key**，完整 9 步流程也能用内置模拟数据端到端跑通。

## 快速开始

需要 Python 3.11+。

```bash
pip install -r artifacts/ai-presentation/requirements.txt
python artifacts/ai-presentation/app.py
# 打开 http://localhost:8000
```

就这么简单——不设任何环境变量即为 mock 模式。要启用真实 AI，启动前配置下面的变量。

## 配置

所有 AI 调用走同一个 **OpenAI 兼容端点**（OpenAI 官方或任意中转/代理均可），并按步骤路由到不同模型。

| 变量 | 是否必需 | 用途 |
|---|---|---|
| `UNIFIED_API_KEY` | 启用真实 AI 时必需 | OpenAI 兼容端点的 API key |
| `UNIFIED_BASE_URL` | 启用真实 AI 时必需 | 端点地址，如 `https://api.openai.com/v1` |
| `VISION_MODEL` | 可选 | 幻灯片视觉分析（默认 `claude-sonnet-5`） |
| `TEXT_MODEL` | 可选 | 出题/推理（默认 `gpt-4o`） |
| `EVAL_MODEL` | 可选 | 长上下文评估（默认 `gemini-2.5-flash`） |
| `SESSION_SECRET` | 建议设置 | Flask session 签名密钥 |
| `SPEECHACE_API_KEY` | 可选 | 发音打分（[SpeechAce](https://www.speechace.com/)） |
| `SPEECHACE_REGION` | 可选 | `singapore`（默认）或 `us` |
| `QWEN_API_KEY` | 可选 | DashScope TTS 发音示范 |

## 一次演练的流程

1. **上传**幻灯片 → 立即解析出页数和标题。
2. **配置**听众 / 场景 / 难度。
3. 在演练舱里**开讲**：每页用语音或键盘输入旁白。
4. 根据场景不同，考官会**中途打断**你，或在**演讲后问答**环节连环追问。
5. **结束** → 三条评估引擎并行运行。
6. **报告**：各维度得分、逐题反馈、发音诊断和个性化训练计划。

## 项目结构

```
artifacts/ai-presentation/   ← Flask 应用本体
├── app.py                   # 路由、状态机、评估引擎
├── audio_engine.py          # SpeechAce 打分 + DashScope TTS
├── config/                  # 论文答辩题库
└── templates/               # Jinja2 页面（Tailwind CSS + 原生 JS）
```

仓库其余部分（`lib/`、`scripts/`、其他 `artifacts/`）是原开发环境的工作区脚手架，运行本应用不需要它们。

## 技术栈

Flask 3 · Jinja2 + Tailwind CSS（CDN）+ 原生 JS · Chart.js · PyMuPDF · python-pptx · Web Speech API。无数据库——session 状态 + 磁盘 JSON 文件。
