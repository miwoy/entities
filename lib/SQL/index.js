var _ = require('underscore');
var x = require('x-flow');
var common = require('../common');
var query = require('../query');
var models = require('../models').get();

var gFindSQL = require('./gFindSQL.js');
var gQuerySQL = require('./gQuerySQL');
var gCreateSQL = require('./gCreateSQL');
var gUpdateSQL = require('./gUpdateSQL');
var gDeleteSQL = require('./gDeleteSQL');

/**
 * 封装javascript属性与sql语句的对应关系
 * 链式调用辅助类
 * 增删改查的链式调用，使用sql拼接方式，sql语句与使用的参数args均存放在此对象实例中
 * 最终执行exec函数统一执行
 * sql映射管理
 * @param {Object} trans 事物时实例化传递的事物对象
 */
function SQL(context) {
    this.$method = ""; // sql 语句方法(select、insert、update、delete)
    this.$cols = []; // 查询列
    this.$table = {}; // 操作表
    this.$where = {}; // 条件
    this.$filter = null; // 关联查询的内置过滤器
    this.$ob = {}; // 排序字段
    this.$limit = []; // 限制条件
    this.$count = false;
    this.$data = [];
    this.$on = {};
    this.$distinct = 0;
    this.context = context;
    this.__sql__ = null;
    this.__args__ = null;



    /**
     * 获取当前条件下的数据长度
     * @return {Object} 返回SQL对象
     */
    this.count = function() {
        this.$count = true;
        return this;
    };

    /**
     * limit实现，与$limit异曲同工
     * @param  {Array || Number} lmtData limit所需参数，可以是一个数组对象也可以是两个参数
     * @return {Object}                  返回SQL对象
     */
    this.limit = function(lmtData) {
        if (!_.isArray(lmtData)) {
            this.$limit.push(arguments[0], arguments[1]);
        } else {
            this.$limit = lmtData;
        }

        return this;
    };

    /**
     * 第二种方式构建limit，指定limit第一个参数，跳过多少行
     * @param  {Number} skip 跳过的行数
     * @return {Object}      返回SQL对象
     */
    this.skip = function(skip) {
        this.$limit[0] = skip;
        return this;
    };

    /**
     * 第二种方式构建limit，指定limit第二个参数，获取多少行
     * @param  {Number} take 要获取的行数
     * @return {Object}      返回SQL对象
     */
    this.take = function(take) {
        this.$limit[1] = take;
        return this;
    };

    /**
     * 查询参数，分解参数用来组装where语句
     * @param  {Object} queryData 查询参数
     * @return {Object}           返回SQL对象
     */
    this.where = function(filterData) {
        var self = this;
        var returnArgs = {};
        if (_.isObject(filterData)) {
            _.each(filterData, function(v, k) {
                if (/^\$.*/.test(k) && k !== "$and" && k !== "$or") {
                    self.analysisDirective(k, v, "$");
                } else {
                    returnArgs[k] = v;
                }
            });
            this.$filter = this.$filter || {};
            this.$filter.$ = _.extend(this.$filter.$ || {}, returnArgs);
        }
        return this;
    };

    /**
     * 排序方式，只用在select 语句中
     * @param  {Array || Sting} args 需用用到的排序字段，可以传入一个数组，也可以传入多个String的参数
     * @return {Object}              返回SQL对象
     */
    this.ob = function(args) {
        this.$ob.$ = args;
        return this;

    };

    /**
     * 多表联合查询
     * @param  {String} modelName    模型名称
     * @param  {Object} queryArgs    查询参数
     * @param  {Object} returnStruct 返回结构
     * @return {Object}              返回SQL对象
     */
    this.and = function(modelName, queryArgs, returnStruct) {

        if (!_.isString(modelName) || !(!queryArgs || _.isObject(queryArgs)) || !(!returnStruct || _.isObject(returnStruct)))
            throw new Error("参数类型错误!");

        // 检测模型是否存在
        if (!(modelName in models)) throw new Error(modelName + "模型不存在!");


        var model = models[modelName];
        // model = new Model();

        // 模型检测
        if (queryArgs)
            common.checkObjForModel(model, queryArgs);

        if (returnStruct)
            common.checkObjForModel(model, returnStruct);

        var as = "$" + _.keys(this.$table).length;
        this.$table[as] =  modelName;
        if (queryArgs) this.convertQueryArgs(as, queryArgs);


        // if (!returnStruct) {
        //     returnStruct = model;
        // }

        // /**
        //  * 避免出现重复id，赋予关联表id别名
        //  * 根据需求，可在convertReturnStruct对所有查询表未配置别名的都赋予表名加列名的别名
        //  */
        // _.each(returnStruct, function(v, k) {
        //     if (!_.isString(v)) {
        //         returnStruct[k] = modelName + common.convertC2P(k);
        //     }

        // });
        this.convertReturnStruct(as, returnStruct);


        return this;
    };

    /**
     * 已内联方式复合查询，默认左联接
     * @param  {String} modelName    模型名称
     * @param  {Object} onArgs    查询参数
     * @param  {Object} returnStruct 返回结构
     * @return {Object}              返回SQL对象
     */
    this.join = function(modelName, onArgs, returnStruct) {
        if (!_.isString(modelName) || !(!onArgs || _.isObject(onArgs)) || !(!returnStruct || _.isObject(returnStruct)))
            throw new Error("参数类型错误!");

        // 检测模型是否存在
        if (!(modelName in models)) throw new Error(modelName + "模型不存在!");


        var model = models[modelName];
        // model = new Model();

        // 模型检测
        if (onArgs)
            common.checkObjForModel(model, onArgs);

        if (returnStruct)
            common.checkObjForModel(model, returnStruct);

        var as = "$" + _.keys(this.$table).length;
        this.$table[as] = " left join `" + modelName + "`";
        if (onArgs) {
            /**
             * 拆分条件，关联条件放置在on后面，查询条件放置在where后面
             */
            if (onArgs.$where) {
                this.$where[as] = onArgs.$where;
                delete onArgs.$where;
            }

            this.$on[as] = onArgs || {};
        }

        if (returnStruct) {
            /**
             * 避免出现重复id，赋予关联表id别名
             * 根据需求，可在convertReturnStruct对所有查询表未配置别名的都赋予表名加列名的别名
             */
            _.each(returnStruct, function(v, k) {
                if (!_.isString(v)) {
                    returnStruct[k] = k;
                }

            });
            this.convertReturnStruct(as, returnStruct);
        }


        return this;
    };

    /**
     * 执行语句
     * @param  {Function} callback 错误和结果
     * @return {Object}            返回上级作用域对象（factory or trans）
     */
    this.exec = function(callback) {

        var sqlObj = {};
        var self = this;

        if (this.__sql__ && this.__args__) {
            sqlObj.sql = this.__sql__;
            sqlObj.args = this.__args__;
        } else {
            sqlObj = this.gSQL();
        }
        return new Promise(function(resolve, reject) {
            // 处理$andCount 指令
            if (self.$andCount) {
                x.begin()
                    .fork(function(ctx) {
                        query(sqlObj.sql, sqlObj.args, self.context, function(err, result) {
                            if (err) {
                                return ctx.err(err);
                            }
                            ctx.data = result;
                            ctx.end();
                        });
                    })
                    .fork(function(ctx) {
                        query(sqlObj.countSql, sqlObj.countArgs, self.context, function(err, result) {
                            if (err) {
                                return ctx.err(err);
                            }

                            ctx.totalCount = result[0].count;
                            ctx.end();
                        });
                    })
                    .exec(function(err, results) {
                        if (err) {
                            return callback ? callback(err) : reject(err);
                        }

                        callback ? callback(err, {
                            data: results[0].data,
                            totalCount: results[1].totalCount,
                            skip: self.$limit[0],
                            take: self.$limit[1]
                        }) : resolve({
                            data: results[0].data,
                            totalCount: results[1].totalCount,
                            skip: self.$limit[0],
                            take: self.$limit[1]
                        });
                    });

                return;

            }

            // $count directive
            if (self.$count) {
                query(sqlObj.sql, sqlObj.args, self.context, function(err, result) {
                    if (err) {
                        return callback ? callback(err) : reject(err);
                    }

                    callback ? callback(err, result[0].count) : resolve(result[0].count);
                });

                return;
            }

            // $one directive
            if (self.$one) {
                query(sqlObj.sql, sqlObj.args, self.context, function(err, result) {
                    if (err) {
                        return callback ? callback(err) : reject(err);
                    }

                    callback ? callback(err, result[0] || null) : resolve(result[0] || null);
                });
                return;
            }

            query(sqlObj.sql, sqlObj.args, self.context, function(err, result) {
                if (err) return callback ? callback(err) : reject(err);

                switch (self.$method) {
                    case "create":
                        result = self.$data;
                        break;
                    case "update":
                        result = result.changedRows > 0;
                        break;
                    case "delete":
                        result = result.changedRows > 0;
                }


                callback ? callback(err, result) : resolve(result);
            });
        });


    };
}

