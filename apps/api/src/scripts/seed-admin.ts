/**
 * 초기 관리자 계정 생성 스크립트 (PRD F001의 전제조건).
 *
 *   npm run seed:admin
 *
 * 아이디/비밀번호를 **실행 시점에 터미널에서 직접 입력**받는다.
 * 환경변수나 CLI 인자로 받지 않는 이유:
 *   - CLI 인자: 셸 히스토리와 프로세스 목록(ps/작업관리자)에 평문이 그대로 남는다
 *   - 환경변수(.env): 계정을 한 번 만든 뒤에도 평문 비밀번호가 파일에 계속 남는다.
 *     이 레포는 Public이고 .env는 gitignore에만 의존하는 상태라 위험을 늘릴 이유가 없다
 *   - 대화형 입력: 히스토리에도, 프로세스 인자에도, 파일에도 남지 않는다
 *
 * 이미 있는 아이디를 입력하면 비밀번호 재설정으로 동작한다
 * (MVP에는 비밀번호 변경 UI가 없어서, 분실/교체 시 이 스크립트가 유일한 경로다).
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import { TerminalPrompt } from './terminal-prompt.js';

// 비밀번호 최소 길이. 관리자 계정은 하나뿐이고 로그인 시도 제한도 없으므로 길이로 방어한다.
const MIN_PASSWORD_LENGTH = 12;

/**
 * 시딩에 필요한 것만 모은 축소 모듈.
 * AppModule을 그대로 쓰면 JWT_SECRET까지 설정돼 있어야 스크립트가 돌기 때문에,
 * "계정 먼저 만들고 JWT 설정은 나중에" 같은 순서도 가능하도록 분리했다.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [PasswordService],
})
class SeedAdminModule {}

async function main(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error(
      '대화형 입력이 필요합니다. 파이프나 CI가 아닌 실제 터미널에서 실행하세요.',
    );
  }

  // 입력을 다 받은 뒤에 DB 연결이 실패하면 헛수고이므로 연결을 먼저 맺는다.
  const app = await NestFactory.createApplicationContext(SeedAdminModule, {
    logger: ['error', 'warn'],
  });
  const prompt = new TerminalPrompt();

  try {
    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);

    const username = (await prompt.question('관리자 아이디: ')).trim();
    if (!username) {
      throw new Error('아이디는 비워 둘 수 없습니다.');
    }

    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (existing) {
      const answer = await prompt.question(
        `'${username}' 계정이 이미 있습니다. 비밀번호를 재설정할까요? (y/N): `,
      );
      if (answer.trim().toLowerCase() !== 'y') {
        console.log('취소했습니다. 변경된 내용은 없습니다.');
        return;
      }
    }

    const password = await prompt.password('비밀번호: ');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
    }
    if (password === username) {
      throw new Error('비밀번호를 아이디와 같게 설정할 수 없습니다.');
    }

    const confirmation = await prompt.password('비밀번호 확인: ');
    if (password !== confirmation) {
      throw new Error('두 번 입력한 비밀번호가 일치하지 않습니다.');
    }

    const passwordHash = await passwords.hash(password);
    const admin = await prisma.adminUser.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });

    console.log(
      existing
        ? `비밀번호를 재설정했습니다. (id=${admin.id}, username=${admin.username})`
        : `관리자 계정을 만들었습니다. (id=${admin.id}, username=${admin.username})`,
    );
  } finally {
    prompt.close();
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(
      `실패: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
