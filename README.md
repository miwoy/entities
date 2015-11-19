# entities
this is a less mysql for node orm

## 安装

<pre>npm install node-entities</pre>

## 简介

这是一个简单的node orm 仅仅适用于mysql数据库

模仿mongoose的链式调用。

并开放原生query函数，当此工具无法满足业务需求或原生sql语句更简洁时使用

## 使用方法

```` javascript
var fectoryMaster = require('node-entities');

// 定义模型
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

// 初始化，并返回工厂构造器 
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
````


