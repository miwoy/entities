var _ = require('underscore');
var SQL = require('./SQL');
var models = require('./models').get();
var query = require('./query');
var common = require('./common');

/**
 * 更新数据，根据queryArgs条件更新
 * @param  {String}   modelName 模型名称
 * @param  {Object}   queryArgs     更新条件
 * @param  {Object}   data      更新数据
 * @param  {Function} callback  err or object
 */
var update = function(modelName, queryArgs, data, repository, callback) {

    //  参数匹配与检测
    if (_.isFunction(data)) {
        callback = data;
        data = queryArgs;
        queryArgs = null;
    }
    queryArgs = queryArgs || {};
    if (!_.isString(modelName) || !(!queryArgs || _.isObject(queryArgs)) || !_.isObject(data) || data === null)
        throw new Error("参数类型错误!");

    // 检测模型是否存在
    if (!(modelName in models)) throw new Error(modelName + "模型不存在!");

    /**
     * hook and extend
     */
    if (query.opts.globals) {
        let globals = query.opts.globals;
        if (globals.extend) {
            if (globals.extend.updateTime) {
                data.updateTime = data.updateTime || new Date();
            }

            if (globals.extend.logicDel) {
                queryArgs.deleteTime = null; 
            }
        }

        if (globals.beforeHooks) {
            if (globals.beforeHooks.update && _.isFunction(globals.beforeHooks.update)) globals.beforeHooks.update(queryArgs, data);
        }
    }

    var model = models[modelName];
        // model = new Model();

    // 模型检测
    if (queryArgs)
        common.checkObjForModel(model, queryArgs);

    if (data)
        common.checkObjForModel(model, data);

    var sql = new SQL(repository);
    sql.$method = "update";
    // var as = "$" + _.keys(sql.$table).length;
    var as = "$";
    sql.$table[as] = modelName;
    sql.$data = data;
    sql.convertQueryArgs(as, queryArgs);
    if (!callback) {
        return sql;
    }
    var sqlObj = sql.gSQL();
    return query(sqlObj.sql, sqlObj.args, repository, function(err, result) {
        if (err) return callback(err);

        if (result && result.changedRows>0) callback(null, true);
        else callback(null, false); 
    });

};


module.exports = update;
