var _ = require('underscore');
var repository = require('./repository');
var find = require('./lib/find');
var create = require('./lib/create');
var update = require('./lib/update');
var del = require('./lib/del');
var query = require('./lib/query');
var beginTransaction = require('./lib/transaction');



function Factory() {
}

Factory.prototype.findOne = function(modelName, queryArgs, returnStruct, callback) {
    return find.One(modelName, queryArgs, returnStruct, repository, callback);
};

Factory.prototype.find = function(modelName, queryArgs, returnStruct, callback) {
    return find(modelName, queryArgs, returnStruct, repository, callback);
};

Factory.prototype.count = function(modelName, queryArgs, callback) {
    return find.count(modelName, queryArgs, repository, callback);
};

Factory.prototype.create = function(modelName, data, callback) {
    return create(modelName, data, repository, callback);
};

Factory.prototype.update = function(modelName, queryArgs, data, callback) {
    return update(modelName, queryArgs, data, repository, callback);
};

Factory.prototype.del = function(modelName, queryArgs, callback) {
    return del(modelName, queryArgs, repository, callback);
};

Factory.prototype.query = function(sql, args, callback) {
    return query(sql, args, repository, callback);
};

Factory.prototype.begin = function(callback) {
    return beginTransaction(repository, callback);
};


module.exports = {
    Factory: Factory
};







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

/**
 * 关于where函数
 * where函数执行顺序仅次于exec
 * where函数的条件针对于多有参与查询的表，并且不需要用到$指令获取表实体，则根据返回值列名（或别名）直接过滤
 */
