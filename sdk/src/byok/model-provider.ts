/**
 * BYOK (Bring Your Own Key) model provider.
 *
 * Creates LanguageModel instances from BYOK configuration, allowing
 * requests to be routed through user-specified OpenAI-compatible endpoints
 * instead of the Codebuff backend.
 *
 * This is a standalone bypass module — upstream upgrades should merge cleanly.
 */

import {
  OpenAICompatibleChatLanguageModel,
  VERSION,
} from '@codebuff/internal/openai-compatible/index'

import type { ResolvedByokModel } from './config'
import type { LanguageModel } from 'ai'

/**
 * Create a LanguageModel from a resolved BYOK model config.
 *
 * Only supports OpenAI-compatible APIs (api: openai-completions or api: openai-responses).
 * Returns null for unsupported API types (e.g., anthropic-messages, google-generative-ai).
 */
export function createByokModel(
  resolved: ResolvedByokModel,
): LanguageModel | null {
  const { provider, model } = resolved
  const api = provider.api ?? 'openai-completions'

  // Only OpenAI-compatible APIs are supported for now
  if (api !== 'openai-completions' && api !== 'openai-responses') {
    return null
  }

  // Remove trailing slash for consistent URL joining
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')

  return new OpenAICompatibleChatLanguageModel(model.id, {
    provider: 'byok',
    url: ({ path }) => {
      return `${baseUrl}${path}`
    },
    headers: () => ({
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      'user-agent': `ai-sdk/openai-compatible/${VERSION}/codebuff-byok`,
    }),
    fetch: undefined,
    includeUsage: undefined,
    supportsStructuredOutputs: true,
  })
}
