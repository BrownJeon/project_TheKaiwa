/**
 * 코드 Plugin Registry(admin-console/03 §4) — 어댑터 Provider 목록. 엔진명이 등장하는 곳은 이 디렉토리(adapters/**)뿐이다.
 * `engine/registry` 는 이 배열만 읽고 엔진을 모른다.
 */
import type { EngineProvider } from '../registry/types'
import { claudeCliProvider } from './llm/claudeCli.provider'
import { homeM4Provider } from './llm/homeM4.provider'
import { fasterWhisperProvider } from './stt/fasterWhisper.provider'
import { sherpaReazonProvider } from './stt/sherpaReazon.provider'
import { styleBertVits2Provider } from './tts/styleBertVits2.provider'

export const PROVIDERS: readonly EngineProvider[] = [sherpaReazonProvider, fasterWhisperProvider, styleBertVits2Provider, claudeCliProvider, homeM4Provider]
