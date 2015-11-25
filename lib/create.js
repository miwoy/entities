var _ = require('underscore');
var SQL = require('./SQL');
var models = require('./models').get();
var query = require('./query');
var tool = require('./common');


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

    if (!(modelName in models))
        throw new Error(modelName + "模型不存在!");


    var model = new models[modelName]();
    if (_.isArray(data)) {
        _.each(data, function(dt) {
            tool.checkObjForModel(model, dt);
        });
    } else {
        tool.checkObjForModel(model, data);
    }


    var sql = new SQL(repository);
    sql.$method = "create";


    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    sql.$data = data;
    if (!callback) {
        return sql;
    }
    var sqlObj = sql.gSQL();
    query(sqlObj.sql, sqlObj.args, repository, callback);


};

module.exports = create;
