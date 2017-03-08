var factory = require("./factory");
var models = require('./lib/models');
var common = require('./lib/common');
var repository = require('./repository');


var _ = require('underscore');
var x = require('x-flow');

module.exports = {
    Factory: factory.Factory, // 准备废弃
    getModel: models.get,
    setModel: models.set,
    init: function(opts, mds) {
        if (mds) {

            if (opts.globals) {
                let baseModel = opts.globals.baseModel || {};
                let extend = opts.globals.extend; // 模型扩展

                if (extend && _.isObject(extend)) {
                    if (extend.createTime) baseModel.createTime = {
                        type: Date,
                        index: 1
                    }
                    if (extend.updateTime) baseModel.updateTime = {
                        type: Date,
                        index: 1
                    }
                    if (extend.logicDel) baseModel.deleteTime = {
                        type: Date,
                        index: 1
                    }
                }

                _.each(mds, function(model, key) {
                    mds[key] = _.extend(opts.globals.baseModel, model);
                });

            }
            models.set(mds);
        }
        var map = opts.map;
        if (opts.map) delete opts.map;

        factory.setOpts(opts);
        repository.createPool(opts);

        autoMapping(map, opts.database, mds, function(err, result) {
            if (err) {
                return console.log("自动映射失败：", err);
            }

            if (result !== "none")
                console.log("自动映射结果:", result);
        });
        return factory.Factory;
    },
    createPool: function(opts) { // 准备废弃
        repository.createPool(opts);
    },
    createFactory: function() {
        return new factory.Factory();
    },
    export: function() {
        /**
         * 模型api导出
         */

        var factory = this.createFactory();
        var _models = models.get();

        _.each(_models, function(value, key) {
            Object.defineProperties(value, {
                findOne: {
                    value: function(queryArgs, returnStruct, callback) {
                        if (queryArgs.$trans) return queryArgs.$trans.findOne(key, queryArgs, returnStruct, callback);
                        return factory.findOne(key, queryArgs, returnStruct, callback);
                    }
                },
                find: {
                    value: function(queryArgs, returnStruct, callback) {

                        return factory.find(key, queryArgs, returnStruct, callback)
                    }
                },
                count: {
                    value: function(queryArgs, callback) {
                        return factory.count(key, queryArgs, callback);
                    }
                },
                create: {
                    value: function(data, callback) {
                        return factory.create(key, data, callback);
                    }
                },
                update: {
                    value: function(queryArgs, data, callback) {
                        return factory.update(key, queryArgs, data, callback);
                    }
                },
                del: {
                    value: function(queryArgs, callback) {
                        return factory.del(key, queryArgs, callback);
                    }
                }
            })
        });

        _models.query = factory.query;
        _models.begin = function(callback) { // 循环太大，可以想办法优化
            return new Promise(function(resolve, reject) {
                factory.begin(function(err, trans) {
                    if (err) {
                        return callback ? callback(err) : reject(err);
                    }

                    var ts = {
                        _trans: trans
                    }
                    _.each(_models, function(value, key) {
                        ts[key] = ts[key] || {};
                        Object.defineProperties(ts[key], {
                            findOne: {
                                value: function(queryArgs, returnStruct, callback) {
                                    if (queryArgs.$trans) return queryArgs.$trans.findOne(key, queryArgs, returnStruct, callback);
                                    return trans.findOne(key, queryArgs, returnStruct, callback);
                                }
                            },
                            find: {
                                value: function(queryArgs, returnStruct, callback) {

                                    return trans.find(key, queryArgs, returnStruct, callback)
                                }
                            },
                            count: {
                                value: function(queryArgs, callback) {
                                    return trans.count(key, queryArgs, callback);
                                }
                            },
                            create: {
                                value: function(data, callback) {
                                    return trans.create(key, data, callback);
                                }
                            },
                            update: {
                                value: function(queryArgs, data, callback) {
                                    return trans.update(key, queryArgs, data, callback);
                                }
                            },
                            del: {
                                value: function(queryArgs, callback) {
                                    return trans.del(key, queryArgs, callback);
                                }
                            }
                        })
                    });

                    ts.commit = function(callback) {
                        return trans.commit(callback);
                    };
                    ts.rollback = function(callback) {
                        return trans.rollback(callback);
                    };
                    ts.query = function(sql, args, callback) {
                        return trans.query(sql, args, callback);
                    };
                    callback ? callback(null, ts) : resolve(ts);
                });
            });
        }

        return _models;

    }
};

