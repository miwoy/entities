# entities
this is a less mysql for node orm

## 安装

<pre>npm install node-entities</pre>

## 简介

这是一个简单的`node orm` 

模仿`mongoose`的链式调用。

并开放原生`query`函数，当此工具无法满足业务需求或原生sql语句更简洁时使用

`entities`是为单位项目开发的简单`node orm`，仅仅适用于`mysql`数据库，

功能不多，没有数据库与数据表的创建，没有mapping配置

`entities`基于约定大于配置思想，以命名约定实现mapping映射

`entities`的功能实现了数据库的增删改查与事物的增删改查功能，增加操作可单条或多条同时增加，修改与删除的都是基于条件参数的

主要扩展的功能是查询，增加`findOne`与`count`函数，实现获取单条与长度。对于复杂查询对`SQL`对象增加`and`与`join`函数实现多表联合查询，并可再where函数中统一配置对外参数查询

`entities`依赖于`mysql`库，增删改的返回值现都为`mysql`的返回结果，并未封装

`entities`的依赖:

* 工具库：[underscore][1]
* 异步流程控制库： [x-flow][2]
* mysql底层库： [node mysql][3]

[1]: https://github.com/jashkenas/underscore  "underscore" 
[2]: https://github.com/miwoy/x-flow        "x-flow" 
[3]: https://github.com/felixge/node-mysql    "node mysql"

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

## API

###### Entitie(master)对象：
    工厂管理者对象
    var master = require('node-entities');  // return fectoryMaster;

###### getModels:
    获取当前所有的模型配置
    var models = master.getModels();  // return models;

###### setModels:
    设置模型，可将模型集合对象配置给entities，也支持


###### init:
    初始化方法，接受两个参数，mysql配置对象，与models对象
    master.init(opts, models);  // return class:Fectory;

###### Fectory:
    工厂提供者类，用来创建工厂对象
    var fectory = new master.Fectory();  // return entity:fectory;

###### find:
    查询，返回SQL对象或null，取决于是否传入callback。results总是返回一个数组，除非err不为null
    // return SQL || null;
    // callback(err, results)
    fectory.find("模型名", [{查询参数}], [{返回结构}], callback);

###### findOne:
    查询一条数据,返回结构省略时返回所有属性，callback中的result为对象类型
    // return null;
    // callback(err, result);
    fectory.findOne("模型名", [{查询参数}], [{返回结构}], callback); 

###### count:
    查询总条数
    // return null;
    // callback(err, count); 
    fectory.count("模型名", [{查询参数}], callback); 




