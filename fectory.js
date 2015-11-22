var _ = require('underscore');
var x = require('x-flow');
var models = {};
var repository = require('./repository');


_.mixin({
    allReplace: function(arry) {
        _.each(arry, function(v, i) {
            arry[i] = 0;
        });
        return arry;
    }
});

//repository.pool = mysql.createPool(config.mysql);


function Fectory() {
    this.queue = [];
}

Fectory.prototype.findOne = function(modelName, queryArgs, returnStruct, callback) {
    return findOne(modelName, queryArgs, returnStruct, this, callback);
};

Fectory.prototype.find = function(modelName, queryArgs, returnStruct, callback) {
    return find(modelName, queryArgs, returnStruct, this, callback);
};

Fectory.prototype.count = function(modelName, queryArgs, callback) {
    return count(modelName, queryArgs, this, callback);
};

Fectory.prototype.create = function(modelName, data, callback) {
    return create(modelName, data, this, callback);
};

Fectory.prototype.update = function(modelName, queryArgs, data, callback) {
    return update(modelName, queryArgs, data, this, callback);
};

Fectory.prototype.del = function(modelName, queryArgs, callback) {
    return del(modelName, queryArgs, this, callback);
};

Fectory.prototype.query = function(sql, args, callback) {
    return query(sql, args, this, callback);
};

Fectory.prototype.begin = function(callback) {
    return begin(callback);
};

/**
 * sql语句执行方法
 * 用来处理工厂无法满足的复杂sql语句
 * @param  {String}   sql      sql语句，命名以数据库命名为准，该程序不会转换命名
 * @param  {Array}   args     sql语句用到的参数
 * @param  {Function} callback err or result 当为查询语句时result默认返回命名转化后的数据
 */
var query = function(sql, args, ts, callback) {

    // console.log("debug:sql:", sql, "args:", args);

    if (!callback) {
        var _sql = new SQL(ts);
        _sql.__sql__ = sql;
        _sql.__args__ = args;
        return _sql;
    }

    if (ts && ts.trans) {
        ts.trans.query(sql, args, function(err, code, result) {
            if (_.isArray(result)) {
                _.each(result, function(value, index) {
                    var obj = {};
                    _.each(value, function(value, key) {
                        obj[convert_ToC(key)] = value;
                    });

                    result[index] = obj;
                });
            }
            callback(err, result);
        });


    } else {

        repository.query(sql, args, function(err, code, result) {
            if (_.isArray(result)) {
                _.each(result, function(value, index) {
                    var obj = {};
                    _.each(value, function(value, key) {
                        obj[convert_ToC(key)] = value;
                    });

                    result[index] = obj;
                });
            }
            callback(err, result);
        });
    }
};

/**
 * 开启一个事物
 * @param  {Function} callback 返回错误或一个仓库事物对象
 */
var begin = function(callback) {

    var self = this;
    // 事物方法
    var queue = [];

    var ts = {
        trans: {},
        count: function(modelName, queryArgs, callback) {
            return execQueue(queue, count, [modelName, queryArgs], this, callback);
        },
        findOne: function(modelName, queryArgs, returnStruct, callback) {
            return execQueue(queue, findOne, [modelName, queryArgs, returnStruct], this, callback);
        },
        find: function(modelName, queryArgs, returnStruct, callback) {
            if (!callback) {
                return find(modelName, queryArgs, returnStruct, this);
            }
            return execQueue(queue, find, [modelName, queryArgs, returnStruct], this, callback);
        },
        create: function(modelName, data, callback) {
            if (!callback) {
                return create(modelName, data, this);
            }
            return execQueue(queue, create, [modelName, data], this, callback);
        },
        update: function(modelName, queryArgs, data, callback) {
            if (!callback) {
                return update(modelName, queryArgs, data, this);
            }
            return execQueue(queue, update, [modelName, queryArgs, data], this, callback);
        },
        del: function(modelName, queryArgs, callback) {
            if (!callback) {
                return del(modelName, queryArgs, this);
            }
            return execQueue(queue, del, [modelName, queryArgs], this, callback);
        },
        commit: function(callback) {
            return execQueue(queue, commit, [], this, callback);
        },
        rollback: function(callback) {
            return execQueue(queue, this.trans.rollback, [], this, callback);
        },
        query: function(sql, args, callback) {
            if (!callback) {
                return query(sql, args, this);
            }
            return execQueue(queue, query, [sql, args], this, callback);
        }
    };




    return execQueue(queue, beginTrans, [], ts, function(err, result) {
        if (err) {
            if (callback)
                return callback(err);
            else
                throw err;
        }

        ts.trans = result;
        if (callback) callback(err, ts);
    });
};

