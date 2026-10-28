import { readFile,readdir } from 'node:fs/promises';
import { database } from '../src/adapters/postgres/client';
const db=database();
try {
  for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
    const version=Number(file.split('_')[0]);const exists=await db.query("SELECT to_regclass('public.schema_migrations') AS name");
    if(exists.rows[0].name && (await db.query('SELECT 1 FROM schema_migrations WHERE version=$1',[version])).rowCount) console.log('Migration '+version+' already applied.');
    else {await db.query(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));console.log('Migration '+version+' applied.');}
  }
}catch{console.error('Migration failed. Check private database connectivity and schema state. No credentials logged.');process.exitCode=1;}
finally{await db.end();}
