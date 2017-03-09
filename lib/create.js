var _ = require('underscore');
var SQL = require('./SQL');
var models = require('./models').get();
var query = require('./query');
var common = require('./common');


/**
 * 新增数据，支持单条新增与多条新增
 * @param  {String}   modelName 模型名称
 * @param  {Object || Array}   data      新增数据对象会对象集合
 * @param  {Function} callback  err or object
 */
var create = function(modelName, data, repository, callback) {

    // 参数检测
    if (!_.isString(modelName) || !_.isObject(data))
        throw new Error("参数类型错误!");
    if (data === null || data === undefined || (_.isArray(data) && data.length === 0))
        throw new Error("data参数值有误:", data);
    if (!(modelName in models))
        throw new Error(modelName + "模型不存在!");

    /**
     * hook and extend
     */
    if (query.opts.globals) {
        let globals = query.opts.globals;
        if (globals.extend) {
            if (globals.extend.createTime) {
                data.createTime = data.createTime || new Date();
            }

            if (globals.extend.updateTime) {
                data.updateTime = data.updateTime || new Date();
            }
        }

        if (globals.beforeHooks) {
            if (globals.beforeHooks.create && _.isFunction(globals.beforeHooks.create)) globals.beforeHooks.create(data);
        }
    }

    var model = models[modelName];
    if (_.isArray(data)) {
        _.each(data, function(dt) {
            common.checkObjForModel(model, dt);
        });
    } else {
        common.checkObjForModel(model, data);
    }


    var sql = new SQL(repository);
    sql.$method = "create";


    // var as = "$" + _.keys(sql.$table).length;
    var as = "$";
    sql.$table[as] = modelName;
    sql.$data = data;
    if (!callback) {
        return sql;
    }
    var sqlObj = sql.gSQL();
    query(sqlObj.sql, sqlObj.args, repository, function(err, result) {
        if (err) return callback(err);
        callback(null, data);
    });


};

module.exports = create;
