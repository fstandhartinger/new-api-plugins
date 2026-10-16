---
changelogVersion: 1
plugin: "decisionmodels"
version: "1.0.0"
locale: "zh-CN"
---
# Changelog

## [1.0.0]

### Added

- 现在可以通过 New API 调用 Decision Models 的 `s1-fast`、`s1-pro`、`quyet-1-large` 和 `s1-llm-auto-router`。该插件用于兼容 Jev 的结构化判断：发送状态和带名称的 Choice、Score 或 Noul 问题，即可获得带概率的结构化答案。
- 同一请求可发往两个路径：`POST /decisionmodels/v1/systemone`，或 `POST /v1/systemone`，这样 SDK 可以直接把网关根地址作为 base URL。渠道的 base URL 为 `https://api.decisionmodels.io`。
- 将 Decision Models API 密钥作为渠道密钥。输出 token 免费，只对输入 token 计费。
- 每个问题最多接受 8,192 个输入 token（包含状态）。`s1-fast` 和 `quyet-1-large` 每次请求一个问题，`s1-pro` 最多三个，`s1-llm-auto-router` 为其固定的七个路由问题。网关为每个问题预留 8,192 个输入 token，并按 Decision Models 返回的用量结算。
- Decision Models 的错误会以其原有格式返回给客户端，例如 `{"error": {"code": "invalid_api_key"}}`。

### Migration

- 为每个要提供的模型设置价格，使用任务用量表达式计费。Decision Models 在其 Peer-to-Peer 层级按每百万输入 token 收取以下美元价格（EU 层级略高，见 `GET https://api.decisionmodels.io/v1/models`）：`s1-fast` 0.019，`s1-pro` 0.08，`quyet-1-large` 0.035，`s1-llm-auto-router` 0.001。以 `s1-fast` 为例，表达式为 `tier("base", u("input_tokens") * 0.019 / 1000000)`。
