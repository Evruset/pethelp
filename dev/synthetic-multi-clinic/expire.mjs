// Wait for the accepted real DB TTL; never rewrite clock/deadlines/counters/states.
import {createRequire} from 'node:module';import {syntheticEnv} from './env.mjs';Object.assign(process.env,syntheticEnv);
const require=createRequire(import.meta.url);const {connect,NS}=require('../../backend/scripts/seed-local-multi-clinic.cjs');
require('../../backend/node_modules/reflect-metadata');const {DatabaseService}=require('../../backend/dist/src/database/database.service');const {BookingService}=require('../../backend/dist/src/booking-core/booking.service');const {BookingRepository}=require('../../backend/dist/src/booking-core/booking.repository');
const c=await connect(),db=new DatabaseService();
try{const initial=await c.query("SELECT count(*)::int n FROM synthetic_fixture.mapping WHERE namespace=$1 AND kind='awaiting_expiry'",[NS]);if(initial.rows[0].n!==43)throw Error('EXPECTED_43_EXPIRY_FIXTURES');
 let ready=false;
 for(let attempt=0;attempt<34;attempt++){
  const r=await c.query(`SELECT bool_and(h.confirmation_sla_expires_at<=clock_timestamp() OR h.state='EXPIRED') ready,ceil(max(extract(epoch from h.confirmation_sla_expires_at-clock_timestamp()))) remaining FROM booking_schema.booking_holds h JOIN synthetic_fixture.mapping m ON m.internal_id=h.id WHERE m.namespace=$1 AND m.kind='awaiting_expiry'`,[NS]);
  if(r.rows[0].ready){ready=true;break;}console.log(JSON.stringify({waitingForAcceptedRealDbTtl:true,remainingSeconds:r.rows[0].remaining}));await new Promise(r=>setTimeout(r,30000));
 }
 if(!ready)throw Error('EXPIRY_REAL_TTL_BOUNDED_WAIT_EXCEEDED');
 const worker=new BookingService(db,new BookingRepository());await worker.expireHolds(100);
 const result=await c.query(`SELECT m.external_id,h.id,h.state FROM booking_schema.booking_holds h JOIN synthetic_fixture.mapping m ON m.internal_id=h.id WHERE m.namespace=$1 AND m.kind='awaiting_expiry'`,[NS]);if(result.rows.some(r=>r.state!=='EXPIRED'))throw Error('EXPIRY_DOMAIN_TRANSITION_FAILED');
 await c.query('BEGIN');for(const r of result.rows)await c.query("INSERT INTO synthetic_fixture.mapping VALUES($1,'booking',$2,$3) ON CONFLICT DO NOTHING",[NS,r.external_id,r.id]);await c.query('COMMIT');console.log(JSON.stringify({EXPIRED:43,realDatabaseTtl:true,forgedDeadlines:0}));
}finally{await db.onModuleDestroy();await c.end();}
