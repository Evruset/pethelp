import { ownerWebBridge } from '@/server/owner-web-bridge';
type Params={path:string|string[]};
export const GET=(request:Request,params:Params)=>ownerWebBridge(request,params.path);
export const POST=(request:Request,params:Params)=>ownerWebBridge(request,params.path);
export const OPTIONS=()=>new Response(null,{status:405,headers:{Allow:'GET, POST'}});
