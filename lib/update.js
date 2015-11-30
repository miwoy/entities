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

    if (!_.isString(modelName) || !(!queryArgs || _.isObject(queryArgs)) || !_.isObject(data))
        throw new Error("参数类型错误!");

    // 检测模型是否存在
    if (!(modelName in models)) throw new Error(modelName + "模型不存在!");


    var Model = models[modelName],
        model = new Model();

    // 模型检测
    if (queryArgs)
        common.checkObjForModel(model, queryArgs);

    if (data)
        common.checkObjForModel(model, data);

    var sql = new SQL(repository);
    sql.$method = "update";
    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    sql.$data = data;
    sql.convertQueryArgs(as, queryArgs);
    if (!callback) {
        return sql;
    }
    var sqlObj = sql.gSQL();
    return query(sqlObj.sql, sqlObj.args, repository, callback);

};


module.exports = update;
