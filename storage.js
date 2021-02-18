const Database = require('better-sqlite3');
const fse = require('fs-extra');
let db;
const close = ()=>{db.close(); db = null};
const init =(path, name)=> {
  try {
    if(!db) db = new Database(path+'.db');
    let list = db.prepare(`
    SELECT name FROM sqlite_master
    ;`);
  } catch(e) {
    const split = path.split('/');
    split.pop();
    const dir=split.join('/');
    try {
      fse.ensureDirSync(dir)
    }catch(e) {
      console.error(e);
    }
    //console.log(path);
    db = new Database(path+'.db');
  }
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
  const read = name => dbRead.get({ name });
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


module.exports = { init, close };
