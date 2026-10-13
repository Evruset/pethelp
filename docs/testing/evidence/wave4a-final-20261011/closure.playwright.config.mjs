import original from './playwright.config.mjs';
export default {...original, retries:0, outputDir:'../../docs/testing/evidence/wave4a-final-20261011/browser', webServer:{...original.webServer, command:'/Users/evrusetskiy/.npm/_npx/56b7e88bf8a51914/node_modules/node/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3411', reuseExistingServer:false}};
