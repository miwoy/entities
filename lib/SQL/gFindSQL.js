var _ = require('underscore');
var tool = require('./tool');
var gQuerySQL = require('./gQuerySQL');

/**
 * 生成查询sql语句
 * @return {[type]} [description]
 */
function gFindSQL(SQL) {
    var sql = "select ";
    var args = [];
    var countSql;
    var countArgs;
    var querySQL;

    if (SQL.$count) {
        sql += " count(*) count ";
    } else {
        if (SQL.$cols.length === 0) {
            sql += "* ";
        } else {
            sql += SQL.$cols.join(",") + " ";
        }
    }



    var tmpFrom = [];
    var tmpTable = {};
    _.each(SQL.$table, function(v, k) {
        if (/join/.test(v)) {
            tmpTable = tmpFrom[tmpFrom.length - 1];
            tmpTable += v + " " + k;
            if (SQL.$on[k]) {
                var on = {};
                on[k] = SQL.$on[k];
                var querySQL = gQuerySQL(on);
                tmpTable += " on true " + (querySQL.sql && "and " + querySQL.sql);
                args = args.concat(querySQL.args);
            }
            tmpFrom[tmpFrom.length - 1] = tmpTable;
        } else {
            tmpFrom.push(v + " " + k);
        }

    });
    sql += "from " + tmpFrom.join(",") + " ";

    if (_.keys(SQL.$where).length > 0) {
        querySQL = gQuerySQL(SQL.$where);
        sql += "where " + querySQL.sql + " ";
        args = args.concat(querySQL.args);

    }

    // 嵌入查询部分
    sql = "select * from (" + sql + ") as $ ";

    
    if  (SQL.$filter && SQL.$filter.$ && _.keys(SQL.$filter.$).length > 0) {
        querySQL = gQuerySQL(SQL.$filter);
        sql += "where " + querySQL.sql + " ";
        args = args.concat(querySQL.args);

    }


    if (SQL.$andCount) {
            countSql = "select count(*) count from (" + sql + ") as $";
            countArgs = args;
        }

    if (SQL.$ob) {
        var _ob = [];
        _.each(SQL.$ob, function(v, k) {
            k = "`" + k + "`";
            if (v === "desc")
                _ob.push(k + " " + v);
            else
                _ob.push(k);
        });
        sql += "order by " + _ob.join(",") + " ";
    }

    if ((SQL.$limit.length === 1 && (SQL.$limit[0]=parseInt(SQL.$limit[0])) >= 0 )|| (SQL.$limit.length === 2 && (SQL.$limit[0]=parseInt(SQL.$limit[0])) >= 0 && (SQL.$limit[1]=parseInt(SQL.$limit[1])) >= 0)) {
        sql += "limit " + tool.formatSqlForArry(SQL.$limit);
        args = args.concat(SQL.$limit);
    }
    

    if (SQL.$andCount) {
        return {
            sql: sql,
            args: args,
            countSql: countSql,
            countArgs: countArgs
        };
    }
    return {
        sql: sql,
        args: args
    };

}

module.exports = gFindSQL;