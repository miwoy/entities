var find = require('./find');
var create = require('./create');
var update = require('./update');
var del = require('./del');
var query = require('./query');



/**
 * 开启一个事物
 * @param  {Function} callback 返回错误或一个仓库事物对象
 */
var begin = function(repository, callback) {

    var self = this;
    // 事物方法
    var queue = [];

    var ts = {
        trans: {},
        count: function(modelName, queryArgs, callback) {
            return find.count(modelName,queryArgs,this.trans,callback);
            //return execQueue(queue, count, [modelName, queryArgs], this, callback);
        },
        findOne: function(modelName, queryArgs, returnStruct, callback) {
            return find.one(modelName, queryArgs, returnStruct, this.trans, callback);
            //return execQueue(queue, findOne, [modelName, queryArgs, returnStruct], this, callback);
        },
        find: function(modelName, queryArgs, returnStruct, callback) {
            
            return find(modelName, queryArgs, returnStruct, this.trans, callback);
            
            //return execQueue(queue, find, [modelName, queryArgs, returnStruct], this, callback);
        },
        create: function(modelName, data, callback) {
            
            return create(modelName, data, this.trans, callback);
            
            //return execQueue(queue, create, [modelName, data], this, callback);
        },
        update: function(modelName, queryArgs, data, callback) {
            
            return update(modelName, queryArgs, data, this.trans, callback);
            
            // return execQueue(queue, update, [modelName, queryArgs, data], this, callback);
        },
        del: function(modelName, queryArgs, callback) {
            
            return del(modelName, queryArgs, this.trans, callback);
         
            // return execQueue(queue, del, [modelName, queryArgs], this, callback);
        },
        commit: function(callback) {
            return commit(this.trans, callback);
            // execQueue(queue, commit, [], this, callback);
        },
        rollback: function(callback) {
            return rollback(this.trans, callback);
            //return execQueue(queue, this.trans.rollback, [], this, callback);
        },
        query: function(sql, args, callback) {
            
            return query(sql, args, this.trans, callback);
            
            //return execQueue(queue, query, [sql, args], this, callback);
        }
    };

    beginTrans(repository, function(err, result) {
        if (err) {
            if (callback)
                return callback(err);
            else
                throw err;
        }

        ts.trans = result;
        if (callback) callback(err, ts);
    });

    // return execQueue(queue, beginTrans, [repository], ts, function(err, result) {
    //     if (err) {
    //         if (callback)
    //             return callback(err);
    //         else
    //             throw err;
    //     }

    //     ts.trans = result;
    //     if (callback) callback(err, ts);
    // });
};

/**
 * 事物提交方法
 * @param  {Object}   ts       当前事物对象
 * @param  {Function} callback 回调函数，返回错误
 */
var commit = function(trans, callback) {
    trans.commit(function(err, code, result) {
        if (callback) callback(err, result);
    });
};

/**
 * 事物回滚方法
 * @param  {Object}   ts       事物对象
 * @param  {Function} callback 回调函数，返回错误
 */
var rollback = function(trans, callback) {
    trans.rollback(function(err, code, result) {
        if (callback) callback(err, result);
    });
};

/**
 * 开始一个事物的方法
 * @param  {Object}   ts       事物对象
 * @param  {Function} callback 返回错误与仓储事物对象
 */
var beginTrans = function(repository, callback) {
    repository.begin(function(err, code, result) {
        if (callback) callback(err, result);
    });
};



module.exports = begin;




/**
 * 执行队列，暂为辅助事物实现链式调用功能而封装的方法
 * @param  {Array} trans 工厂事物对象
 * @param  {Function} func  事物使用的方法
 * @param  {Array} args  事物使用方法的参数列表
 * @return {Object}       返回工厂事物对象
 */
function execQueue(queue, func, args, ts, callback) {

    queue.push(function(next) {
        args.push(ts.trans, function(err, result) {
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
        (function exec() {

            queue[0](function() {
                queue.shift();
                if (queue.length > 0) {
                    exec();
                }
            });

        }());
    }

    return ts;
}