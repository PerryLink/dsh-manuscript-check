# dsh-manuscript-check

**投稿前：稿件是否完整、指南要求报告的内容是否都报告了、投稿包是否真的打齐了？**

*基于关键词的检查清单，附定位与建议：结构与声明、起步版 CONSORT / STROBE / PRISMA 条目覆盖，以及投稿目录扫描。*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24.9-brightgreen.svg)]()

[English](README.md) · 简体中文

---

## 它做什么

- **`manuscript_check`** —— 识别标题/摘要/引言/方法/结果/讨论/结论，以及常见声明（伦理、知情同意、资助、利益冲突、数据可用性、贡献、注册），并检查一套指南（默认 `manuscript`，也可为 `consort`、`strobe`、`prisma`，或由措辞自动判断的 `auto`）。缺失项附带建议；已存在的项会给出命中的字符区间。
- **`reporting_check`** —— 一次检查多套指南，输出一份扁平化缺失项列表，可直接粘贴到投稿检查清单。
- **`submission_pack`** —— 扫描投稿目录中的稿件、cover letter、编号图（能发现编号断档）、表格、补充材料与声明；写出 JSON + Markdown 材料包报告。

## 它不做什么

- **不做合规判定。** 是否存在由关键词模式判断。换个说法写的声明可能被漏掉，而关键词出现也不等于内容充分。README、工具描述和每一份报告都会说明这一点。
- **不解析 PDF/DOCX。** 请先转换为 `.md`/`.txt`/`.tex`，或用 `dsh-doc-anchor` 抽取 PDF 文本。
- **不完整复刻指南。** 这些是起步清单（14–18 项），不是经认证的 CONSORT/STROBE/PRISMA 清单。
- **不上传、不转换、不改名。** 材料包扫描只报告，绝不移动文件。
- **不包含期刊特定规则**（字数限制、参考文献格式）：这些属于期刊 profile，不属于本插件。

## 覆盖目标

| 指南 | 条目数 | 目标 |
|---|---:|---:|
| `manuscript`（结构 + 声明） | 14 | 80% |
| `consort`（起步版） | 18 | 75% |
| `strobe`（起步版） | 16 | 75% |
| `prisma`（起步版） | 17 | 75% |

覆盖率低于目标时会标为“below target”；这不是错误。

## 工具

### `manuscript_check`

`{ text? | path?, guideline?, persist? }` → `{ ok, analysis, evidenceId?, recordPath? }`。
`analysis = { sections, missingCoreSections, wordCount, results[], notes }`。

### `reporting_check`

`{ text? | path?, guidelines?: string[] }` → `{ ok, analysis, missing[], evidenceId? }`。

### `submission_pack`

`{ path?, recursive? }` → `{ ok, pack, exports: {json, markdown} }`。

### 错误码

`INVALID_INPUT` · `NOT_FOUND` · `PATH_ESCAPE` · `NOT_A_FILE` · `NOT_A_DIRECTORY` · `TOO_LARGE` · `UNSUPPORTED_FILE` · `STORE_ERROR`

## 兼容性与安装

| | |
|---|---|
| DeepSeek Harness | **`dsh-v0.2.1-rc.5`**（2026-11-08 实测）；peer `>=0.2.1-0 <0.3.0 \|\| >=0.2.2-0 <0.3.0` |
| Node | `^22.19.0 \|\| >=24.9.0`（实测 `24.22.1`），仅 ESM |
| Peer 依赖 | `@perrylink/dsh-research-core ^0.1.0`、`@deepseek-ai/cordis ^4.0.5-alpha.1`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery ^3.18.5-alpha.1` |
| 运行时依赖 | **零** |

```sh
dsh plugin --profile <name> add @perrylink/dsh-research-core dsh-manuscript-check
dsh --profile <name> --dump-config | grep dsh-manuscript-check
```

## 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | `false` 时不挂载任何内容 |
| `root` | `.manuscript-check` | 存储、记录与导出的根目录 |
| `workspaceRoot` | `process.cwd()` | 稿件路径必须解析到该目录内 |
| `maxChars` | `2000000` | 硬上限（超限即失败；绝不截断） |
| `persist` | `true` | 将被检查的文本存为 REP 证据并写入记录 |

## 安全边界

- 对稿件只读；唯一的写入发生在 `root` 下。
- 用 `realpath` 做路径包含校验（拒绝符号链接逃逸）。
- 字符数上限会显式失败，而不是截断；文件在读取前先按字节上限校验，因此超大文件无法耗尽内存。
- PDF/DOCX 会以明确提示拒绝，而不是不安全地解析。

## 评测

**20 个测试**：章节切分（markdown + 纯文本 + markdown 标题/纯文本章节混排）、指南覆盖（完整的 CONSORT 风格 fixture ≥90%、缺失项带建议、定位信息）、自动识别、指南目录、材料包扫描（完整材料包、图表编号断档、声明缺失、没有稿件时判定未就绪）、运行时（REP 记录合法性、auto 指南 + 文件读取、路径遍历/二进制/超大文件拒绝（含读取前字节上限）、材料包导出）、tools（schema、扁平缺失列表、失败分支）、包契约。

不声称基准测试结果：这是一份基于规则的检查清单，其真值应是“人工是否也发现了同样的条目”，这需要一套单独裁决的语料。十份合成稿件是下一步自然的基准测试集；在此之前，单元 fixture 就是证据。

## 已知限制（v0.1）

- 关键词检测：措辞不同 → 误报“缺失”；关键词出现 → 也不代表内容充分。
- 只有英文线索词；中文稿件需要自己的线索词表。
- 不含期刊特定要求（字数、参考文献格式、ORCID、投稿系统元数据）。
- 材料包扫描受深度限制，且依据文件名；内嵌表格无法识别。

## 许可

Apache-2.0。运行时不含第三方代码。
