var _ = require('underscore');
var directiveCollections = {
	$count:null,
	$andCount: null,
	$limit: null,
	$ob: null
};

/**
 * 指令分为两种类型
 * 第一：sql构建时处理的
 * 第二：数据库操作完成后，处理结果的
 */


module.exports = function (SQL) {
	_.each(SQL, function(v, k) {
		var directive = directiveCollections[k];
		if (directive) {
			directive(SQL);
		}
	});
};