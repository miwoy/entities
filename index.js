const factory = require("./factory");
const models = require('./lib/models');
const common = require('./lib/common');
const repository = require('./repository');
const autoMapping = require('./mapping');

const _ = require('underscore');
const x = require('x-flow');

module.exports = {
    getModel: models.get,
    setModel: models.set,
    init: function(opts, mds) {
        if (!mds) throw new Error("缺少参数models");
        if (!opts) throw new Error("缺少参数opts");

        if (opts.globals) { // 全局参数配置
            let baseModel = opts.globals.baseModel || {};
            let extend = opts.globals.extend; // 模型扩展

            if (extend && _.isObject(extend)) { // 模型扩展
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

            _.each(mds, function(model, key) { // 模型与模型扩展合并
                mds[key] = _.extend({}, opts.globals.baseModel, model);
            });

        }

        models.set(mds); // 设置模型缓存

        factory.setOpts(opts); // 设置opts缓存

        repository.createPool(opts); // 初始化数据库仓储

        let _factory = new factory.Factory();

        // 自动映射
        autoMapping(_factory, opts.map, opts.database, mds, function(err, result) {
            if (err) {
                return console.log("自动映射失败：", err);
            }

            if (result !== "none")
                console.log("自动映射结果:", result);
        });

        return wrapModel(_factory);
    }
};

/**
 * 包装模型，使模型拥有仓储方法
 * @param  {[type]} factory [description]
 * @return {[type]}         [description]
 */
let wrapModel = function(factory) {
    /**
     * 模型api导出
     */
    let _models = models.get();

    _.each(_models, function(value, key) {
        Object.defineProperties(value, {
            findOne: {
                value: function(queryArgs, returnStruct, callback) {
                    if (queryArgs.$trans) return queryArgs.$trans.findOne(key, queryArgs, returnStruct, callback);
                    return factory.findOne(key, queryArgs, returnStruct, callback);
                },
                configurable: true
            },
            find: {
                value: function(queryArgs, returnStruct, callback) {

                    return factory.find(key, queryArgs, returnStruct, callback)
                },
                configurable: true
            },
            count: {
                value: function(queryArgs, callback) {
                    return factory.count(key, queryArgs, callback);
                },
                configurable: true
            },
            create: {
                value: function(data, callback) {
                    return factory.create(key, data, callback);
                },
                configurable: true
            },
            update: {
                value: function(queryArgs, data, callback) {
                    return factory.update(key, queryArgs, data, callback);
                },
                configurable: true
            },
            del: {
                value: function(queryArgs, callback) {
                    return factory.del(key, queryArgs, callback);
                },
                configurable: true
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

                let ts = {
                    _trans: trans
                }
                _.each(_models, function(value, key) {
                    ts[key] = ts[key] || {};
                    Object.defineProperties(ts[key], {
                        findOne: {
                            value: function(queryArgs, returnStruct, callback) {
                                if (queryArgs.$trans) return queryArgs.$trans.findOne(key, queryArgs, returnStruct, callback);
                                return trans.findOne(key, queryArgs, returnStruct, callback);
                            },
                            configurable: true
                        },
                        find: {
                            value: function(queryArgs, returnStruct, callback) {

                                return trans.find(key, queryArgs, returnStruct, callback)
                            },
                            configurable: true
                        },
                        count: {
                            value: function(queryArgs, callback) {
                                return trans.count(key, queryArgs, callback);
                            },
                            configurable: true
                        },
                        create: {
                            value: function(data, callback) {
                                return trans.create(key, data, callback);
                            },
                            configurable: true
                        },
                        update: {
                            value: function(queryArgs, data, callback) {
                                return trans.update(key, queryArgs, data, callback);
                            },
                            configurable: true
                        },
                        del: {
                            value: function(queryArgs, callback) {
                                return trans.del(key, queryArgs, callback);
                            },
                            configurable: true
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
