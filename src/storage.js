const Database = require('better-sqlite3');
const fse = require('fs-extra');
let dbs = {};
const close = ()=>{
  for(let db in dbs.keys()) {
    dbs[db].close();
    delete dbs[db];
  }
};
const getDb = (path)=>{
  if(!dbs[path]) {
    try {
      const split = path.split('/');
      const pop = split.pop();
      console.log(pop);
      if(split.length > 1) fse.ensureDirSync(pop.join('/'))
    }catch(e) {
      console.error(e);
    }
    const db = new Database(path+'.db')
    return dbs[path] = {
      db,
      list : db.prepare(`SELECT name FROM sqlite_master;`)
    }
  } else return dbs[path];
}
const list = (path) => {
  const db = getDb(path);
  console.log(db);
  return db.list.all();
}
const init =(name)=> {
  const db = getDb(path).db;
  let hasdb = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE
    type='table' and name='${name}'
  ;`);
  let row = hasdb.get();
  if (row === undefined) {
    const sqlInit = `
  CREATE TABLE '${name}' (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    value BLOB
  );
  `;
    db.exec(sqlInit);
    const indexinit = `
  CREATE UNIQUE INDEX 'idx_${name}_name' ON '${name}' (name);
  `;
    db.exec(indexinit);
  }
  const dbRead = db.prepare(
    `SELECT value FROM '${name}' WHERE name IS $name`,
  );
  const dbLs = db.prepare(
    `SELECT name FROM '${name}'`,
  );
  
  const dbWrite = db.prepare(`REPLACE  INTO '${name}' (name, value) VALUES($name, $value)`);
  const read = name => {
    return dbRead.get({ name }).then();
  }
  const write = (name, value) => dbWrite.run({ name, value });
  const ls = ()=>{
    return dbLs.all()
  }
  const clear = ()=>{
    try {
    db.exec(`drop table '${name}'`);
    } catch(e) {

    }
  }
  return {read, write, ls, clear }
}


module.exports = { init, close, list };
