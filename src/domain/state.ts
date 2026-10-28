import type { ConfirmedEvent } from './learning';
import type { Allocation,Annotation,Balance,CommitmentRule,Coverage,Movement,Occurrence,Plan } from './types';
export type AccountState = { profile: { id:string; wallet:string; timezone:string; consentVersion:string|null }; balance:Balance|null; plan:Plan; movements:Movement[]; annotations:Annotation[]; reimbursements:Allocation[]; commitmentAllocations:Allocation[]; rules:CommitmentRule[]; occurrences:Occurrence[]; coverage:Coverage; memories:ConfirmedEvent[]; today:string; now:string; mode:'personal'|'synthetic'; memoryStatus:string };
