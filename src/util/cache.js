const hyperdrivestorage = require('./storage.js');

const cache = {
}

exports.setCache = async (p, name, before = d => d) => {
    cache[name] = cache[name] || {};
    const update = async () => {
        let src = await hyperdrivestorage.read(p);
        return {
            time: new Date().getTime(),
            value: before(src)
        };
    }
    if (!cache[name][p]) {
        cache[name][p] = await update();
    }
}
exports.getCache = (name, p) => {
    return cache[name][p].value;
}