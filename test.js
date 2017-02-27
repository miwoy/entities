var factoryMaster = require('./index');

var models = {
    test: function Test() {
        this.id = { // ID强制使用36位uuid类型，type固定为String类型
            type: String
        };
        this.name = { // 
            type: String,
            uniq: true,  // 唯一索引
            notNull: true, // 非空字段
            size: 100,  // 字段长度，decimal时不需要设置，使用默认10,2
            mapping: {  // 映射对象
                type: "char"
            },
            comment: "测试名称"  // 字段描述
        };
        this.description = {
            type: String,
            size: 512,
            default: "详情默认值",  // 默认值
            comment: "详情描述"
        };
        this.float = { // decimal类型不用设置size,默认使用10，2
            type: Number,
            index: 1,  // 普通索引
            mapping: {
                type: "decimal" // 映射类型
            }
        }
    }
};
var Factory = factoryMaster.init({
    host: 'your mysql host',
    port: 8292,
    user: 'your mysql user',
    password: 'your mysql pwd',
    database: 'your mysql db',
    connectionLimit: 20,
    supportBigNumbers: true
}, models);



// 查询
var getTest = function(query) {

    //     factory.query("select * from test", [])
    //     .exec(function(err, result) {
    //         console.log(err, result);
    //     });
    var factory = new Factory();
    factory.find("test", {
        id: {
            value: 57,
            type: "="
        }
    }, {
        id: "testId"
    }, function(err, result) {
        console.log(result);
    });

};

getTest();

var createTest = function(data) {
    factory.create("test", data).exec(function(err, result) {
        callback(err, result);
    });
};

var setTest = function(query, data, callback) {
    factory.update("test", query, data, function(err, result) {
        callback(err, result);
    });
};

var delTest = function(query, callback) {
    factory.del("test", query, function(err, result) {
        callback(err, result);
    });
};

var beginTest = function() {
    var query = {
        id: {
            value: "",
            type: "="
        }
    };
    factory.begin(function(err, trans) {
        if (err) return callback(err);
    }).create("test", {
        name: "begin",
        deScription: "test create begin"
    }, function(err, result) {
        query.id.value = result.insertId;
        return query;
    }).update("test", query, {
        deScription: "test update begin"
    }, function(err, result) {}).commit(function(err, result) {
        if (err) return callback(err);
        console.log(result);
    });

};
