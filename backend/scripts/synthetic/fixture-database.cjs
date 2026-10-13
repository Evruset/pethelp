// Only explicitly selected local synthetic generations are eligible for tooling.
const BASE_DATABASE='synthetic_multiclinic_v4';
function isFixtureDatabase(name){return typeof name==='string'&&(name===BASE_DATABASE||/^synthetic_multiclinic_v4_r_[a-f0-9]{12}$/.test(name));}
function selectedDatabase(name=BASE_DATABASE){if(!isFixtureDatabase(name))throw Error('INVALID_SYNTHETIC_DATABASE_NAME');return name;}
module.exports={BASE_DATABASE,isFixtureDatabase,selectedDatabase};
