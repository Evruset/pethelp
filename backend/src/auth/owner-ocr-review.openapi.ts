import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
const uuid:SchemaObject={type:'string',format:'uuid'},hash:SchemaObject={type:'string',pattern:'^[0-9a-f]{64}$'},text:SchemaObject={type:'string',minLength:0,maxLength:32768};
export function closed(properties:Record<string,SchemaObject>):SchemaObject & {properties:Record<string,SchemaObject>} { return {type:'object',additionalProperties:false,required:Object.keys(properties),properties}; }
export const emptyReviewBody=closed({}),correctionBody=closed({text:{...text,minLength:1}});
const state:SchemaObject={type:'string',enum:['PENDING_OWNER_REVIEW','IN_REVIEW','CONFIRMED','REJECTED']};
const revision:SchemaObject={type:'integer',minimum:0,maximum:2147483647};
const decision=closed({revision,expectedRevision:revision,action:{type:'string',enum:['START','CORRECT','CONFIRM','REJECT']},reviewState:state,textVersion:revision,text,textIdentity:hash,actorId:uuid,createdAt:{type:'string',format:'date-time'}});
export const reviewMutationSchema=closed({candidateId:uuid,jobId:uuid,resultId:uuid,documentId:uuid,petId:uuid,schemaVersion:{type:'integer',enum:[1]},kind:{type:'string',enum:['EXTRACTED_TEXT']},reviewState:state,revision,textVersion:revision,text,textIdentity:hash,originalText:text,originalTextIdentity:hash,sourceIdentity:hash,resultIdentity:hash,authority:{type:'string',enum:['OWNER_DECISION_ONLY']},sourceByteIntegrity:{type:'string',enum:['DEFERRED_BLOCKING_VALIDATED_IMPORT']},decision:{...decision,nullable:true}});
export const reviewReadSchema=closed({...reviewMutationSchema.properties,history:{type:'array',maxItems:20,items:decision},page:closed({limit:{type:'integer',minimum:1,maximum:20},offset:revision,total:revision,nextOffset:{...revision,nullable:true}})});
