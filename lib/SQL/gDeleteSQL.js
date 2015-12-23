var _ = require('underscore');
var gQuerySQL = require('./gQuerySQL');

/**
 * 生成删除语句，根据query条件删除
 * @param  {[type]} modelName [description]
 * @param  {[type]} query     [description]
 * @return {[type]}           [description]
 */
function gDeleteSQL(SQL) {
    var sql = "delete ";
    var args = [];

    sql += "from " + SQL.$table.$0 + " ";

    if (SQL.$where.$0) {
        var querySQL = gQuerySQL(SQL.$where);
        sql += " where " + querySQL.sql.replace(/\$0\./g, '') + " ";
        args = args.concat(querySQL.args);
    }

    return {
        sql: sql,
        args: args
    };
}


module.exports = gDeleteSQL;