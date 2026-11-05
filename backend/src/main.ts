import 'reflect-metadata';
import 'dotenv/config';
import { Catch, ExceptionFilter, ArgumentsHost, HttpException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Db } from './db';
import { AuthGuard, secret } from './auth';
import { AuthController } from './auth.controller';
import { AppController } from './app.controller';
import { ReadService } from './read.service';
import { MastersService } from './masters.service';
import { OrdersService } from './orders.service';
import { CollectionsService } from './collections.service';
import { JourneyService } from './journey.service';
import { IncentivesService } from './incentives.service';
import { ClaimsService } from './claims.service';
import { Realtime } from './realtime';
import { Jobs } from './jobs';
@Catch()
class Errors implements ExceptionFilter {
  catch(e:unknown,host:ArgumentsHost) {
    let status=500,message='Something went wrong. Please try again.';
    if(e instanceof HttpException) {status=e.getStatus();message=e.message;}
    if(e instanceof Prisma.PrismaClientKnownRequestError) {if(e.code==='P2002'){status=409;message='This record already exists';}if(e.code==='P2025'||e.code==='P2003'){status=400;message='Referenced record was not found';}}
    if(status===500) console.error(e);
    host.switchToHttp().getResponse().status(status).json({statusCode:status,message});
  }
}
@Module({controllers:[AuthController,AppController],providers:[Db,AuthGuard,ReadService,MastersService,OrdersService,CollectionsService,JourneyService,IncentivesService,ClaimsService,Realtime,Jobs]})
class AppModule {}
async function main() {
  secret(); const app=await NestFactory.create(AppModule,{bodyParser:true});
  const origins=(process.env.CORS_ORIGINS||'http://127.0.0.1:3000').split(',');
  app.use(helmet());app.use(cookieParser());
  app.use((req:any,res:any,next:any)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&!origins.includes(req.headers.origin)) return res.status(403).json({message:'Origin is not allowed'});
    next();
  });
  app.enableCors({origin:origins,credentials:true});app.useGlobalFilters(new Errors());app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT||4000),'127.0.0.1');
}
void main();
