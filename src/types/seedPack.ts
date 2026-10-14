/**
 * 기본 단어 단계 — 서버 모듈과 화면이 같이 쓰는 **리프** 파일(task-051, task-068 에서 #46b 폐지 — 단계는 기본 단어 시드·분류 이름에만 쓴다).
 * 단어 데이터(JSON)를 import 하지 않는다 — 화면이 개수 문구를 그리려고 7천 개를 클라이언트 번들에 싣지 않게.
 *
 * 표시 이름은 이 파일의 `SEED_PACK_LABEL` 에서만 만든다(사용자 결정 D1=C, 2026-10-10 — 「원어민」 대신 「최상급」).
 * 팩 단어의 분류(`WordEntry.category`) 칩 이름도 같은 글자다(D3=B). 기존 `N5 기초` 50개 행은 바꾸지 않는다.
 */
import type { JlptLevel } from './vocab'
import { SEED_PACK_COUNT as GENERATED_COUNT } from './seedPackCounts'

export const SEED_PACKS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const satisfies readonly JlptLevel[]
export type SeedPack = (typeof SEED_PACKS)[number]

export const SEED_PACK_LABEL: Readonly<Record<SeedPack, string>> = {
  N5: '초보자 (N5)',
  N4: '초급 (N4)',
  N3: '중급 (N3)',
  N2: '고급 (N2)',
  N1: '최상급 (N1)',
}

/** 단계별 단어 수 — 생성 파일(`seedPackCounts.ts`)을 단계 키 전부가 있는 맵으로 고정한다. 데이터 길이와의 일치는 시험이 단언한다. */
export const SEED_PACK_COUNT: Readonly<Record<SeedPack, number>> = GENERATED_COUNT

export function isSeedPack(v: unknown): v is SeedPack {
  return typeof v === 'string' && (SEED_PACKS as readonly string[]).includes(v)
}

/** 팩으로 넣은 단어의 분류 칩 이름 = 표시 이름. */
export function seedPackCategory(pack: SeedPack): string {
  return SEED_PACK_LABEL[pack]
}

/** task-068 D3 B — 칩으로 보이지 않는 난이도 이름 분류(단계 표시 이름 5개 + 옛 OWNER 시드 `N5 기초`). 서버 #46 과 화면이 바이트 일치로 비교한다. */
export const LEVEL_CATEGORY_NAMES: readonly string[] = Object.freeze([...SEED_PACKS.map((p) => SEED_PACK_LABEL[p]), 'N5 기초'])

export function isLevelCategory(v: unknown): boolean {
  return typeof v === 'string' && LEVEL_CATEGORY_NAMES.includes(v)
}
