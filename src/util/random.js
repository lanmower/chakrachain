
const shuffle = exports.shuffle = (count, array,seed) => {
	array = [...array];
	for (let index = array.length - 1; index > (array.length-count); index--) {
		const newIndex = (alea(seed).int32()+2147483648)  % (index + 1);
		[array[index], array[newIndex]] = [array[newIndex], array[index]];
	}
	return array;
};
exports.getList = (count, pool, seed)=> {
  const arr=[];for(x=0;x<pool;x++) arr.push(x);
  return shuffle(count, arr, seed);
}
