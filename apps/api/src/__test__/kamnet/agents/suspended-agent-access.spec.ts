import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleCode, RolesGuard } from '@kambriq/common';
import { KamnetAgentController } from '../../../kamnet/controllers/kamnet-agent.controller';
import { LandsAgentController } from '../../../lands/controllers/lands-agent.controller';
import { LandsClientController } from '../../../lands/controllers/lands-client.controller';

/**
 * Tests access rights for suspended agents using the actual RolesGuard and controller decorators.
 * Ensures a suspended agent can still view their purchases and commissions, but cannot make new reservations.
 */
describe('I16 - what a suspended agent can still do', () => {
  const guard = new RolesGuard(new Reflector());

  // Agents typically hold KCA_CERTIFIED and CLIENT roles. Suspension removes only the AGENT role.
  const SUSPENDED = [RoleCode.KCA_CERTIFIED, RoleCode.CLIENT];
  // Simulates a suspended agent lacking an explicit CLIENT role grant.
  const SUSPENDED_WITHOUT_OWN_CLIENT = [RoleCode.KCA_CERTIFIED];

  const allows = (roles: string[], cls: object, method: string): boolean => {
    const handler = (cls as { prototype: Record<string, unknown> }).prototype[method];
    if (typeof handler !== 'function') throw new Error(`No route method ${method}`);
    const context = {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u-agent', roles } }) }),
    } as unknown as ExecutionContext;
    try {
      return guard.canActivate(context);
    } catch (e) {
      if (e instanceof ForbiddenException) return false;
      throw e;
    }
  };

  it('can still open their own purchases (GET /lands/client/purchases)', () => {
    expect(allows(SUSPENDED, LandsClientController, 'getMyPurchases')).toBe(true);
    expect(allows(SUSPENDED, LandsClientController, 'getPurchaseDetail')).toBe(true);
  });

  it('can still see the commissions they earned (GET /kamnet/commissions, /summary)', () => {
    expect(allows(SUSPENDED, KamnetAgentController, 'getMyCommissions')).toBe(true);
    expect(allows(SUSPENDED, KamnetAgentController, 'getCommissionSummary')).toBe(true);
  });

  it('cannot reserve (POST /lands/reservations)', () => {
    expect(allows(SUSPENDED, LandsAgentController, 'reserveLand')).toBe(false);
  });

  it('would have lost their purchases had AGENT been removed before CLIENT was granted', () => {
    expect(allows(SUSPENDED_WITHOUT_OWN_CLIENT, LandsClientController, 'getMyPurchases')).toBe(
      false,
    );
  });
});