/**
 * 事物提交方法
 * @param  {Object}   ts       当前事物对象
 * @param  {Function} callback 回调函数，返回错误
 */
var commit = function(ts, callback) {
    ts.trans.commit(function(err, code, result) {
        if (callback) callback(err, result);
    });
};

/**
 * 事物回滚方法
 * @param  {Object}   ts       事物对象
 * @param  {Function} callback 回调函数，返回错误
 */
var rollback = function(ts, callback) {
    ts.trans.rollback(function(err, code, result) {
        if (callback) callback(err, result);
    });
};

/**
 * 开始一个事物的方法
 * @param  {Object}   ts       事物对象
 * @param  {Function} callback 返回错误与仓储事物对象
 */
var beginTrans = function(ts, callback) {
    repository.begin(function(err, code, result) {
        if (callback) callback(err, result);
    });
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
    queryArgs.$limit = [0, 1]; // 限制查询一条数据

    if (!callback) {
        throw new Error("callback不能为null或undefined");
    }

    find(modelName, queryArgs, returnStruct, ts, function(err, results) {
        if (err) return callback(err);

        if (results.length > 0) {
            callback(err, results[0]);
        } else {
            callback(err, null);
        }
    });

};

/**
 * 查询多条数据
 * @param  {String}   modelName    模型名称
 * @param  {Object}   queryArgs     查找参数对象
 * @param  {Object}   returnStruct 返回结构
 * @param  {Function} callback     err or Array
 */
