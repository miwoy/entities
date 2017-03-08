var _ = require('underscore');
var tool = require('./tool');


/**
 * 生成新增数据sql语句，同时支持新增单条与多条数据，新增多条时必须保证结构完全一样
 * @param  {String} modelName 模型名称
 * @param  {Object || Array} data      新增的数据对象或对象数组
 */
function gCreateSQL(SQL) {
    var sql = "insert into ";
    var valueSql = " values ";
    var args = [];


    sql += "`" + _.values(SQL.$table).join("`,`") + "`";
    // sql += "(" + SQL.$cols.join(",") + ") ";
    // _.each(SQL.$data, function(v, i) {
    //     SQL.$data[i] = "(" + v.join(",").replace(/[^,]+/g, "?") + ")";
    //     args = args.concat(v);
    // });
    // sql += "values" + SQL.$data.join(",");

    if (_.isArray(SQL.$data)) {
        var _num = 0;
        var _dts = [];
        _.each(SQL.$data, function(dt, index) {
            if (_num === 0) {
                var keys = _.keys(dt);
                _.each(keys, function(item, i) {
                    keys[i] = "`" + item + "`";
                });

                sql += "(" + keys.join(",") + ") ";
            }
            _dts.push("(" + tool.formatSqlForArry(_.values(dt)) + ")");
            args = args.concat(_.values(dt));
            _num++;
        });
        valueSql += _dts.join(",");
    } else {
        var keys = _.keys(SQL.$data);
        _.each(keys, function(item, i) {
            keys[i] = "`" + item + "`";
        });
        sql += "(" + keys.join(",") + ") ";
        valueSql += "(" + tool.formatSqlForArry(_.values(SQL.$data)) + ")";
        args = args.concat(_.values(SQL.$data));
    }

    sql = sql + valueSql;

    return {
        sql: sql,
        args: args
    };

}

module.exports = gCreateSQL;
