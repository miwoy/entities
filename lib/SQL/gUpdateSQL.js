var _ = require('underscore');
var gQuerySQL = require('./gQuerySQL');


/**
 * 生成更新sql语句，根据query更新条件更新条目，当query为null时，更新所有条目,
 * @param  {String} modelName 模型名称
 * @param  {Object} query  查询参数
 * @param  {Object} data      更新数据
 */
function gUpdateSQL(SQL) {
    var sql = "update ";
    var args = [];
    var _keys = [];

    var tmpFrom = [];
    _.each(SQL.$table, function(v, k) {
        tmpFrom.push("`" + v + "`" + " " + k);
    });
    sql += tmpFrom.join(",") + " ";
    //sql += SQL.$table.$0 + " ";

    sql += " set ";

    _.each(SQL.$data, function(value, key) {
        key = "`" + key + "`";
        if (_.isString(value) && /^\$\..+$/.test(value.trim())) {
            _keys.push(key + "=" + value);
        } else {
            _keys.push(key + "=?");
            args.push(value);
        }

    });

    sql += _keys.join(",");


    if (SQL.$where.$) {
        var querySQL = gQuerySQL(SQL.$where);
        sql += " where " + querySQL.sql + " ";
        args = args.concat(querySQL.args);
    }

    return {
        sql: sql,
        args: args
    };
}


module.exports = gUpdateSQL;
