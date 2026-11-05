import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common';
import { Db } from './db';
import { verify, sign } from 'jsonwebtoken';
import type { User } from '@prisma/client';
export type Actor = Pick<User,'id'|'fullName'|'email'|'role'|'territoryId'|'distributorId'>;
export function secret() { const value=process.env.JWT_SECRET; if (!value || value.length<32) throw new Error('JWT_SECRET must contain at least 32 characters'); return value; }
export function token(user:Actor) { return sign({sub:user.id},secret(),{expiresIn:'12h',issuer:'fmcg',audience:'fmcg-web'}); }
export function permit(user:Actor,roles:string[]) { if (!roles.includes(user.role)) throw new ForbiddenException('This action is not available for your role'); }
export const managers=['COMPANY_ADMIN','AREA_MANAGER'];
export const operators=[...managers,'DISTRIBUTOR'];
export const sellers=[...managers,'SR'];
export const collectors=[...sellers,'ACCOUNTS'];
export const orderScope=(u:Actor) => u.role==='COMPANY_ADMIN'?{}:u.role==='SR'?{srId:u.id}:u.role==='DISTRIBUTOR'?{distributorId:u.distributorId || '__none'}:{outlet:{beat:{territoryId:u.territoryId || '__none'}}};
export const outletScope=(u:Actor) => u.role==='COMPANY_ADMIN'?{}:{beat:{territoryId:u.territoryId || '__none'}};
export const distributorScope=(u:Actor) => u.role==='COMPANY_ADMIN'?{}:u.role==='DISTRIBUTOR'?{id:u.distributorId || '__none'}:{territoryId:u.territoryId || '__none'};
export const userScope=(u:Actor) => u.role==='COMPANY_ADMIN'?{}:u.role==='SR'?{id:u.id}:{territoryId:u.territoryId || '__none'};
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Db) private db:Db) {}
  async canActivate(context:ExecutionContext) {
    const req=context.switchToHttp().getRequest();
    try {
      const payload=verify(req.cookies?.session || '',secret(),{issuer:'fmcg',audience:'fmcg-web'}) as {sub:string};
      const user=await this.db.user.findUnique({where:{id:payload.sub},select:{id:true,email:true,fullName:true,role:true,territoryId:true,distributorId:true}});
      if (!user) throw new Error(); req.user=user; return true;
    } catch { throw new UnauthorizedException('Please sign in to continue'); }
  }
}
