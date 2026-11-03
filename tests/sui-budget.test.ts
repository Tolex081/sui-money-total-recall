import {it,expect} from 'vitest';
import {suiPlanning,suiSpending,suiOccurrences} from '@/domain/sui-budget';
import {SUI_TYPE,USDC_TYPE} from '@/domain/money';
import type {Movement,Plan} from '@/domain/types';

const plan:Plan={endDate:'2026-11-30',endKind:'income',reserve:'50000000',timezone:'Africa/Lagos',version:1,expectedIncome:null};
const balance={usdc:'100000000',sui:'10000000000',observedAt:'2026-11-03T08:00:00.000Z',checkpoint:'1',source:'tatum' as const,stale:false};
const bill={id:'b1',alias:'Node fee',amount:'1000000000',startDate:'2026-11-10',frequency:'weekly' as const,paidDates:[] as string[]};

it('plans SUI in SUI units with its own reserve and bills, ignoring the USDC reserve',()=>{
  const result=suiPlanning({balance,plan,budget:{reserve:'2000000000',version:1,bills:[bill]},today:'2026-11-03'});
  if(result.state!=='ready')throw Error(result.state);
  // 10 SUI held − 2 SUI reserve − 3 weekly bills (10, 17, 24 Nov) of 1 SUI = 5 SUI over 27 days.
  expect(result.commitments).toBe(3000000000n);expect(result.discretionary).toBe(5000000000n);expect(result.days).toBe(27);
});
it('a paid SUI bill stops counting, and a shortfall is reported, never a negative amount',()=>{
  const paid=suiOccurrences([{...bill,paidDates:['2026-11-10']}],'2026-11-30');expect(paid.filter(o=>!o.cancelled)).toHaveLength(2);
  const short=suiPlanning({balance,plan,budget:{reserve:'9500000000',version:1,bills:[bill]},today:'2026-11-03'});
  if(short.state!=='ready')throw Error(short.state);expect(short.discretionary).toBe(0n);expect(short.shortfall).toBe(2500000000n);
});
it('SUI spending excludes the network fee, the gas row of a USDC payment and own transfers',()=>{
  const base={owner:'0x1',checkpoint:'5',timestamp:'2026-11-02T10:00:00.000Z',status:'success' as const,operation:'simple_transfer' as const,counterparty:'0x2',source:'tatum' as const,gasCredit:'0'};
  const movements:Movement[]=[
    {...base,id:'sui-pay',digest:'d1',coinType:SUI_TYPE,delta:'-1500002000',gasPaid:'2000',gasNet:'2000'},
    {...base,id:'usdc-pay',digest:'d2',coinType:USDC_TYPE,delta:'-5000000',gasPaid:'0',gasNet:'0'},
    {...base,id:'usdc-gas',digest:'d2',coinType:SUI_TYPE,delta:'-3000',gasPaid:'3000',gasNet:'3000'},
    {...base,id:'own',digest:'d3',coinType:SUI_TYPE,delta:'-700001000',gasPaid:'1000',gasNet:'1000'},
  ];
  const report=suiSpending(movements,[{movementId:'own',category:'Other',note:'Savings',ownTransfer:true}],{from:'2026-10-04T00:00:00.000Z',to:'2026-11-03T00:00:00.000Z'});
  expect(report.spent).toBe(1500000000n);expect(report.rows.map(r=>r.movement.id)).toEqual(['sui-pay']);
});
