var fectoryMaster = require('./index');

var models = {
    test: function Test() {
        this.name = {
            type: String
        };
        this.id = {
            type: Number
        };
        this.deScription = {
            type: String
        };
    }
};
var Fectory = fectoryMaster.init({
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

    //     fectory.query("select * from test", [])
    //     .exec(function(err, result) {
    //         console.log(err, result);
    //     });
    var fectory = new Fectory();
    fectory.find("test", {
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
    fectory.create("test", data).exec(function(err, result) {
        callback(err, result);
    });
};

var setTest = function(query, data, callback) {
    fectory.update("test", query, data, function(err, result) {
        callback(err, result);
    });
};

var delTest = function(query, callback) {
    fectory.del("test", query, function(err, result) {
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
    fectory.begin(function(err, trans) {
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
