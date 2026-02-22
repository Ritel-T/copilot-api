import { randomUUID } from "node:crypto"

import { events } from "fetch-event-stream"
import type { SSEMessage } from "hono/streaming"

import { copilotBaseUrl, copilotHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state as globalState } from "~/lib/state"
import type { State } from "~/lib/state"

import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionsPayload,
} from "./create-chat-completions"

/**
 * Handles models whose supported_endpoints is ["/responses"] (e.g. gpt-5.x-codex).
 * Translates Chat Completions ↔ OpenAI Responses API transparently so callers
 * always see standard Chat Completions format.
 *
 * Accepts an optional `st` so it can be used from both single-instance mode
 * (no argument → uses module-level state) and console mode (pass the per-account state).
 */
export const createResponsesAsCompletions = async (
  payload: ChatCompletionsPayload,
  st?: State,
): Promise<ChatCompletionResponse | AsyncIterable<SSEMessage>> => {
  const activeState = st ?? globalState
  if (!activeState.copilotToken) throw new Error("Copilot token not found")

  const responseId = `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 10)}`
  const created = Math.floor(Date.now() / 1000)

  // --- translate request ---
  const requestBody: Record<string, unknown> = {
    model: payload.model,
    input: payload.messages,
    stream: payload.stream ?? false,
  }
  if (payload.max_tokens != null) requestBody.max_output_tokens = payload.max_tokens
  if (payload.temperature != null) requestBody.temperature = payload.temperature
  if (payload.top_p != null) requestBody.top_p = payload.top_p
  if (payload.tools?.length) {
    // Responses API tool format is flat (no nested "function" wrapper)
    requestBody.tools = payload.tools.map((t) => ({
      type: "function",
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }))
  }
  if (payload.tool_choice != null) requestBody.tool_choice = payload.tool_choice

  const enableVision = payload.messages.some(
    (x) =>
      typeof x.content !== "string" &&
      x.content?.some((x) => x.type === "image_url"),
  )
  const isAgentCall = payload.messages.some((msg) =>
    ["assistant", "tool"].includes(msg.role),
  )

  const headers: Record<string, string> = {
    ...copilotHeaders(activeState, enableVision),
    "X-Initiator": isAgentCall ? "agent" : "user",
  }

  const response = await fetch(`${copilotBaseUrl(activeState)}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new HTTPError("Failed to create response (Responses API)", response)
  }

  if (payload.stream) {
    return translateStream(response, responseId, created, payload.model)
  }

  const data = (await response.json()) as ResponsesApiResponse
  return translateNonStreaming(data, responseId, created)
}

// ─── streaming translation ────────────────────────────────────────────────────

async function* translateStream(
  response: Response,
  responseId: string,
  created: number,
  model: string,
): AsyncIterable<SSEMessage> {
  for await (const event of events(response)) {
    if (!event.data || event.data === "[DONE]") continue

    let data: Record<string, unknown>
    try {
      data = JSON.parse(event.data) as Record<string, unknown>
    } catch {
      continue
    }

    const eventType = event.event

    if (eventType === "response.output_text.delta") {
      const delta = (data as { delta: string }).delta
      const chunk: ChatCompletionChunk = {
        id: responseId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [
          {
            index: 0,
            delta: { content: delta },
            finish_reason: null,
            logprobs: null,
          },
        ],
      }
      yield { data: JSON.stringify(chunk) }
    } else if (eventType === "response.function_call_arguments.delta") {
      // Tool call argument streaming
      const ev = data as { delta: string; call_id: string; output_index: number }
      const chunk: ChatCompletionChunk = {
        id: responseId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: ev.output_index ?? 0,
                  function: { name: "", arguments: ev.delta },
                },
              ],
            },
            finish_reason: null,
            logprobs: null,
          },
        ],
      }
      yield { data: JSON.stringify(chunk) }
    } else if (eventType === "response.output_item.added") {
      // Signal start of a tool call: emit the function name
      const item = (data as { item: ResponseOutputItem }).item
      if (item?.type === "function_call") {
        const chunk: ChatCompletionChunk = {
          id: responseId,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: data.output_index as number ?? 0,
                    id: `call_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
                    type: "function",
                    function: { name: item.name ?? "", arguments: "" },
                  },
                ],
              },
              finish_reason: null,
              logprobs: null,
            },
          ],
        }
        yield { data: JSON.stringify(chunk) }
      }
    } else if (eventType === "response.completed") {
      const completed = data as { response: ResponsesApiResponse }
      const usage = completed.response?.usage
      // Check if response ended due to tool calls
      const hasToolCalls = completed.response?.output?.some(
        (item) => item.type === "function_call",
      )
      const chunk: ChatCompletionChunk = {
        id: responseId,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: hasToolCalls ? "tool_calls" : "stop",
            logprobs: null,
          },
        ],
        ...(usage && {
          usage: {
            prompt_tokens: usage.input_tokens,
            completion_tokens: usage.output_tokens,
            total_tokens: usage.total_tokens,
          },
        }),
      }
      yield { data: JSON.stringify(chunk) }
      yield { data: "[DONE]" }
    }
  }
}

// ─── non-streaming translation ────────────────────────────────────────────────

function translateNonStreaming(
  data: ResponsesApiResponse,
  responseId: string,
  created: number,
): ChatCompletionResponse {
  let content = ""
  const toolCalls: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }> = []

  for (const item of data.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text") {
          content += part.text
        } else if (part.type === "tool_use") {
          toolCalls.push({
            id: `call_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
            type: "function",
            function: {
              name: part.name ?? "",
              arguments: typeof part.input === "string"
                ? part.input
                : JSON.stringify(part.input ?? {}),
            },
          })
        }
      }
    } else if (item.type === "function_call") {
      toolCalls.push({
        id: `call_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
        type: "function",
        function: {
          name: item.name ?? "",
          arguments: item.arguments ?? "{}",
        },
      })
    }
  }

  return {
    id: responseId,
    object: "chat.completion",
    created,
    model: data.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: content || null,
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        },
        logprobs: null,
        finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
      },
    ],
    ...(data.usage && {
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.total_tokens,
      },
    }),
  }
}

// ─── Responses API types ──────────────────────────────────────────────────────

interface ResponsesApiResponse {
  id: string
  object: "response"
  model: string
  status: string
  output?: Array<ResponseOutputItem>
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

type ResponseOutputItem =
  | {
      type: "message"
      role: string
      content?: Array<
        | { type: "output_text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
      >
    }
  | {
      type: "function_call"
      name?: string
      arguments?: string
    }
