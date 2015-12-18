var _ = require('underscore');
var x = require('x-flow');
var SQL = require('./SQL/index');
var models = require('./models').get();
var query = require('./query');
var common = require('./common');
/**
 * 查询多条数据
 * @param  {String}   modelName    模型名称
 * @param  {Object}   queryArgs     查找参数对象
 * @param  {Object}   returnStruct 返回结构
 * @param  {Function} callback     err or Array
 */
var find = function(modelName, queryArgs, returnStruct, repository, callback) {
    //  参数匹配与检测
    if (_.isFunction(queryArgs)) {
        callback = queryArgs;
        queryArgs = null;
    }

    if (_.isFunction(returnStruct)) {
        callback = returnStruct;
        returnStruct = null;
    }


    if (!_.isString(modelName) || !(!queryArgs || _.isObject(queryArgs)) || !(!returnStruct || _.isObject(returnStruct)))
        throw new Error("参数类型错误!");

    // 检测模型是否存在
    if (!(modelName in models)) throw new Error(modelName + "模型不存在!");


    var Model = models[modelName],
        model = new Model();

    // 模型检测
    if (queryArgs)
        common.checkObjForModel(model, queryArgs);

    if (returnStruct)
        common.checkObjForModel(model, returnStruct);

    var sql = new SQL(repository);
    sql.$method = "select";
    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    if (queryArgs) sql.convertQueryArgs(as, queryArgs);
    if (returnStruct) {
        sql.convertReturnStruct(as, returnStruct);
    } else {
        sql.convertReturnStruct(as, model);
    }

    if (!callback) {
        return sql;
    }


    var sqlObj = sql.gSQL();

    // $andCount directive
    if (sql.$andCount) {
        x.begin()
            .fork(function(ctx) {
                query(sqlObj.sql, sqlObj.args, repository, function(err, result) {
                    if (err) {
                        return ctx.err(err);
                    }
                    ctx.data = result;
                    ctx.end();
                });
            })
            .fork(function(ctx) {
                query(sqlObj.countSql, sqlObj.countArgs, repository, function(err, result) {
                    if (err) {
                        return ctx.err(err);
                    }

                    ctx.totalCount = result[0].count;
                    ctx.end();
                });
            })
            .exec(function(err, results) {
                if (err) {
                    return callback(err);
                }

                callback(err, {
                    data: results[0].data,
                    totalCount: results[1].totalCount
                });
            });

        return;
    }

    // $count directive
    if(sql.$count) {
        query(sqlObj.sql, sqlObj.args, repository, function(err, result) {
            if (err) {
                return callback(err);
            }

            callback(err, result[0].count);
        });

        return;
    }

    // $one directive
    if (sql.$one) {
        query(sqlObj.sql, sqlObj.args, repository, function(err, result) {
            if (err) {
                return callback(err);
            }

            callback(err, result[0] || null);
        });

        return;
    }

    query(sqlObj.sql, sqlObj.args, repository, callback);

};


/**
 * 查找单条记录
 * 可优化，sql语句构建时加上limit 0,1
 * @param  {String}   modelName    模型名称
 * @param  {Object}   queryArgs     查找参数对象
 * @param  {Object}   returnStruct 返回结构
 * @param  {Function} callback     err or Object
 */
var findOne = function(modelName, queryArgs, returnStruct, ts, callback) {
    //  参数匹配与检测
    if (_.isFunction(queryArgs)) {
        callback = queryArgs;
        queryArgs = null;
        returnStruct = null;
    }

    if (_.isFunction(returnStruct)) {
        callback = returnStruct;
        if (_.isArray(queryArgs)) {
            returnStruct = queryArgs;
            queryArgs = null;
        } else {
            returnStruct = null;
        }
    }

    if (_.isFunction(ts)) {
        callback = ts;
        ts = null;
    }

    queryArgs = queryArgs || {}; // 初始化queryArgs
    queryArgs.$one = 1;
    queryArgs.$limit = [0, 1]; // 限制查询一条数据

    return find(modelName, queryArgs, returnStruct, ts, callback);

};

/**
 * 查询条数
 * @param  {String}   modelName    模型名称
 * @param  {Object}   queryArgs     查找参数对象
 * @param  {Function} callback     err or count
 */
var count = function(modelName, queryArgs, ts, callback) {
    //  参数匹配与检测
    if (_.isFunction(queryArgs)) {
        callback = queryArgs;
        queryArgs = {};
    }

    if (_.isFunction(ts)) {
        callback = ts;
        ts = null;
    }

    queryArgs = queryArgs || {};
    if (!("$count" in queryArgs)) queryArgs.$count = true;
    return find(modelName, queryArgs, null, ts, callback);
};

find.count = count;
find.one = findOne;

module.exports = find;