var find = function(modelName, queryArgs, returnStruct, ts, callback) {

    //  参数匹配与检测
    if (_.isFunction(queryArgs)) {
        callback = queryArgs;
        queryArgs = null;
    }

    if (_.isFunction(returnStruct)) {
        callback = returnStruct;
        returnStruct = null;
    }

    if (_.isFunction(ts)) {
        callback = ts;
        ts = returnStruct;
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
        checkObjForModel(model, queryArgs);

    if (returnStruct)
        checkObjForModel(model, returnStruct);

    var sql = new SQL(ts);
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
    if (sql.$andCount) {
        x.begin()
            .fork(query, [sqlObj.sql, sqlObj.args, ts])
            .fork(query, [sqlObj.countSql, sqlObj.countArgs, ts])
            .end(function(err, results) {
                if (err) {
                    return callback(err);
                }
                callback(err, {
                    data: results[0][0][0],
                    totalCount: results[1][0][0][0].count
                });
            });

        return;
    }

    query(sqlObj.sql, sqlObj.args, ts, callback);

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

    if (!callback) {
        throw new Error("callback不能为null或undefined");
    }

    queryArgs = queryArgs || {};
    if (!("$count" in queryArgs)) queryArgs.$count = true;
    find(modelName, queryArgs, null, ts, function(err, results) {
        if (err) return callback(err);

        if (results.length > 0) {
            callback(err, results[0].count || 0);
        } else {
            callback(err, 0);
        }
    });
};

/**
 * 新增数据，支持单条新增与多条新增
 * @param  {String}   modelName 模型名称
 * @param  {Object || Array}   data      新增数据对象会对象集合
 * @param  {Function} callback  err or object
 */
var create = function(modelName, data, ts, callback) {

    if (_.isFunction(ts)) {
        callback = ts;
        ts = null;
    }

    // 参数检测
    if (!_.isString(modelName) || !_.isObject(data))
        throw new Error("参数类型错误!");

    if (!(modelName in models))
        throw new Error(modelName + "模型不存在!");


    var model = new models[modelName]();
    if (_.isArray(data)) {
        _.each(data, function(dt) {
            checkObjForModel(model, dt);
        });
    } else {
        checkObjForModel(model, data);
    }


    var sql = new SQL(ts);
    sql.$method = "create";


    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    sql.$data = data;
    if (!callback) {
        return sql;
    }
    var sqlObj = sql.gSQL();
    return query(sqlObj.sql, sqlObj.args, ts, callback);


};

/**
 * 更新数据，根据queryArgs条件更新
 * @param  {String}   modelName 模型名称
 * @param  {Object}   queryArgs     更新条件
 * @param  {Object}   data      更新数据
 * @param  {Function} callback  err or object
 */
var update = function(modelName, queryArgs, data, ts, callback) {

    //  参数匹配与检测
    if (_.isFunction(data)) {
        callback = data;
        data = queryArgs;
        queryArgs = null;
    }

    if (_.isFunction(ts)) {
        callback = ts;
        ts = null;
    }

    if (!_.isString(modelName) || !(!queryArgs || _.isObject(queryArgs)) || !_.isObject(data))
        throw new Error("参数类型错误!");

    // 检测模型是否存在
    if (!(modelName in models)) throw new Error(modelName + "模型不存在!");


    var Model = models[modelName],
        model = new Model();

    // 模型检测
    if (queryArgs)
        checkObjForModel(model, queryArgs);

    if (data)
        checkObjForModel(model, data);

    var sql = new SQL(ts);
    sql.$method = "update";
    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    sql.$data = data;
    sql.convertQueryArgs(as, queryArgs);
    if (!callback) {
        return sql;
    }
    var sqlObj = sql.gSQL();
    return query(sqlObj.sql, sqlObj.args, ts, callback);

};

/**
 * 删除数据,根据queryArgs条件删除，queryArgs不能为null，必须有条件才能删除，否则抛出异常
 * @param  {String}   modelName 模型名称
 * @param  {Object}   queryArgs     删除条件
 * @param  {Function} callback  err or object
 */
var del = function(modelName, queryArgs, ts, callback) {

    if (_.isFunction(ts)) {
        callback = ts;
        ts = null;
    }
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
        checkObjForModel(model, queryArgs);
    var sql = new SQL(ts);
    var as = "$" + _.keys(sql.$table).length;
    sql.$table[as] = modelName;
    sql.$method = "delete";
    sql.convertQueryArgs(as, queryArgs);
    if (!callback) {
        return sql;
    }

    var sqlObj = sql.gSQL();
    return query(sqlObj.sql, sqlObj.args, ts, callback);

};



module.exports = {
    Fectory: Fectory,
    models: models,
    repository: repository
};

/**
 * 链式调用辅助类
 * 增删改查的链式调用，使用sql拼接方式，sql语句与使用的参数args均存放在此对象实例中
 * 最终执行exec函数统一执行
 * @param {Object} trans 事物时实例化传递的事物对象
 */
function SQL(content) {
    this.$method = "";
    this.$cols = [];
    this.$table = {};
    this.$where = {};
    this.$ob = null;
    this.$limit = [];
    this.$count = false;
    this.$data = [];
    this.$on = {};
    this.content = content;
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
    this.where = function(queryData) {

        if (_.isObject(queryData)) {
            var fromKeys = _.keys(this.$table),
                as = fromKeys[fromKeys.length - 1];
            this.convertQueryArgs(as, queryData);
        }
        return this;
    };

    /**
     * 排序方式，只用在select 语句中
     * @param  {Array || Sting} args 需用用到的排序字段，可以传入一个数组，也可以传入多个String的参数
     * @return {Object}              返回SQL对象
     */
    this.orderBy = function(args) {
        this.$ob = args;
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


        var Model = models[modelName],
            model = new Model();

        // 模型检测
        if (queryArgs)
            checkObjForModel(model, queryArgs);

        if (returnStruct)
            checkObjForModel(model, returnStruct);

        var as = "$" + _.keys(this.$table).length;
        this.$table[as] = modelName;
        if (queryArgs) this.convertQueryArgs(as, queryArgs);
        if (returnStruct) this.convertReturnStruct(as, returnStruct);


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


        var Model = models[modelName],
            model = new Model();

        // 模型检测
        if (onArgs)
            checkObjForModel(model, onArgs);

        if (returnStruct)
            checkObjForModel(model, returnStruct);

        var as = "$" + _.keys(this.$table).length;
        this.$table[as] = " left join " + modelName;
        if (onArgs) this.$on[as] = onArgs;
        if (returnStruct) this.convertReturnStruct(as, returnStruct);


        return this;
    };

    /**
     * 执行语句
     * @param  {Function} callback 错误和结果
     * @return {Object}            返回上级作用域对象（fectory or trans）
     */
    this.exec = function(callback) {
        var sqlObj = {};
        if (this.__sql__ && this.__args__) {
            sqlObj.sql = this.__sql__;
            sqlObj.args = this.__args__;
        } else {
            sqlObj = this.gSQL();
        }

        if (this.$andCount) {
            x.begin()
                .fork(query, [sqlObj.sql, sqlObj.args, null])
                .next(query, [sqlObj.countSql, sqlObj.countArgs, null])
                .end(function(err, results) {
                    if (err) {
                        return callback(err);
                    }

                    callback(err, {
                        data: results[0][0][0],
                        totalCount: results[0][1][0][0].count
                    });
                });

            return;

        }


        // 当为事物时调用事物query函数，并返回事物对象，不为事物时调用普通query函数
        query(sqlObj.sql, sqlObj.args, null, callback);

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
        if (/^\$.*/.test(k)) {
            self.analysisDirective(k, v);
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
            self.$cols.push(as + "." + k + " " + v);
        } else {
            self.$cols.push(as + "." + k);
        }
    });

    return returnStruct;
};

