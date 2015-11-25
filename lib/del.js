var _ = require('underscore');
var SQL = require('./SQL');
var models = require('./models').get();
var query = require('./query');
var tool = require('./common');

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


    var model = new models[modelName]();
    // 模型检测
    if (queryArgs)
        tool.checkObjForModel(model, queryArgs);
    var sql = new SQL(repository);
    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    sql.$method = "delete";
    sql.convertQueryArgs(as, queryArgs);
    if (!callback) {
        return sql;
    }

    var sqlObj = sql.gSQL();
    query(sqlObj.sql, sqlObj.args, repository, callback);

};


module.exports = del;