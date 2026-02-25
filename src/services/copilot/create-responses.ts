import { randomUUID } from "node:crypto"

import consola from "consola"
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

// ─── Responses API Types (from caozhiyuan/all) ───────────────────────────────

export interface ResponsesPayload {
  model: string
  instructions?: string | null
  input?: string | Array<ResponseInputItem>
  tools?: Array<Tool> | null
  tool_choice?: ToolChoiceOptions | ToolChoiceFunction
  temperature?: number | null
  top_p?: number | null
  max_output_tokens?: number | null
  metadata?: Metadata | null
  stream?: boolean | null
  safety_identifier?: string | null
  prompt_cache_key?: string | null
  parallel_tool_calls?: boolean | null
  store?: boolean | null
  reasoning?: Reasoning | null
  include?: Array<ResponseIncludable>
  service_tier?: string | null // NOTE: Unsupported by GitHub Copilot
  [key: string]: unknown
}

export type ToolChoiceOptions = "none" | "auto" | "required"

export interface ToolChoiceFunction {
  name: string
  type: "function"
}

export type Tool = FunctionTool | Record<string, unknown>

export interface FunctionTool {
  name: string
  parameters: { [key: string]: unknown } | null
  strict: boolean | null
  type: "function"
  description?: string | null
}

export type ResponseIncludable =
  | "file_search_call.results"
  | "message.input_image.image_url"
  | "computer_call_output.output.image_url"
  | "reasoning.encrypted_content"
  | "code_interpreter_call.outputs"

export interface Reasoning {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null
  summary?: "auto" | "concise" | "detailed" | null
}

export interface ResponseInputMessage {
  type?: "message"
  role: "user" | "assistant" | "system" | "developer"
  content?: string | Array<ResponseInputContent>
  status?: string
  phase?: "commentary" | "final_answer"
}

export interface ResponseFunctionToolCallItem {
  type: "function_call"
  call_id: string
  name: string
  arguments: string
  status?: "in_progress" | "completed" | "incomplete"
}

export interface ResponseFunctionCallOutputItem {
  type: "function_call_output"
  call_id: string
  output: string | Array<ResponseInputContent>
  status?: "in_progress" | "completed" | "incomplete"
}

export interface ResponseInputReasoning {
  id?: string
  type: "reasoning"
  summary: Array<{
    type: "summary_text"
    text: string
  }>
  encrypted_content: string
}

export type ResponseInputItem =
  | ResponseInputMessage
  | ResponseFunctionToolCallItem
  | ResponseFunctionCallOutputItem
  | ResponseInputReasoning
  | Record<string, unknown>

export type ResponseInputContent =
  | ResponseInputText
  | ResponseInputImage
  | Record<string, unknown>

export interface ResponseInputText {
  type: "input_text" | "output_text"
  text: string
}

export interface ResponseInputImage {
  type: "input_image"
  image_url?: string | null
  file_id?: string | null
  detail: "low" | "high" | "auto"
}

export interface ResponsesResult {
  id: string
  object: "response"
  created_at: number
  model: string
  output: Array<ResponseOutputItem>
  output_text: string
  status: string
  usage?: ResponseUsage | null
  error: ResponseError | null
  incomplete_details: IncompleteDetails | null
  instructions: string | null
  metadata: Metadata | null
  parallel_tool_calls: boolean
  temperature: number | null
  tool_choice: unknown
  tools: Array<Tool>
  top_p: number | null
}

export type Metadata = { [key: string]: string }

export interface IncompleteDetails {
  reason?: "max_output_tokens" | "content_filter"
}

export interface ResponseError {
  message: string
}

export type ResponseOutputItem =
  | ResponseOutputMessage
  | ResponseOutputReasoning
  | ResponseOutputFunctionCall

export interface ResponseOutputMessage {
  id: string
  type: "message"
  role: "assistant"
  status: "completed" | "in_progress" | "incomplete"
  content?: Array<ResponseOutputContentBlock>
}

export interface ResponseOutputReasoning {
  id: string
  type: "reasoning"
  summary?: Array<ResponseReasoningBlock>
  encrypted_content?: string
  status?: "completed" | "in_progress" | "incomplete"
}

export interface ResponseReasoningBlock {
  type: string
  text?: string
}

export interface ResponseOutputFunctionCall {
  id?: string
  type: "function_call"
  call_id: string
  name: string
  arguments: string
  status?: "in_progress" | "completed" | "incomplete"
}