/**
 * 解析指令,解析指令会更改当前对象属性使之生效
 * @param  {String} directive 指令名称
 */
SQL.prototype.analysisDirective = function(directive, value) {
    switch (directive) {
        case "$ob":
            this.$ob = value;
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
    }
};


/**
 * 执行队列，暂为辅助事物实现链式调用功能而封装的方法
 * @param  {Array} trans 工厂事物对象
 * @param  {Function} func  事物使用的方法
 * @param  {Array} args  事物使用方法的参数列表
 * @return {Object}       返回工厂事物对象
 */
function execQueue(queue, func, args, ts, callback) {

    queue.push(function(next) {
        args.push(ts, function(err, result) {
            if (err) {
                queue.length = 0;
                return callback(err);
            }

            callback(err, result);
            next();
        });
        func.apply(this, args);
    });
    if (queue.length === 1) {
        ! function exec() {

            queue[0](function() {
                queue.shift();
                if (queue.length > 0) {
                    exec();
                }
            });

        }();
    }

    return ts;
}


/**
 * 模型验证，检测此对象属性是否全部属于模型，并与模型中属性类型吻合
 * @param  {Object} model 验证模型
 * @param  {Object} obj   待验证的对象
 * @return {Boolean} 验证成功返回true, 失败返回false
 */
function checkObjForModel(model, obj) {
    _.each(obj, function(v, k) {
        if (!(/\$/g.test(k) || k in model)) {

            throw new Error("模型检测失败：", obj);

        } else {
            // 检测值类型是否与模型中定的类型一致
            // if (!(_.isObject(v) && v.value.constructor === model[k].type)) {
            //     rlt = false;
            // }
        }
    });
}

/**
 * 命名转换，由小驼峰命名转换至匈牙利命名法
 * @param  {String} name 名称
 * @return {String}              转化后的值
 */
function convertCTo_(name) {
    return name.replace(/[A-Z]/g, function(v) {
        return "_" + v.toLowerCase();
    });
}

/**
 * 命名转换，由匈牙利命名法转为小驼峰
 * @param  {String} name 名称
 * @return {String}              转化后的值
 */
function convert_ToC(name) {
    return name.replace(/_[a-z]{0,1}/g, function(v) {
        return v.charAt(1).toUpperCase();
    });
}

/**
 * 生成查询sql语句
 * @return {[type]} [description]
 */
