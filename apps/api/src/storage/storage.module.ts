import { Module } from '@nestjs/common';
import { STORAGE_CLIENT } from './storage.client.js';
import { SupabaseStorageClient } from './supabase-storage.client.js';

/**
 * 이미지 저장소 모듈 (PRD F007).
 *
 * 구현체가 아니라 `STORAGE_CLIENT` 토큰을 내보낸다 — 소비자(`TeamsModule`)가
 * Supabase라는 구체 구현에 묶이지 않고, 테스트에서 대역으로 교체할 수 있다.
 */
@Module({
  providers: [{ provide: STORAGE_CLIENT, useClass: SupabaseStorageClient }],
  exports: [STORAGE_CLIENT],
})
export class StorageModule {}
