import { ReallocationService, rankReallocationCandidates } from './reallocation.service';

const candidate=(slotId:string,temporal:string,distance:string|null,price:string|null,currency:string|null)=>({
  clinic_id:'10000000-0000-4000-8000-000000000001',location_id:'10000000-0000-4000-8000-000000000002',doctor_id:'10000000-0000-4000-8000-000000000003',service_id:'10000000-0000-4000-8000-000000000004',doctor_service_id:'10000000-0000-4000-8000-000000000005',slot_id:slotId,slot_version:1,starts_at:new Date(),ends_at:new Date(Date.now()+1),distance_meters:distance,price_amount:price,price_currency:currency,temporal_delta_ms:temporal,
});

describe('Smart Reallocation deterministic Pilot ranking',()=>{
  it('orders by time, then comparable available distance, price and slot id',()=>{
    const rows=[
      candidate('30000000-0000-4000-8000-000000000003','200','10','20','RUB'),
      candidate('30000000-0000-4000-8000-000000000002','100','20','10','RUB'),
      candidate('30000000-0000-4000-8000-000000000001','100','10','30','RUB'),
    ];
    expect(rankReallocationCandidates(rows).map(row=>row.slot_id)).toEqual([rows[2].slot_id,rows[1].slot_id,rows[0].slot_id]);
  });
  it('skips unavailable and non-comparable optional dimensions without defaults',()=>{
    const rows=[
      candidate('30000000-0000-4000-8000-000000000002','100',null,'1','USD'),
      candidate('30000000-0000-4000-8000-000000000001','100','999','999','RUB'),
    ];
    expect(rankReallocationCandidates(rows).map(row=>row.slot_id)).toEqual([rows[1].slot_id,rows[0].slot_id]);
  });
});

describe('Smart Reallocation authoritative readback',()=>{
  const now=new Date('2026-09-01T09:00:00.000Z');
  const caseRow={id:'80000000-0000-4000-8000-000000000001',booking_change_request_id:'80000000-0000-4000-8000-000000000002',booking_hold_id:'80000000-0000-4000-8000-000000000003',status:'OPEN',eligibility:'ACTIVE',version:2,server_now:now,created_at:now};
  const offerRow={id:'90000000-0000-4000-8000-000000000001',version:3,rank:1,clinic_id:'90000000-0000-4000-8000-000000000002',clinic_name:'Клиника',location_id:'90000000-0000-4000-8000-000000000003',location_address:'Адрес',timezone:'Europe/Moscow',doctor_id:'90000000-0000-4000-8000-000000000004',doctor_name:'Врач',service_id:'90000000-0000-4000-8000-000000000005',service_name:'Приём',slot_id:'90000000-0000-4000-8000-000000000006',slot_version:7,current_slot_version:7,starts_at:new Date('2026-09-02T08:00:00.000Z'),ends_at:new Date('2026-09-02T08:30:00.000Z'),distance_meters:'1250',price_amount:'900',price_currency:'RUB',status:'OFFERED',expires_at:new Date('2026-09-01T09:15:00.000Z'),server_now:now,slot_state:'OPEN',publication_state:'PUBLISHED',source_stale_at:null,capacity:1,booked_count:0,held_count:0,service_active:true,doctor_service_active:true,current_resource_id:null,staff_active:true,resource_active:null,shift_status:'PUBLISHED',clinic_status:'ACTIVE',location_status:'ACTIVE',doctor_active:true,public_booking_enabled:true};
  const read=async(row:Record<string,unknown>)=>{
    const client={query:jest.fn().mockResolvedValueOnce({rows:[caseRow]}).mockResolvedValueOnce({rows:[row]})};
    const database={withTransaction:(callback:(value:typeof client)=>unknown)=>callback(client)};
    return new ReallocationService(database as never,{} as never).owner(caseRow.id,'70000000-0000-4000-8000-000000000001');
  };
  it('returns safe facts, versions and an offered state only while the exact inventory remains eligible',async()=>{
    await expect(read(offerRow)).resolves.toMatchObject({eligibility:'ACTIVE',offers:[{offerId:offerRow.id,version:3,clinicName:'Клиника',locationAddress:'Адрес',timezone:'Europe/Moscow',doctorName:'Врач',serviceName:'Приём',slotVersion:7,status:'OFFERED'}]});
  });
  it('derives expiry from database time and invalidates stale inventory fail-closed',async()=>{
    await expect(read({...offerRow,expires_at:new Date('2026-09-01T08:59:00.000Z')})).resolves.toMatchObject({offers:[{status:'EXPIRED'}]});
    await expect(read({...offerRow,current_slot_version:8})).resolves.toMatchObject({offers:[{status:'INVALIDATED'}]});
    await expect(read({...offerRow,current_resource_id:'90000000-0000-4000-8000-000000000007',resource_active:null})).resolves.toMatchObject({offers:[{status:'INVALIDATED'}]});
  });
});
