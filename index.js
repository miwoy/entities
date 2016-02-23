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
        if (mds)
            models.set(mds);
        var map = opts.map;
        if (opts.map) delete opts.map;

        if (opts.debug) {
            factory.setDebug(opts.debug);
            delete opts.debug;
        }
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

            var sql = "select table_name, column_name, data_type, column_type, column_default from information_schema.columns where table_schema=? and table_name in (" + formatSqlForArry(ctx._modelNames) + ") order by table_name, column_name";

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
                chanModel[table.tableName] = _.extend({}, new models[table.tableName]());
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
                    if (mapping.type[column.dataType] != chanModel[table.tableName][propName].type) {
                        // console.log(table.tableName, column.columnName, "类型不一致");
                        return chanModel[table.tableName][propName].status = 1;
                    }

                    // 大小对比
                    var _tmp = /\(\d+\)/.exec(column.columnType);
                    var size = _tmp && _tmp[0].slice(1, -1);

                    if (size != (chanModel[table.tableName][propName].size || mapping.default[column.dataType])) {
                        // console.log(table.tableName, column.columnName, "大小不一致", size, (chanModel[table.tableName][propName].size || mapping.default[column.dataType]));
                        return chanModel[table.tableName][propName].status = 1;
                    }

                    // 默认值对比
                    if (column.columnDefault != chanModel[table.tableName][propName].default) {
                        // console.log(table.tableName, column.columnName, "默认值不一致", column.columnDefault, chanModel[table.tableName][propName].default);
                        return chanModel[table.tableName][propName].status = 1;
                    }

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
    x.each(newModel, function(Model, key) {
        key = common.convertC2_(key);
        var ctx = this;
        var model = new Model();
        var sql = "create table " + key + "(";
        _.each(model, function(column, name) {
            name = common.convertC2_(name);
            sql += "`" + name + "` " + (name === "id" ? "char(36) not null," : ((column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar") + ((column.size || opts.default[column.type.name][1]) ? ("(" + (column.size || opts.default[column.type.name][1]) + ")") : "") + " " + (column.notNull ? "not null" : "null") + (column.default ? " default '" + column.default+"'" : "") + ","));
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
                sql += "change column `" + name + "` `" + name + "` " + (name === "id" ? "char(36) not null," : ((column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar") + ((column.size || opts.default[column.type.name][1]) ? ("(" + (column.size || opts.default[column.type.name][1]) + ")") : "") + " " + (column.notNull ? "not null" : "null") + (column.default ? " default '" + column.default+"'" : "") + ","));
            } else if (!column.status) {
                sql += "add column `" + name + "` " + ((column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar") + ((column.size || opts.default[column.type.name][1]) ? ("(" + (column.size || opts.default[column.type.name][1]) + ")") : "") + " " + (column.notNull ? "not null" : "null") + (column.default ? " default '" + column.default+"'" : "") + ",");
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

var mapping = {
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
        varchar: 45,
        char: 36,
        bigint: 20,
        int: 11,
        tinyint: 4
    }
};

var opts = {
    default: {
        "String": ["varchar", 45],
        "Number": ["int"],
        "Date": ["datetime"]
    }
};
