// Decision Models System One API: https://api.decisionmodels.io/openapi.json
// The API takes the TypeSafe System One request shape (model, state, questions
// keyed by name) and reads at most 8,192 input tokens per question, state
// included (GET /v1/models, max_input_tokens). s1-fast and quyet-1-large take
// one question per request, s1-pro up to three, and s1-llm-auto-router its
// seven fixed routing questions. A request therefore reserves at most 8,192
// tokens per question; completion replaces the reservation with the
// usage.input_tokens the API reports. Output tokens are free.
const MAX_INPUT_TOKENS_PER_QUESTION = 8192;
const MAX_QUESTIONS = 7;
const MODELS = ["s1-fast", "s1-pro", "quyet-1-large", "s1-llm-auto-router"];
// The API rejects any other top-level request member. Images (the images
// member and /v1/multimodal) are not supported by this plugin.
const REQUEST_FIELDS = ["model", "state", "questions"];

export const meta = {
  apiVersion: 1,
  key: "decisionmodels",
  name: "Decision Models",
  sortPriority: 100,
  version: "1.0.0",
  icon: "text:DM",
  author: { name: "Decision Models", url: "https://decisionmodels.io" },
  website: "https://decisionmodels.io",
  description: {
    en: "Typed decisions with Decision Models (Jev-compatible System One), input priced per million tokens and output free",
    zh: "Decision Models 结构化判断（兼容 Jev 的 System One 接口），输入按每百万 token 定价，输出免费",
  },
  baseUrl: "https://api.decisionmodels.io",
  auth: "api_key",
  models: MODELS,
  upstreams: ["vendor", "new_api"],
  // The models read the state object as written, so member order can change
  // their answers; the host keeps the client's order only for plugins that ask.
  requiredCapabilities: ["json-order@1"],
  fetchMode: "per_task",
  routes: [
    {
      method: "POST",
      path: "/decisionmodels/v1/systemone",
      type: "submit",
      decode: "decodeSystemOne",
      render: "renderSystemOne",
      retainResult: false,
    },
    // The vendor path, so SDK clients can use the gateway root as base URL.
    {
      method: "POST",
      path: "/v1/systemone",
      type: "submit",
      decode: "decodeSystemOne",
      render: "renderSystemOne",
      retainResult: false,
    },
  ],
  usageSchema: {
    input_tokens: {
      type: "number",
      unit: "token",
      description: { en: "Input token unit price", zh: "输入 token 单价" },
    },
  },
  usageExamples: [{ label: "Decision Models", facts: { input_tokens: 1000 } }],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Instructions, Choice option descriptions and Noul outcomes may be null; the
// state and Score levels may not (https://api.decisionmodels.io/openapi.json).
function isEntry(value) {
  return value === null || typeof value === "string" || typeof value === "object";
}

function validateRequest(body) {
  if (!isObject(body)) throw new Error("Request body must be a JSON object");
  for (const field of Object.keys(body)) {
    if (!REQUEST_FIELDS.includes(field)) throw new Error("Decision Models System One does not accept the request field " + field);
  }
  if (typeof body.model !== "string" || !body.model.trim()) throw new Error("model is required");
  if (body.state === null || !isEntry(body.state)) throw new Error("state must be text, an object, or an array");
  if (!isObject(body.questions) || Object.keys(body.questions).length === 0 || Object.keys(body.questions).length > MAX_QUESTIONS)
    throw new Error("questions must be an object with 1 to " + MAX_QUESTIONS + " questions");

  for (const id of Object.keys(body.questions)) {
    const question = body.questions[id];
    if (!isObject(question) || !["choice", "score", "noul"].includes(question.type))
      throw new Error("Each question must have type choice, score, or noul");
    if (question.instructions !== undefined && !isEntry(question.instructions))
      throw new Error("Question instructions must be text, an object, an array, or null");

    const criteria = question.criteria;
    if (question.type === "choice") {
      if (!isObject(criteria) || Object.keys(criteria).length === 0 || Object.keys(criteria).length > 255)
        throw new Error("Choice criteria must contain between 1 and 255 options");
      if (
        Object.values(criteria).some(function (value) {
          return !isEntry(value);
        })
      )
        throw new Error("Choice option descriptions must be text, objects, arrays, or null");
    } else if (question.type === "score") {
      if (!Array.isArray(criteria) || criteria.length < 1 || criteria.length > 10) throw new Error("Score criteria must contain between 1 and 10 levels");
      if (
        criteria.some(function (value) {
          return value === null || !isEntry(value);
        })
      )
        throw new Error("Score levels must be text, objects, or arrays");
    } else if (question.type === "noul" && criteria != null) {
      if (
        !isObject(criteria) ||
        [criteria.true, criteria.false].some(function (value) {
          return value !== undefined && !isEntry(value);
        })
      )
        throw new Error("Noul criteria must describe true and false with text, objects, arrays, or null");
    }
  }
  return body;
}

function systemOneBody(body, model) {
  return { model: model, state: body.state, questions: body.questions };
}

function systemOneRequest(ctx) {
  const body = validateRequest(ctx.requestBody);
  const model = ctx.upstreamModel || ctx.model;
  if (!MODELS.includes(model)) throw new Error("Unsupported Decision Models model; use a declared model or map an alias to it");
  return systemOneBody(body, model);
}

export function buildSubmitRequest(ctx) {
  const body = systemOneRequest(ctx);
  let baseUrl = ctx.baseUrl.replace(/\/+$/, "");
  // Accept channel base URLs with an optional /v1 suffix.
  if (baseUrl.endsWith("/v1")) baseUrl = baseUrl.slice(0, -3);
  const prefix = ctx.upstream && ctx.upstream.kind === "new_api" ? "/decisionmodels" : "";
  return {
    url: baseUrl + prefix + "/v1/systemone",
    method: "POST",
    headers: {
      Authorization: "Bearer " + ctx.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body,
  };
}

export function parseSubmitResponse(ctx, response) {
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error("Decision Models returned HTTP " + response.statusCode);
  const body = response.body;
  if (!isObject(body) || typeof body.model !== "string" || !body.model || !isObject(body.answers))
    throw new Error("Decision Models response is missing model or answers");
  for (const id of Object.keys(ctx.requestBody.questions)) {
    const answer = Object.prototype.hasOwnProperty.call(body.answers, id) ? body.answers[id] : null;
    if (!isObject(answer) || answer.type !== ctx.requestBody.questions[id].type)
      throw new Error("Decision Models response is missing a matching answer for a question");
  }
  if (!ctx.publicTaskId) throw new Error("Missing gateway request ID");
  return {
    taskId: ctx.publicTaskId,
    taskData: body,
    immediate: { status: "SUCCESS", progress: "100%" },
  };
}

export function extractUsage(ctx) {
  const body = systemOneRequest(ctx);
  if (ctx.usagePurpose === "billing_ratios") return null;
  return { input_tokens: MAX_INPUT_TOKENS_PER_QUESTION * Object.keys(body.questions).length };
}

export function extractUsageOnComplete(ctx, result, body) {
  const tokens = body && body.usage && body.usage.input_tokens;
  // Throwing preserves the reservation and makes the host log invalid usage.
  // Never coerce a missing/invalid value to zero or bill free output tokens.
  if (!Number.isInteger(tokens) || tokens < 0 || tokens > MAX_INPUT_TOKENS_PER_QUESTION * MAX_QUESTIONS)
    throw new Error("Decision Models input token usage is missing or outside the supported context budget");
  return { input_tokens: tokens };
}

// API v1 requires polling hooks, but System One always completes synchronously.
export function buildQueryRequest() {
  throw new Error("Decision Models System One has no task retrieval endpoint");
}

export function parseTaskResult() {
  return { status: "UNKNOWN", reason: "Decision Models System One has no asynchronous tasks" };
}

export const native = {
  decodeSystemOne: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = validateRequest(ctx.body.value);
    return {
      kind: "submit",
      model: body.model,
      action: "systemone",
      requestBody: systemOneBody(body, body.model),
    };
  },
  renderSystemOne: function (ctx, task) {
    return task.data;
  },
  error: function (ctx, error) {
    // An error from Decision Models reaches the client in its own shape,
    // {"error": {"code", "message", ...}}.
    try {
      const body = JSON.parse(error.message);
      if (isObject(body) && (body.error !== undefined || body.detail !== undefined)) return body;
    } catch (parseError) {
      // Gateway errors are sentences, not Decision Models JSON.
    }
    return { error: { message: error.message } };
  },
};
