// Before/after-only environment evidence. Never imported by Jest/application.
const fs=require('node:fs'),os=require('node:os');
const read=k=>fs.readFileSync('/sys/fs/cgroup/'+k,'utf8').trim();
const s={at:new Date().toISOString(),node:process.version,cpuCount:os.cpus().length,
  availableParallelism:os.availableParallelism(),memoryBytes:os.totalmem(),
  diagnosticsModule:process.env.T044_DIAGNOSTICS_MODULE??null,
  diagnosticsDirectory:process.env.T044_DIAGNOSTICS_DIR??null,
  cgroup:Object.fromEntries(['cpu.max','cpu.stat','cpu.pressure','cpuset.cpus.effective',
    'memory.max','memory.current','memory.peak','memory.events'].map(k=>[k,read(k)]))};
if(s.node!=='v22.23.1'||s.cpuCount!==4||s.availableParallelism!==4||
  s.cgroup['cpuset.cpus.effective']!=='0-3'||s.diagnosticsModule!==null||s.diagnosticsDirectory!==null){
  console.error(JSON.stringify(s));process.exit(2);
}
fs.writeFileSync(process.argv[2],JSON.stringify(s,null,2)+'\n');