SQL.prototype.gSQL = function() {
    var func = null;
    switch (this.$method) {

        case "select":
            func = gFindSQL;
            break;
        case "create":
            func = gCreateSQL;
            break;
        case "update":
            func = gUpdateSQL;
            break;
        case "delete":
            func = gDeleteSQL;
            break;
    }

    return func.call(this, this);

};

/**
 * 格式化查询参数，赋值给内部属性，用来生成sql语句
 * @param  {Object} queryArgs 查询参数
 */
SQL.prototype.convertQueryArgs = function(as, queryArgs) {
    var self = this;
    var returnArgs = {};
    _.each(queryArgs, function(v, k) {
        if (/^\$.*/.test(k) && k !== "$and" && k !== "$or") {
            self.analysisDirective(k, v, as);
        } else {
            returnArgs[k] = v;
        }
    });

    if (_.keys(returnArgs).length > 0)
        this.$where[as] = _.extend(this.$where[as] || {}, returnArgs);

    return returnArgs;

};


/**
 * 格式化返回格式参数，赋值给内部属性，用来生成sql语句
 * @param  {Object} returnStruct 返回格式参数
 */
SQL.prototype.convertReturnStruct = function(as, returnStruct) {
    var self = this;
    var table = this.$table[as];
    _.each(returnStruct, function(v, k) {
        if (_.isString(v)) {
            self.$cols.push(as + ".`" + k + "` " + v);
        } else {
            self.$cols.push(as + ".`" + k + "`");
        }
    });

    return returnStruct;
};

/**
 * 解析指令,解析指令会更改当前对象属性使之生效
 * @param  {String} directive 指令名称
 */
SQL.prototype.analysisDirective = function(directive, value, as) {
    switch (directive) {
        case "$ob":
            this.$ob[as] = value;
            break;
        case "$limit":
            this.$limit = value;
            break;
        case "$count":
            this.$count = true;
            break;
        case "$andCount":
            this.$andCount = true;
            break;
        case "$one":
            this.$one = value;
            break;
        case "$distinct":
            this.$distinct = 1;
            break;
    }
};

module.exports = SQL;

/**
 * 针对于增删改查，构建不同的SQL对象返回，对象上拥有当前操作需要的sql方法
 * 
 */