function gFindSQL(SQL) {
    var sql = "select ";
    var args = [];
    var countSql;
    var countArgs;

    if (SQL.$count) {
        sql += " count(*) count ";
    } else {
        if (SQL.$cols.length === 0) {
            sql += "* ";
        } else {
            sql += SQL.$cols.join(",") + " ";
        }
    }

    if (SQL.$andCount) {
        countSql = "select count(*) count ";
    }

    var tmpFrom = [];
    var tmpTable = {};
    _.each(SQL.$table, function(v, k) {
        if (/join/.test(v)) {
            tmpTable = tmpFrom[tmpFrom.length - 1];
            tmpTable += v + " " + k;
            if (SQL.$on[k]) {
                var on = {};
                on[k] = SQL.$on[k];
                var querySQL = gQuerySQL(on);
                tmpTable += " on " + querySQL.sql;
                args = args.concat(querySQL.args);
            }
            tmpFrom[tmpFrom.length - 1] = tmpTable;
        } else {
            tmpFrom.push(v + " " + k);
        }

    });
    sql += "from " + tmpFrom.join(",") + " ";
    if (SQL.$andCount) {
        countSql += "from " + tmpFrom.join(",") + " ";
    }
    if (_.keys(SQL.$where).length > 0) {
        var querySQL = gQuerySQL(SQL.$where);
        sql += "where " + querySQL.sql + " ";
        args = args.concat(querySQL.args);

        if (SQL.$andCount) {
            countSql += "where " + querySQL.sql + " ";
            countArgs = querySQL.args;
        }
    }

    if (SQL.$ob) {
        var _ob = [];
        _.each(SQL.$ob, function(v, k) {
            if (v === "desc")
                _ob.push(k + " " + v);
            else
                _ob.push(k);
        });
        sql += "order by " + _ob.join(",") + " ";
    }

    if ((SQL.$limit.length === 1 && SQL.$limit[0]) || (SQL.$limit.length === 2 && SQL.$limit[0] && SQL.$limit[1])) {
        sql += "limit " + formatSqlForArry(SQL.$limit);
        args = args.concat(SQL.$limit);
    }

    if (SQL.$andCount) {
        return {
            sql: convertCTo_(sql),
            args: args,
            countSql: convertCTo_(countSql),
            countArgs: countArgs
        };
    }
    return {
        sql: convertCTo_(sql),
        args: args
    };

}

/**
 * 生成新增数据sql语句，同时支持新增单条与多条数据，新增多条时必须保证结构完全一样
 * @param  {String} modelName 模型名称
 * @param  {Object || Array} data      新增的数据对象或对象数组
 */
function gCreateSQL(SQL) {
    var sql = "insert into ";
    var valueSql = " values ";
    var args = [];


    sql += _.values(SQL.$table).join(",");
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
                sql += "(" + _.keys(dt).join(",") + ") ";
            }
            _dts.push("(" + formatSqlForArry(_.values(dt)) + ")");
            args = args.concat(_.values(dt));
            _num++;
        });
        valueSql += _dts.join(",");
    } else {
        sql += "(" + _.keys(SQL.$data).join(",") + ") ";
        valueSql += "(" + formatSqlForArry(_.values(SQL.$data)) + ")";
        args = args.concat(_.values(SQL.$data));
    }

    sql = sql + valueSql;

    return {
        sql: convertCTo_(sql),
        args: args
    };

}

/**
 * 生成更新sql语句，根据query更新条件更新条目，当query为null时，更新所有条目,
 * @param  {String} modelName 模型名称
 * @param  {Object} query  查询参数
 * @param  {Object} data      更新数据
 */
function gUpdateSQL(SQL) {
    var sql = "update ";
    var args = [];
    var _keys = [];

    var tmpFrom = [];
    _.each(SQL.$table, function(v, k) {
        tmpFrom.push(v + " " + k);
    });
    sql += tmpFrom.join(",") + " ";
    //sql += SQL.$table.$0 + " ";

    sql += " set ";

    _.each(SQL.$data, function(value, key) {

        if (value !== undefined && value !== null) {
            _keys.push(key + "=?");
            args.push(value);
        }

    });

    sql += _keys.join(",");

    var sqlObj = gQuerySQL(query);
    sql += sqlObj.sql;
    args = args.concat(sqlObj.args);

    if (SQL.$where.$0) {
        var querySQL = gQuerySQL(SQL.$where);
        sql += " where " + querySQL.sql + " ";
        args = args.concat(querySQL.args);
    }

    return {
        sql: convertCTo_(sql),
        args: args
    };
}

/**
 * 生成删除语句，根据query条件删除
 * @param  {[type]} modelName [description]
 * @param  {[type]} query     [description]
 * @return {[type]}           [description]
 */
function gDeleteSQL(SQL) {
    var sql = "delete ";
    var args = [];

    sql += "from " + SQL.$table.$0 + " ";

    if (SQL.$where.$0) {
        var querySQL = gQuerySQL(SQL.$where);
        sql += " where " + querySQL.sql.replace('$0.', '') + " ";
        args = args.concat(querySQL.args);
    }

    return {
        sql: convertCTo_(sql),
        args: args
    };
}

