var _ = require('underscore');

/**
 * 运算类型检查，辅助gQuerySQL构建查询参数语句
 * @param  {String} type 运算类型
 */
function checkType(type) {
    var checkArray = ["=", "!=", ">=", "<=", "<", ">", "like", "in"];
    if (checkArray.indexOf(type) < 0)
        throw new Error("type:" + type + "不合法,必须是(" + checkArray.toString() + ")中的符号");
}

/**
 * 格式化sql，从一个数组对象中。将一个数组转化成“?,?,?,?,?”字符串形式
 * 
 * @param  {[type]} arry [description]
 * @return {[type]}      [description]
 */
function formatSqlForArry(arry) {
	var _arry = [];
    _.each(arry, function(v, i) {
        _arry[i] = 0;
    });

    return _arry.join(",").replace(/[^,]+/g, "?");
}

module.exports = {
    checkType: checkType,
    formatSqlForArry: formatSqlForArry
};
