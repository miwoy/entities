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

    sql += "from " + SQL.$table.$ + " ";

    if (SQL.$where.$) {
        var querySQL = gQuerySQL(SQL.$where);
        sql += " where " + querySQL.sql.replace(/\$\./g, '') + " ";
        args = args.concat(querySQL.args);
    }

    return {
        sql: sql,
        args: args
    };
}


module.exports = gDeleteSQL;