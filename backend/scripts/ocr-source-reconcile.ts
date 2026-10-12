import {DatabaseService} from '../src/database/database.service';
import {operationalReaderPreflight} from '../src/auth/ocr-operational-preflight';
async function main(){const db=new DatabaseService();try{console.log(JSON.stringify(await operationalReaderPreflight(db)));}finally{await db.onModuleDestroy();}}
void main().catch(()=>{console.error('OCR_SOURCE_RECONCILIATION_DENIED');process.exitCode=1;});
