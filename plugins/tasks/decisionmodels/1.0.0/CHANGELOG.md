---
changelogVersion: 1
plugin: "decisionmodels"
version: "1.0.0"
locale: "en"
translations:
  zh-CN: "CHANGELOG.zh-CN.md"
---
# Changelog

## [1.0.0]

### Added

- Call Decision Models from New API with `s1-fast`, `s1-pro`, `quyet-1-large` and `s1-llm-auto-router`. The plugin is for Jev-compatible typed decisions: send a state and named Choice, Score or Noul questions and get typed answers with probabilities.
- Use the same request in two places: `POST /decisionmodels/v1/systemone`, or `POST /v1/systemone` so SDKs can use the gateway root as their base URL. The channel base URL is `https://api.decisionmodels.io`.
- Pass a Decision Models API key as the channel key. Output tokens are free, so only input tokens are billed.
- Each question accepts at most 8,192 input tokens, state included. `s1-fast` and `quyet-1-large` take one question per request, `s1-pro` up to three, and `s1-llm-auto-router` its seven fixed routing questions. The gateway reserves 8,192 input tokens per question and settles on the usage Decision Models reports.
- Errors from Decision Models reach clients in its format, for example `{"error": {"code": "invalid_api_key"}}`.

### Migration

- Set a price for each model you offer, using task usage expression billing. Decision Models charges these input prices per 1 million tokens in USD on its Peer-to-Peer tier (the EU tier costs slightly more, see `GET https://api.decisionmodels.io/v1/models`): `s1-fast` 0.019, `s1-pro` 0.08, `quyet-1-large` 0.035 and `s1-llm-auto-router` 0.001. For `s1-fast` the expression is `tier("base", u("input_tokens") * 0.019 / 1000000)`.
