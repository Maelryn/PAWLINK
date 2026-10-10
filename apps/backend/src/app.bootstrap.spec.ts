import { describe, expect, it } from '@jest/globals';
import { AdminCasesController } from './admin/admin-cases.controller';
import { AiController } from './ai/ai.controller';
import { RegisterDto } from './auth/dto/register.dto';
import { CasesController } from './cases/cases.controller';
import { MeController } from './me/me.controller';
import { UploadsController } from './uploads/uploads.controller';
import { AnalyzeDto, PointDto } from './ai/dto/analyze.dto';
import { CreateCaseDto, CreateCaseLocationDto } from './cases/dto/create-case.dto';
import { ConfirmCaseDto, FlagCaseDto, OfferHelpDto, PatchCaseStatusDto } from './cases/dto/case.dto';
import { ModerateCaseDto } from './cases/dto/moderate-case.dto';
import { NearbyCasesDto, QueryCasesDto } from './cases/dto/query-cases.dto';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { GeminiProvider } from './ai/gemini.provider';
import { MockProvider } from './ai/mock.provider';
/**
 * The wiring smoke test.
 *
 * Importing a module is not the same as it working: nothing here touches the
 * network or the database, so `npm test` runs it in milliseconds. What it does
 * catch is the whole class of bugs where a class is *referenced* before it is
 * *defined* — a `ReferenceError` at import time.
 *
 * That is not hypothetical. `emitDecoratorMetadata` compiles a property's type
 * into `Reflect.metadata('design:type', X)`, which is evaluated while the class
 * is being defined. A nested DTO declared further down the same file is still in
 * its temporal dead zone at that moment, so the module throws the first time a
 * controller imports it — and every unit test still passes, because none of them
 * loads the controller. This suite exists so the next one cannot ship.
 */

describe('every controller and DTO module loads', () => {
  it('exposes every controller with its dependencies injected as a stub', () => {
    const controllers = [
      [AdminCasesController, { cases: {} }],
      [AiController, { ai: {} }],
      [CasesController, { cases: {} }],
      [MeController, { me: {} }],
      [UploadsController, { uploads: {} }],
    ] as const;

    for (const [controller, deps] of controllers) {
      const instance = new (controller as any)(deps);
      expect(instance).toBeInstanceOf(controller);
    }
  });

  it('exposes every DTO as a constructible class', () => {
    for (const dto of [
      AnalyzeDto,
      PointDto,
      CreateCaseDto,
      CreateCaseLocationDto,
      ConfirmCaseDto,
      FlagCaseDto,
      OfferHelpDto,
      PatchCaseStatusDto,
      ModerateCaseDto,
      NearbyCasesDto,
      QueryCasesDto,
      RegisterDto,
    ]) {
      expect(typeof dto).toBe('function');
      expect(new dto()).toBeInstanceOf(dto);
    }
  });

  it('exposes the realtime gateway and both AI providers', () => {
    expect(typeof RealtimeGateway).toBe('function');
    expect(typeof GeminiProvider).toBe('function');
    expect(new MockProvider().name).toBe('mock');
  });
});
