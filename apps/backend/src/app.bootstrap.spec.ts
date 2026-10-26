import { describe, expect, it } from '@jest/globals';
import { AdminCasesController } from './admin/admin-cases.controller';
import { RegisterDto } from './auth/dto/register.dto';
import { CasesController } from './cases/cases.controller';
import { MeController } from './me/me.controller';
import { UploadsController } from './uploads/uploads.controller';
import { CreateCaseDto, CreateCaseLocationDto } from './cases/dto/create-case.dto';
import { FlagCaseDto, OfferHelpDto, PatchCaseStatusDto } from './cases/dto/case.dto';
import { ConfirmCaseDto } from './cases/dto/confirm-case.dto';
import { UpdateCaseDto } from './cases/dto/update-case.dto';
import { ModerateCaseDto } from './cases/dto/moderate-case.dto';
import { EditDecisionDto } from './common/dto/edit-decision.dto';
import { ActivateProDto } from './me/dto/pro.dto';
import { NearbyCasesDto, QueryCasesDto } from './cases/dto/query-cases.dto';
import { RealtimeGateway } from './realtime/realtime.gateway';
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
 *
 * The AI surface (`AiController`, its DTOs, and the two providers) is
 * intentionally absent: the AI work lives in `apps/Ai/` and the backend has no
 * dependency on it until that service is delivered.
 */

describe('every controller and DTO module loads', () => {
  it('exposes every controller with its dependencies injected as a stub', () => {
    const controllers = [
      [AdminCasesController, { cases: {} }],
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
      CreateCaseDto,
      CreateCaseLocationDto,
      ConfirmCaseDto,
      UpdateCaseDto,
      FlagCaseDto,
      OfferHelpDto,
      PatchCaseStatusDto,
      ModerateCaseDto,
      EditDecisionDto,
      ActivateProDto,
      NearbyCasesDto,
      QueryCasesDto,
      RegisterDto,
    ]) {
      expect(typeof dto).toBe('function');
      expect(new dto()).toBeInstanceOf(dto);
    }
  });

  it('exposes the realtime gateway', () => {
    expect(typeof RealtimeGateway).toBe('function');
  });
});
