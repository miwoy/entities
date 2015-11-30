var _ = require('underscore');
var SQL = require('./SQL');
var common = require('./common');




/**
 * sql语句执行方法
 * 用来处理工厂无法满足的复杂sql语句
 * @param  {String}   sql      sql语句，命名以数据库命名为准，该程序不会转换命名
 * @param  {Array}   args     sql语句用到的参数
 * @param  {Function} callback err or result 当为查询语句时result默认返回命名转化后的数据
 */
var query = function(sql, args, repository, callback) {

    console.log("debug:sql:", sql, "args:", args);

    if (!callback) {
        var _sql = new SQL(repository);
        _sql.__sql__ = sql;
        _sql.__args__ = args;
        return _sql;
    }

    sql = common.convertC2_(sql);

    repository.query(sql, args, function(err, code, result) {
        if (_.isArray(result)) {
            _.each(result, function(value, index) {
                var obj = {};
                _.each(value, function(value, key) {
                    obj[common.convert_2C(key)] = value;
                });

                result[index] = obj;
            });
        }
        callback(err, result);
    });
};


module.exports = query;