/**
 * 生成查询参数（where）部分sql语句，
 * @param  {[type]} query [description]
 * @return {[type]}       [description]
 */
function gQuerySQL(where) {
    var sql = "";
    var args = [];
    var _keys = [];

    _.each(where, function(query, as) {


        // 遍历查询参数对象
        _.each(query, function(v, key) {

            key = as + "." + key;
            // 如果参数值为数组时
            if (_.isArray(v)) {
                _.each(v, function(v, i) {

                    // value类型为数组时
                    if (_.isArray(v.value)) {
                        if (v.type === "in") { // type为=时
                            _keys.push(key + " in (" + formatSqlForArry(v.value) + ")");

                            args = args.concat(v.value);
                        } else if (v.type === "=" || v.type === "!=") { // type为!=时
                            var _type = v.type;
                            _.each(v, function(v, i) {
                                _keys.push(key + _type + "?");

                            });
                            args = args.concat(v.value);
                        } else { // 其他
                            throw new Error("参数query类型错误，type必须为'=' or '!=':", query);
                        }

                    } else if (v.value !== undefined && v.value !== null) { //  否则为string或number时
                        checkType(v.type);
                        if (v.type === "like")
                            v.value = "%" + v.value + "%";
                        _keys.push(key + v.type + "?");
                        args.push(v.value);
                    }

                });
            } else if (_.isObject(v)) { // 否则为对象时


                // value类型为数组时
                if (_.isArray(v.value)) {
                    if (v.type === "in") { // type为=时
                        _keys.push(key + " in (" + formatSqlForArry(v.value) + ")");

                        args = args.concat(v.value);
                    } else if (v.type === "=" || v.type === "!=") { // type为!=时
                        var _type = v.type;
                        _.each(v, function(v, i) {
                            _keys.push(key + _type + "?");

                        });
                        args = args.concat(v.value);
                    } else { // 其他
                        throw new Error("参数query类型错误，type必须为'=' or '!=' or 'in':", query);
                    }

                } else if (v.value !== undefined && v.value !== null) { //  否则为string或number时
                    checkType(v.type);
                    if (v.type === "like")
                        v.value = "%" + v.value + "%";
                    if (_.isString(v.value) && /^\$\d+\.\w+$/.test(v.value.trim()))
                        _keys.push(key + " " + v.type + " " + v.value);
                    else {
                        _keys.push(key + " " + v.type + " " + "?");
                        args.push(v.value);
                    }

                }

            } else { // 其他
                throw new Error("参数query类型错误，参数值必须是数组或对象类型:", query);
            }



        });
    });
    if (_keys.length > 0)
        sql += _keys.join(" and ");



    return {
        sql: sql,
        args: args
    };

}

/**
 * 运算类型检查，辅助gQuerySQL构建查询参数语句
 * @param  {String} type 运算类型
 */
function checkType(type) {
    var checkArray = ["=", "!=", ">=", "<=", "<", ">", "like", "in"];
    if (checkArray.indexOf(type) < 0)
        throw new Error("type:" + type + "不合法,必须是(" + checkArray.toString() + ")中的符号");
}

function formatSqlForArry(arry) {
    _.each(arry, function(v, i) {
        arry[i] = 0;
    });

    return arry.join(",").replace(/[^,]+/g, "?");
}


/**
 * 关于指令，在复杂查询中未解决一些问题而设定的指令，一般指令放入查询参数中
 * 指令都是以$符号开头
 * $代表实体本身
 * 多表查询时，$0、$1...等代表多表查询的实体索引值，从0排序
 * 内联查询时，$left、$right用来表示左边实体与右边实体
 * 一些简单指令：
 * $count获取数据长度,$limit查询部分数据,$ob排序
 */


/**
 * 关于多表查询问题
 * 暂时解决方案为通过链式调用组装复合查询语句，一次请求返回数据
 * 可增加解决方案：实现模型的导航属性，在创建的实体中可直接获取关联数据
 * 并且对于一次性多表查询，可在返回数据结构参数中配置需要显示的关联数据与结构
 */

/**
 * 对于返回数据结构参数的值可写别名
 */
