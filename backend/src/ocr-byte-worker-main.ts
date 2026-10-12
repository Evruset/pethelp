import 'reflect-metadata';
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {DatabaseModule} from './database/database.module';
import {OcrByteExecutionService} from './auth/ocr-byte-execution.service';
import {OcrProvider} from './auth/ocr-provider';
import {operationalRole,operationalDenied} from './auth/ocr-operational-preflight';
@Module({imports:[DatabaseModule],providers:[OcrByteExecutionService,OcrProvider]})
class ByteWorkerModule {}
async function bootstrap(){
 if(process.env.WORKERS_ENABLED!=='true'||process.env.OCR_VERIFIED_BYTES_ENABLED!=='true'||operationalRole()!=='worker')throw operationalDenied();
 const app=await NestFactory.createApplicationContext(ByteWorkerModule,{logger:false});console.info('OCR_WORKER_READY');const executor=app.get(OcrByteExecutionService),provider=app.get(OcrProvider);let stopping=false,active:Promise<void>|undefined;
 const tick=()=>{if(stopping||active)return;active=(async()=>{const claim=await executor.claim();if(claim)await executor.execute(claim,provider);})().catch(()=>{console.error('OCR_WORKER_CHECKPOINT_DENIED');}).finally(()=>{active=undefined;});};
 const timer=setInterval(tick,10000);const stop=async()=>{if(stopping)return;stopping=true;clearInterval(timer);await active;await app.close();};process.once('SIGTERM',()=>{void stop();});process.once('SIGINT',()=>{void stop();});tick();
}
void bootstrap().catch(()=>{console.error('OCR_WORKER_STARTUP_DENIED');process.exitCode=1;});