/**
 * 模型映射，当数据库有之表对应时，且字段不一致时更新表，当数据库无对应表时新增表
 * @return {[type]} [description]
 */
function autoMapping(level, dbname, models, callback) {
    if (level && level !== "none") {
        var _factory = new factory.Factory();
        check(_factory, dbname, models, function(err, result) {
            if (err) {
                return callback(err);
            }

            // console.log("debug: check result", result.chanModel);
            switch (level) {
                case "create":
                    create(_factory, result.newModel, callback);
                    break;
                case "update":
                    update(_factory, result.chanModel, callback);
                    break;
                case "clean":
                    clean(_factory, result.disappearModel, callback);
                    break;
                case "map":
                    map(_factory, result, callback);
                    break;
                default:
                    callback(null, "none");
                    break;
            }
        });

    } else {
        callback(null, "none");
    }

}

/**
    --新增
    >按模型查询所有表
    >不存在的新增表

    -- 更新
    >按模型名查询所有表
    >存在的检测字段不一致则更新

    -- 删除
    >按模型名查询所有表
    >多余表将会删除

    -- 同步
    >根据模型名查询所有表
    >不存在的新增                                                                                                                 
    >存在的更新
    >多余的删除
*/


/**
 * 普通检查 列名，类型，长度，默认值，是否非空
 * @param  {[type]}   dbname   [description]
 * @param  {[type]}   models   [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function check(factory, dbname, models, callback) {
    var newModel = _.extend({}, models);
    var chanModel = {};
    var disappearModel = [];
    var modelNames = _.keys(models);

    x.begin()
        .step(function(ctx) { // 检测由数据库端多余的表
            ctx.idx = 0;
            ctx.size = 50;
            ctx.count = modelNames.length;
            var sql = "select distinct table_name from information_schema.columns where table_schema=? and table_name not in (" + formatSqlForArry(modelNames) + ")";
            factory.query(sql, [dbname].concat(common.batchConvertC2_(modelNames)), function(err, result) {
                if (err) {
                    return ctx.err(err);
                }

                if (result.length > 0) {
                    _.each(result, function(table) {
                        disappearModel.push(table.tableName);
                    });
                    ctx.next();
                } else {
                    ctx.next();
                }
            });

        })
        .step(function(ctx) { // 获取50条数据库表记录
            ctx._modelNames = modelNames.slice(ctx.idx * ctx.size, ctx.idx * ctx.size + ctx.size);

            var sql = "select table_name, column_name, data_type, column_type, column_default, column_comment, column_key from information_schema.columns where table_schema=? and table_name in (" + formatSqlForArry(ctx._modelNames) + ") order by table_name, column_name";

            factory.query(sql, [dbname].concat(common.batchConvertC2_(ctx._modelNames)), function(err, result) {
                if (err) {
                    return callback(err);
                }

                ctx.tables = R2O(result, "columns", ["tableName"]);
                ctx.next();
            });
        })
        .step(function(ctx) { // 对比变化
            _.each(ctx.tables, function(table) {
                table.tableName = common.convert_2C(table.tableName);
                delete newModel[table.tableName];
                chanModel[table.tableName] = _.extend({}, models[table.tableName]);
                _.each(table.columns, function(column) {
                    var propName = common.convert_2C(column.columnName);
                    // 删除 drop
                    if (!chanModel[table.tableName][propName]) {
                        return chanModel[table.tableName][propName] = {
                            status: 2
                        };
                    }


                    // 变化 change
                    // 类型对比
                    if (chanModel[table.tableName][propName].type && mapping.type[column.dataType] != chanModel[table.tableName][propName].type) {
                        // console.log(table.tableName, column.columnName, "类型不一致", mapping.type[column.dataType], chanModel[table.tableName][propName].type);
                        return chanModel[table.tableName][propName].status = 1;
                    }

                    // 大小对比
                    var _tmp = /\(\d+\)/.exec(column.columnType);
                    var size = _tmp && _tmp[0].slice(1, -1);

                    if (size && size != (chanModel[table.tableName][propName].size || mapping.default[column.dataType])) {
                        // console.log(table.tableName, column.columnName, "大小不一致", size, (chanModel[table.tableName][propName].size || mapping.default[column.dataType]));
                        return chanModel[table.tableName][propName].status = 1;
                    }

                    // 默认值对比
                    if (column.columnDefault != chanModel[table.tableName][propName].default) {
                        // console.log(table.tableName, column.columnName, "默认值不一致", column.columnDefault, chanModel[table.tableName][propName].default);
                        return chanModel[table.tableName][propName].status = 1;
                    }

                    // comment对比
                    if (chanModel[table.tableName][propName].comment !== undefined && column.columnComment != chanModel[table.tableName][propName].comment) {
                        // console.log(table.tableName, column.columnName, "comment 不一致", column.columnComment, chanModel[table.tableName][propName].comment)
                        return chanModel[table.tableName][propName].status = 1;
                    }

                    // // index对比
                    // if (column.columnKey != "PRI") {
                    //     if ((chanModel[table.name][propName].uniq?"UNI":null)!=column.columnKey) { // 非空索引未匹配

                    //     }
                    //     return chanModel[table.tableName][propName].status = 1;
                    // }

                    delete chanModel[table.tableName][propName];

                });

                if (_.keys(chanModel[table.tableName]).length === 0) delete chanModel[table.tableName];

            });

            ctx.idx++;
            if (ctx.idx * ctx.size > ctx.count) {
                ctx.end();
            } else {
                ctx.go(-1);
            }

        })
        .exec(function(err, results) {
            if (err) {
                return callback(err);
            }

            callback(null, {
                newModel: newModel,
                chanModel: chanModel,
                disappearModel: disappearModel
            });
        });



}


function create(factory, newModel, callback) {
    if (_.keys(newModel).length === 0) return callback(null, true);
    x.each(newModel, function(model, key) {
        key = common.convertC2_(key);
        var ctx = this;

        // var model = new Model();
        var sql = "create table " + key + "(";
        _.each(model, function(column, name) {
            name = common.convertC2_(name);
            if (name !== "id") {
                let type = (column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar");
                let size = ((column.size || mapping.default[type]) ? ("(" + (column.size || mapping.default[type]) + ")") : "")
                let notNull = (column.notNull ? "not null" : "null");
                let defaultValue = (column.default ? " default '" + column.default+"'" : "");
                let comment = " comment \"" + (column.comment || "") + "\"";
                sql +=  "`" + name + "`" + " " + type + " " + size + " " + notNull + " " + defaultValue + " " + comment + ",";
            } else {
                sql += "`" + name + "` char(36) not null,"
            }

            if (column.uniq) {
                sql += "unique index (`" + name + "`),"
            } else if (column.index) {
                sql += "index (`" + name + "`),"
            }
        });

        sql += "primary key(`id`) comment '');";

        factory.query(sql, [], function(err, result) {
            if (err) {
                return ctx.err(err);
            }

            ctx.result = result;
            ctx.end();
        });
    }, function(err, results) {
        if (err) {
            return callback(err);
        }

        var result = true;
        _.each(results, function(value) {
            if (!value.result) result = false;
        });
        callback(err, result);
    });
}

function update(factory, chanModel, callback) {
    if (_.keys(chanModel).length === 0) return callback(null, true);

    x.each(chanModel, function(value, key) {
        key = common.convertC2_(key);
        var ctx = this;
        var sql = "alter table `" + key + "` ";
        _.each(value, function(column, name) {
            name = common.convertC2_(name);
            if (column.status === 2) {
                sql += "drop column `" + name + "`,";
            } else if (column.status === 1) {
                sql += "change column `" + name + "` ";
                if (name !== "id") {
                    let type = (column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar");
                    let size = ((column.size || mapping.default[type]) ? ("(" + (column.size || mapping.default[type]) + ")") : "")
                    let notNull = (column.notNull ? "not null" : "null");
                    let defaultValue = (column.default ? " default '" + column.default+"'" : "");
                    let comment = " comment \"" + (column.comment || "") + "\"";
                    sql +=  "`" + name + "`" + " " + type + " " + size + " " + notNull + " " + defaultValue + " " + comment + ",";
                } else {
                    sql += "`" + name + "` char(36) not null,"
                }

            } else if (!column.status) {
                sql += "add column ";
                let type = (column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar");
                let size = ((column.size || mapping.default[type]) ? ("(" + (column.size || mapping.default[type]) + ")") : "")
                let notNull = (column.notNull ? "not null" : "null");
                let defaultValue = (column.default ? " default '" + column.default+"'" : "");
                let comment = " comment \"" + (column.comment || "") + "\"";
                sql +=  "`" + name + "`" + " " + type + " " + size + " " + notNull + " " + defaultValue + " " + comment + ",";

                if (column.uniq) {
                    sql += "add unique index (`" + name + "`),"
                }

                if (column.index && !column.uniq) {
                    sql += "add index (`" + name + "`),"
                }
            }
        });

        sql = sql.substr(0, sql.length - 1);
        factory.query(sql, [], function(err, result) {
            if (err) {
                return ctx.err(err);
            }

            ctx.result = result;
            ctx.end();
        });
    }, function(err, results) {
        if (err) {
            return callback(err);
        }

        var result = true;
        _.each(results, function(ctx) {
            if (!ctx.result) result = false;
        });

        callback(null, result);
    });
}

function clean(factory, disappearModel, callback) {
    if (!disappearModel || disappearModel.length === 0) return callback(null, true);
    x.each(disappearModel, function(name) {
        var ctx = this;
        factory.query("drop table `" + name + "`", [], function(err, result) {
            if (err) {
                return ctx.err(err);
            }

            ctx.result = result;
            ctx.end();
        });
    }, function(err, results) {
        if (err) {
            return callback(err);
        }

        var result = true;
        _.each(results, function(ctx) {
            if (!ctx.result) result = false;
        });

        callback(null, result);
    });
}

function map(factory, obj, callback) {
    x.begin()
        .fork(function(ctx) {
            create(factory, obj.newModel, function(err, result) {
                if (err) {
                    return ctx.err(err);
                }

                ctx.result = result;
                ctx.end();
            });
        })
        .fork(function(ctx) {
            update(factory, obj.chanModel, function(err, result) {
                if (err) {
                    return ctx.err(err);
                }

                ctx.result = result;
                ctx.end();
            });
        })
        .fork(function(ctx) {
            clean(factory, obj.disappearModel, function(err, result) {
                if (err) {
                    return ctx.err(err);
                }

                ctx.result = result;
                ctx.end();
            });
        })
        .exec(function(err, results) {
            if (err) {
                return callback(err);
            }

            var result = true;
            _.each(results, function(ctx) {
                result = ctx.result || false;

            });

            callback(null, result);
        });
}

/**
 * 格式化sql，从一个数组对象中。将一个数组转化成“?,?,?,?,?”字符串形式
 * 
 * @param  {[type]} arry [description]
 * @return {[type]}      [description]
 */
