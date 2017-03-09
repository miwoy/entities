var _ = require('underscore');
var SQL = require('./SQL');
var models = require('./models').get();
var query = require('./query');
var common = require('./common');
var update = require('./update');

/**
 * 删除数据,根据queryArgs条件删除，queryArgs不能为null，必须有条件才能删除，否则抛出异常
 * @param  {String}   modelName 模型名称
 * @param  {Object}   queryArgs     删除条件
 * @param  {Function} callback  err or object
 */
var del = function(modelName, queryArgs, repository, callback) {

    // 参数检测
    if (!_.isString(modelName) || !_.isObject(queryArgs))
        throw new Error("参数类型错误!");
    if (_.keys(queryArgs).length <= 0)
        throw new Error("必须有删除条件queryArgs！");
    if (!(modelName in models))
        throw new Error(modelName + "模型不存在!");

    var model = models[modelName];
    // 模型检测
    if (queryArgs)
        common.checkObjForModel(model, queryArgs);

    /**
     * hook and extend
     */
    if (query.opts.globals) {
        let globals = query.opts.globals;
        if (globals.extend) {
            if (globals.extend.logicDel) {
                return update(modelName, queryArgs, { deleteTime: new Date() }, repository, callback);
            }
        }

        if (globals.beforeHooks) {
            if (globals.beforeHooks.del && _.isFunction(globals.beforeHooks.del)) globals.beforeHooks.del(data);
        }
    }

    var sql = new SQL(repository);
    // var as = "$" + _.keys(sql.$table).length;
    var as = "$";
    sql.$table[as] = modelName;
    sql.$method = "delete";
    sql.convertQueryArgs(as, queryArgs);
    if (!callback) {
        return sql;
    }

    var sqlObj = sql.gSQL();
    query(sqlObj.sql, sqlObj.args, repository, function(err, result) {
        if (err) return callback(err);

        if (result && result.changedRows > 0) callback(null, true);
        else callback(null, false);
    });

};


module.exports = del;
