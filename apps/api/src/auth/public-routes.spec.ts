import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * 앱 전체에서 `@Public()`이 붙은 핸들러를 **자동으로 찾아** 허용 목록과 비교한다.
 *
 * 컨트롤러별 회귀 테스트는 그 컨트롤러가 테스트에 등록돼 있어야만 검사된다. 새 컨트롤러를 만들고
 * `@Public()`을 붙인 채 테스트를 안 쓰면 아무도 모른 채 인증 없는 라우트가 나간다.
 * 이 스펙은 `AppModule`에서 컨트롤러를 발견하므로 그 빈틈이 없다.
 *
 * 공개 라우트를 새로 여는 것은 보안 결정이다. 목록에 추가하려면 이 파일을 수정해 리뷰에 드러나야 한다.
 */
const EXPECTED_PUBLIC_HANDLERS = ['AuthController.login', 'HealthController.check'];

type ModuleRef = unknown;

/** `@Module()` 메타데이터를 따라 컨트롤러 클래스를 모은다. 동적 모듈(`forRoot` 등)도 따라간다. */
function collectControllers(root: ModuleRef): Function[] {
  const controllers = new Set<Function>();
  const visited = new Set<ModuleRef>();

  const visit = (moduleRef: ModuleRef): void => {
    if (visited.has(moduleRef)) {
      return;
    }
    visited.add(moduleRef);

    const dynamic = moduleRef as {
      module?: Function;
      imports?: ModuleRef[];
      controllers?: Function[];
    };
    const moduleClass = (typeof moduleRef === 'function' ? moduleRef : dynamic.module) as Function;
    if (!moduleClass) {
      return;
    }

    const declared: Function[] = [
      ...(Reflect.getMetadata('controllers', moduleClass) ?? []),
      ...(dynamic.controllers ?? []),
    ];
    declared.forEach((controller) => controllers.add(controller));

    const imports: ModuleRef[] = [
      ...(Reflect.getMetadata('imports', moduleClass) ?? []),
      ...(dynamic.imports ?? []),
    ];
    imports.forEach(visit);
  };

  visit(root);
  return [...controllers];
}

/** `@Get()` 등으로 라우트가 붙은 핸들러 이름만 뽑는다 */
function routeHandlers(controller: Function): string[] {
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof prototype[name] === 'function' &&
      Reflect.getMetadata(PATH_METADATA, prototype[name] as object) !== undefined,
  );
}

describe('@Public() 전수 회귀 (AppModule에서 컨트롤러 자동 발견)', () => {
  const controllers = collectControllers(AppModule);

  it('발견 로직이 비어 있지 않다 (빈 목록이면 아래 검사가 아무것도 검사하지 못한다)', () => {
    const names = controllers.map((controller) => controller.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'AuthController',
        'HealthController',
        'TeamsController',
        'TeamCardImageController',
        'TeamSongsController',
        'SongsController',
        'AlbumCoverController',
        'YoutubeRecommendationsController',
        'YoutubeUrlController',
      ]),
    );
  });

  it('@Public()이 붙은 핸들러는 허용 목록과 정확히 일치한다', () => {
    const publicHandlers = controllers
      .flatMap((controller) =>
        routeHandlers(controller)
          .filter(
            (name) =>
              Reflect.getMetadata(
                IS_PUBLIC_KEY,
                (controller.prototype as Record<string, object>)[name],
              ) === true,
          )
          .map((name) => `${controller.name}.${name}`),
      )
      .sort();

    expect(publicHandlers).toEqual([...EXPECTED_PUBLIC_HANDLERS].sort());
  });

  it('어떤 컨트롤러 클래스에도 @Public()이 붙어 있지 않다 (클래스에 붙으면 하위 라우트가 전부 열린다)', () => {
    const publicClasses = controllers
      .filter((controller) => Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true)
      .map((controller) => controller.name);

    expect(publicClasses).toEqual([]);
  });
});
