/**
 * 数据库自动映射
 * 以模型为基准
 * 登录用户必须拥有访问information_schema数据库的全新啊
 */
const common = require('./lib/common');
const _ = require('underscore');
const x = require('x-flow');

/**
 * 反向映射表
 * @type {Object}
 */
const mapping = { // 自动映射，默认值
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

/**
 * 正向映射表
 * @type {Object}
 */
const opts = {
    default: {
        "String": ["varchar"],
        "Number": ["int"],
        "Date": ["datetime"]
    }
};


/**
 * 模型映射，当数据库有之表对应时，且字段不一致时更新表，当数据库无对应表时新增表
 * [opts.map=none] 配置（映射等级）
 * create 增加表等级，当opts.map=create的时候，会以模型为基准自动增加表结构
 * update 更新表等级，当opts.map=update的时候，与以模型为基准自动更新表结构
   注意的是：只有新增列才可以建立索引操作
 * clean 清理表等级，当opts.map=clean的时候，会以模型为基准自动清理数据库中无效的表
 * map 同步表操作，当opts.map=map的时候，会以create、update、clean的顺序依次执行所有操作
 */

module.exports = function(db, level, dbname, models, callback) {
    if (level && level !== "none") {
        check(db, dbname, models, function(err, result) {
            if (err) {
                return callback(err);
            }

            // console.log("debug: check result", result.chanModel);
            switch (level) {
                case "create":
                    create(db, result.newModel, callback);
                    break;
                case "update":
                    update(db, result.chanModel, callback);
                    break;
                case "clean":
                    clean(db, result.disappearModel, callback);
                    break;
                case "map":
                    map(db, result, callback);
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
    let newModel = _.extend({}, models);
    let chanModel = {};
    let disappearModel = [];
    let modelNames = _.keys(models);
    return new Promise(function(resolve, reject) {
        x.begin()
            .step(function(ctx) { // 检测由数据库端多余的表
                ctx.idx = 0; // 分页对比
                ctx.size = 50; // 每次限额五十
                ctx.count = modelNames.length;
                let sql = "select distinct table_name from information_schema.columns where table_schema=? and table_name not in (" + formatSqlForArry(modelNames) + ")";
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

                let sql = "select table_name, column_name, data_type, column_type, column_default, column_comment, column_key from information_schema.columns where table_schema=? and table_name in (" + formatSqlForArry(ctx._modelNames) + ") order by table_name, column_name";

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
                        let propName = common.convert_2C(column.columnName); // 方向反了，好尴尬。等改。现在模型强制使用小驼峰，不然会一直检测不匹配
                        // 删除 drop
                        if (!chanModel[table.tableName][propName]) {
                            // console.log("不存在的列",chanModel[table.tableName], chanModel[table.tableName][propName],table.tableName, propName)
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
                        let _tmp = /\(\d+\)/.exec(column.columnType);
                        let size = _tmp && _tmp[0].slice(1, -1);

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
                    return callback ? callback(err) : reject(err);
                }

                let r = {
                    newModel: newModel,
                    chanModel: chanModel,
                    disappearModel: disappearModel
                };

                callback ? callback(null, r) : resolve(r);
            });
    });
}


/**
 * 新增操作
 * @param  {[type]}   factory  [description]
 * @param  {[type]}   newModel [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function create(factory, newModel, callback) {
    return new Promise(function(resolve, reject) {
        if (_.keys(newModel).length === 0) return callback ? callback(null, true) : resolve(true);
        x.each(newModel, function(model, key) {
            key = common.convertC2_(key);
            let ctx = this;
            let sql = "create table " + key + "(";
            _.each(model, function(column, name) {
                name = common.convertC2_(name);
                if (name !== "id") { // 普通列
                    if (_.isFunction(column)) column = { type: column };
                    let type = (column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar");
                    let size = ((column.size || mapping.default[type]) ? ("(" + (column.size || mapping.default[type]) + ")") : "")
                    let notNull = (column.notNull ? "not null" : "null");
                    let defaultValue = (column.default !== undefined ? " default '" + column.default+"'" : "");
                    let comment = " comment \"" + (column.comment || "") + "\"";
                    sql += "`" + name + "`" + " " + type + " " + size + " " + notNull + " " + defaultValue + " " + comment + ",";
                } else { // 主键列，这里强制使用id为主键列，并强制类型为char(36)位
                    sql += "`" + name + "` char(36) not null,"
                }

                if (column.uniq) { // unique索引
                    sql += "unique index (`" + name + "`),"
                } else if (column.index) { // 普通索引
                    sql += "index (`" + name + "`),"
                }
            });

            sql += "primary key(`id`) comment '');"; // 主键索引

            factory.query(sql, [], function(err, result) {
                if (err) {
                    return ctx.err(err);
                }

                ctx.result = result;
                ctx.end();
            });
        }, function(err, results) {
            if (err) {
                return callback ? callback(err) : reject(err);
            }

            let result = true;
            _.each(results, function(value) {
                if (!value.result) result = false;
            });

            callback ? callback(err, result) : resolve(result);
        });
    });
}

/**
 * 更新操作
 * @param  {[type]}   factory   [description]
 * @param  {[type]}   chanModel [description]
 * @param  {Function} callback  [description]
 * @return {[type]}             [description]
 */
function update(factory, chanModel, callback) {
    return new Promise(function(resolve, reject) {
        if (_.keys(chanModel).length === 0) return callback ? callback(null, true) : resolve(true);
        x.each(chanModel, function(value, key) {
            key = common.convertC2_(key);
            let ctx = this;
            let sql = "alter table `" + key + "` ";
            _.each(value, function(column, name) {
                name = common.convertC2_(name);
                if (column.status === 2) { // 清理列
                    sql += "drop column `" + name + "`,";
                } else if (column.status === 1) { // 修改列
                    sql += "change column `" + name + "` ";
                    if (name !== "id") {
                        if (_.isFunction(column)) column = { type: column };
                        let type = (column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar");
                        let size = ((column.size || mapping.default[type]) ? ("(" + (column.size || mapping.default[type]) + ")") : "")
                        let notNull = (column.notNull ? "not null" : "null");
                        let defaultValue = (column.default !== undefined ? " default '" + column.default+"'" : "");
                        let comment = " comment \"" + (column.comment || "") + "\"";
                        sql += "`" + name + "`" + " " + type + " " + size + " " + notNull + " " + defaultValue + " " + comment + ",";
                    } else {
                        sql += "`" + name + "` char(36) not null,"
                    }

                } else if (!column.status) { // 新增列
                    sql += "add column ";
                    if (_.isFunction(column)) column = { type: column };
                    let type = (column.mapping && column.mapping.type || opts.default[column.type.name][0] || "varchar");
                    let size = ((column.size || mapping.default[type]) ? ("(" + (column.size || mapping.default[type]) + ")") : "")
                    let notNull = (column.notNull ? "not null" : "null");
                    let defaultValue = (column.default !== undefined ? " default '" + column.default+"'" : "");
                    let comment = " comment \"" + (column.comment || "") + "\"";
                    sql += "`" + name + "`" + " " + type + " " + size + " " + notNull + " " + defaultValue + " " + comment + ",";

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
                return callback ? callback(err) : reject(err);
            }

            let result = true;
            _.each(results, function(ctx) {
                if (!ctx.result) result = false;
            });

            callback ? callback(null, result) : resolve(result);
        });
    });
}

/**
 * 清理操作
 * @param  {[type]}   factory        [description]
 * @param  {[type]}   disappearModel [description]
 * @param  {Function} callback       [description]
 * @return {[type]}                  [description]
 */
function clean(factory, disappearModel, callback) {

    return new Promise(function(resolve, reject) {
        if (!disappearModel || disappearModel.length === 0) return callback ? callback(null, true) : resolve(true);
        x.each(disappearModel, function(name) {
            let ctx = this;
            factory.query("drop table `" + name + "`", [], function(err, result) {
                if (err) {
                    return ctx.err(err);
                }

                ctx.result = result;
                ctx.end();
            });
        }, function(err, results) {
            if (err) {
                return callback ? callback(err) : reject(err);
            }

            let result = true;
            _.each(results, function(ctx) {
                if (!ctx.result) result = false;
            });

            callback ? callback(null, result) : resolve(result);
        });
    });
}

/**
 * 同步操作
 * @param  {[type]}   factory  [description]
 * @param  {[type]}   obj      [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function map(factory, obj, callback) {
    return new Promise(function(resolve, reject) {
        x.begin()
            .fork(function(ctx) { // 新增
                create(factory, obj.newModel, function(err, result) {
                    if (err) {
                        return ctx.err(err);
                    }

                    ctx.result = result;
                    ctx.end();
                });
            })
            .fork(function(ctx) { // 更新
                update(factory, obj.chanModel, function(err, result) {
                    if (err) {
                        return ctx.err(err);
                    }

                    ctx.result = result;
                    ctx.end();
                });
            })
            .fork(function(ctx) { // 清理
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
                    return callback ? callback(err) : reject(err);
                }

                let result = true;
                _.each(results, function(ctx) {
                    result = ctx.result || false;

                });

                callback ? callback(null, result) : resolve(result);
            });
    });
}

/**
 * 格式化sql，从一个数组对象中。将一个数组转化成“?,?,?,?,?”字符串形式
 * 
 * @param  {[type]} arry [description]
 * @return {[type]}      [description]
 */
function formatSqlForArry(arry) {
    let _arry = [];
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
    let results = [];
    let index = 0;
    _.each(table, function(row) {
        let _row = {};
        let isBool = true;
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