function formatSqlForArry(arry) {
    var _arry = [];
    _.each(arry, function(v, i) {
        _arry[i] = 0;
    });

    return _arry.join(",").replace(/[^,]+/g, "?");
}


/**
 * 关系转化对象    将关系型对象数组内重复列压缩成一个对象形式
 * 例：  table = [{id:1,ref_id:1},{id:1,ref_id:2}, {id:2,ref_id:1}]  --> [{id:1, ref:[ref_id:1,ref_id:2]}, {id:2,colName: [ref_id:1]}]
 * @param {[type]} 关系集合   table
 * @param {[type]} 补充对象名 "ref"
 * @param {[type]} 补充对象内属性名集合   ["ref_id"]
 */
function R2O(table, colName, array) {
    var results = [];
    var index = 0;
    _.each(table, function(row) {
        var _row = {};
        var isBool = true;
        _.each(array, function(propName) {
            _row[propName] = row[propName];
            if (!results[index]) {
                isBool = false;
            } else if (results[index][propName] !== row[propName]) {
                index++;
                isBool = false;
            }
            delete row[propName];
        });

        if (isBool) {
            results[index][colName].push(row);
        } else {
            results[index] = _row;
            results[index][colName] = results[index][colName] || [];
            results[index][colName].push(row);
        }

    });
    return results;
}

var mapping = { // 自动映射，默认值
    type: {
        varchar: String,
        char: String,
        text: String,
        int: Number,
        timestamp: Number,
        bigint: Number,
        decimal: Number,
        tinyint: Number,
        date: Date,
        datetime: Date
    },
    default: {
        varchar: 256,
        char: 36,
        bigint: 20,
        int: 11,
        tinyint: 4,
        decimal: "10, 2"
    }
};

var opts = { // 正向映射，待重构
    default: {
        "String": ["varchar", 45],
        "Number": ["int", 11],
        "Date": ["datetime"]
    }
};
