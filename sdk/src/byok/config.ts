/**
 * BYOK (Bring Your Own Key) configuration.
 *
 * Reads models.yml in the format used by ~/.omp/agent/models.yml
 * and provides typed configuration lookup for custom model providers.
 *
 * This is a standalone bypass module — upstream upgrades should merge cleanly.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import yaml from 'js-yaml'

// ============================================================================
// Types
// ============================================================================

/**
 * A model entry in the BYOK config.
 */
export interface ByokModelDefinition {
  id: string
  name?: string
  reasoning?: boolean
  contextWindow?: number
  maxTokens?: number
  temperature?: number
  compat?: Record<string, unknown>
  thinking?: Record<string, unknown>
  input?: string[]
}

/**
 * A provider entry in the BYOK config.
 */
export interface ByokProviderDefinition {
  baseUrl: string
  apiKey: string
  api?: string
  models: ByokModelDefinition[]
}

/**
 * The top-level BYOK configuration parsed from models.yml.
 */
export interface ByokConfig {
  providers: Record<string, ByokProviderDefinition>
}

/**
 * A resolved BYOK model with its provider info.
 */
export interface ResolvedByokModel {
  providerName: string
  provider: ByokProviderDefinition
  model: ByokModelDefinition
}

// ============================================================================
// Config file discovery
// ============================================================================

/**
 * Find the BYOK config file path.
 * Checks in order: env var → cwd → home dir (standard OMP path).
 */
function findConfigPath(): string | null {
  // 1. Override via env var
  const envPath = process.env.CODEBUFF_BYOK_CONFIG_PATH
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }

  // 2. Local models.yml (cwd / project root)
  const cwdPath = path.join(process.cwd(), 'models.yml')
  if (fs.existsSync(cwdPath)) {
    return cwdPath
  }

  // 3. Standard OMP path in home directory
  const homePath = path.join(os.homedir(), '.omp', 'agent', 'models.yml')
  if (fs.existsSync(homePath)) {
    return homePath
  }

  return null
}

// ============================================================================
// Config loading with TTL cache
// ============================================================================

let cachedConfig: ByokConfig | null = null
let cachedConfigPath: string | null = null
let lastReadTime = 0
const CACHE_TTL_MS = 60_000 // Re-read every 60 seconds

/**
 * Load the BYOK configuration from models.yml.
 * Returns null if no config file is found or if parsing fails.
 */
export function loadByokConfig(): ByokConfig | null {
  const configPath = findConfigPath()
  if (!configPath) {
    return null
  }

  const now = Date.now()

  // Use cache if still valid and same path
  if (
    cachedConfig !== null &&
    cachedConfigPath === configPath &&
    now - lastReadTime < CACHE_TTL_MS
  ) {
    return cachedConfig
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    const parsed = yaml.load(content) as ByokConfig

    // Validate basic structure
    if (!parsed || !parsed.providers || typeof parsed.providers !== 'object') {
      cachedConfig = null
      cachedConfigPath = null
      return null
    }

    cachedConfig = parsed
    cachedConfigPath = configPath
    lastReadTime = now
    return parsed
  } catch {
    cachedConfig = null
    cachedConfigPath = null
    return null
  }
}

/**
 * Find a model in the BYOK config by model ID.
 * Returns null if the model is not found or if config can't be loaded.
 */
export function findModelInByokConfig(
  modelId: string,
): ResolvedByokModel | null {
  const config = loadByokConfig()
  if (!config) {
    return null
  }

  for (const [providerName, provider] of Object.entries(config.providers)) {
    if (!provider.models || !Array.isArray(provider.models)) {
      continue
    }
    for (const model of provider.models) {
      if (model.id === modelId) {
        return { providerName, provider, model }
      }
    }
  }

  return null
}

/**
 * Check if BYOK config is available (config file was found and parsed).
 */
export function isByokConfigAvailable(): boolean {
  return loadByokConfig() !== null
}