export type ResponseOutputContentBlock =
  | ResponseOutputText
  | ResponseOutputRefusal
  | Record<string, unknown>

export interface ResponseOutputText {
  type: "output_text"
  text: string
  annotations: Array<unknown>
}

export interface ResponseOutputRefusal {
  type: "refusal"
  refusal: string
}

export interface ResponseUsage {
  input_tokens: number
  output_tokens?: number
  total_tokens: number
  input_tokens_details?: {
    cached_tokens: number
  }
  output_tokens_details?: {
    reasoning_tokens: number
  }
}

export type ResponseStreamEvent =
  | ResponseCompletedEvent
  | ResponseIncompleteEvent
  | ResponseCreatedEvent
  | ResponseErrorEvent
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseFunctionCallArgumentsDoneEvent
  | ResponseFailedEvent
  | ResponseOutputItemAddedEvent
  | ResponseOutputItemDoneEvent
  | ResponseReasoningSummaryTextDeltaEvent
  | ResponseReasoningSummaryTextDoneEvent
  | ResponseTextDeltaEvent
  | ResponseTextDoneEvent

export interface ResponseCompletedEvent {
  response: ResponsesResult
  sequence_number: number
  type: "response.completed"
}

export interface ResponseIncompleteEvent {
  response: ResponsesResult
  sequence_number: number
  type: "response.incomplete"
}

export interface ResponseCreatedEvent {
  response: ResponsesResult
  sequence_number: number
  type: "response.created"
}

export interface ResponseErrorEvent {
  code: string | null
  message: string
  param: string | null
  sequence_number: number
  type: "error"
}

export interface ResponseFunctionCallArgumentsDeltaEvent {
  delta: string
  item_id: string
  output_index: number
  sequence_number: number
  type: "response.function_call_arguments.delta"
}

export interface ResponseFunctionCallArgumentsDoneEvent {
  arguments: string
  item_id: string
  name: string
  output_index: number
  sequence_number: number
  type: "response.function_call_arguments.done"
}

export interface ResponseFailedEvent {
  response: ResponsesResult
  sequence_number: number
  type: "response.failed"
}

export interface ResponseOutputItemAddedEvent {
  item: ResponseOutputItem
  output_index: number
  sequence_number: number
  type: "response.output_item.added"
}

export interface ResponseOutputItemDoneEvent {
  item: ResponseOutputItem
  output_index: number
  sequence_number: number
  type: "response.output_item.done"
}

export interface ResponseReasoningSummaryTextDeltaEvent {
  delta: string
  item_id: string
  output_index: number
  sequence_number: number
  summary_index: number
  type: "response.reasoning_summary_text.delta"
}

export interface ResponseReasoningSummaryTextDoneEvent {
  item_id: string
  output_index: number
  sequence_number: number
  summary_index: number
  text: string
  type: "response.reasoning_summary_text.done"
}

export interface ResponseTextDeltaEvent {
  content_index: number
  delta: string
  item_id: string
  output_index: number
  sequence_number: number
  type: "response.output_text.delta"
}

export interface ResponseTextDoneEvent {
  content_index: number
  item_id: string
  output_index: number
  sequence_number: number
  text: string
  type: "response.output_text.done"
}

export type ResponsesStream = ReturnType<typeof events>
export type CreateResponsesReturn = ResponsesResult | ResponsesStream

interface ResponsesRequestOptions {
  vision: boolean
  initiator: "agent" | "user"
}

// ─── createResponses (for single-account mode) ────────────────────────────────

export const createResponses = async (
  payload: ResponsesPayload,
  { vision, initiator }: ResponsesRequestOptions,
): Promise<CreateResponsesReturn> => {
  if (!globalState.copilotToken) throw new Error("Copilot token not found")

  const headers: Record<string, string> = {
    ...copilotHeaders(globalState, vision),
    "X-Initiator": initiator,
  }

  // service_tier is not supported by github copilot
  payload.service_tier = null

  const response = await fetch(`${copilotBaseUrl(globalState)}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    consola.error("Failed to create responses", response)
    throw new HTTPError("Failed to create responses", response)
  }

  if (payload.stream) {
    return events(response)
  }

  return (await response.json()) as ResponsesResult
}

// ─── createResponsesAsCompletions (for console multi-account mode) ────────────

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

  const data = (await response.json()) as ResponsesResult
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
      const completed = data as { response: ResponsesResult }
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
  data: ResponsesResult,
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
