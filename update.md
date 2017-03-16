## 2015-11-30

1. 为了方便查询，对于用到频次很多的相等查询操作进行更简洁的特殊处理。当查询对象中某列与值为相等查询时，可直接在key后面接value值，而以往我们是希望他构建一个这样的对象<br/>
    `{
        value:"",
        type:"="
    }`

2. 在and函数中增加默认返回列，当返回结构参数为空时，默认返回模型下所有字段。

3. 为避免命名冲突，所有未配置别名的字段名增加模型名前缀为别名

4. 改变SQL对象的where函数，使它成为更有价值的函数，当出现多表查询时where函数的查询参数总是一个对象，并且这个对象的key是期望本次查询返回的列名或别名。因为它会将之前的语句当做一个完整表进行查询。特别注意的是，当使用and函数或在and与join返回结构参数内未配置别名的列，将默认加模型名为前缀当做它的别名。

5. 在common.js中新增两个命名转换函数<br/>
`convertC2P() // camel to pascal ,convertP2C() // pascal to camel`

## 2015-12-1 v1.3.2

1. 修复一个bug，在gFind.js中，使用$andCount指令时，错误的使用‘+=’运算符，现已改为‘=’

2. 修复一个bug，在gFind.js中，对于$limit值检测不严格

3. 修复一个bug，在tool.js中，formatSqlForArry函数会更改传进来的数组值，现已修正，使用局部变量的方式

## 2015-12-1 v1.3.3

1. 修复一个bug， 在factory.js中，findOne与count未定义

2. 修复一个bug， 在gQuery.js中，对相等查询时$指令未正确处理

## 2015-12-02 v1.3.4

1. 更改一处功能，在gQuery.js中，查询参数为数组时，抛弃数组值为非对象情况的处理，现会抛出异常

2. 增加事务方法的返回值，使事务可用SQL对象进项链式调用

## 2015-12-02 v1.3.5

1. 修正SQL.where函数，使where参数可以使用指令，where条件的属性名为之前表返回的属性名


## 2016-03-24 v1.4.14

1.检测onArgs如果不存在则默认为on语句添加true条件，防止错误
2.对onArgs对象实行条件拆分，关联条件放在on语句后面，特定查询条件放到where后面

## 2016-03-24 v1.4.15
1.增加$where指令在onArgs参数内替换1.4.14版本中onArgs参数拆分功能

## 2016-04-28 v1.4.19
1.增加$or指令，用于配置or关系的where语句。增加$distinct指令，用于去除重复查询

## 2016-04-29 v1.4.20
1.增加对$or指令的内部排序功能，而or函数仅在外部做排序

## 2017-02-27 v1.4.23
1.增加index与uniq模型配置，uniq表示非空索引，index表示普通索引，uniq如果与index同时存在以uniq优先
    仅增加新增索引操作，并不支持删除与修改，如需修改则手动操作数据库
2.增加comment字段描述，仅限增加和更新时使用
3.修改映射逻辑，增加decimal默认值配置
4.修改测试用力中的模型配置

## 2017-02-28 v1.5.0
1.增加模型导出方法
factoryMaster.init(opts);
let db = factoryMaster.export();
db.test.find();

## 2017-03-08 v2.0.0
1.新增globals全局配置项
2.新增globals.baseModel配置，配置全局模型公有字段
3.新增globals.extend配置，配置扩展属性
4.新增globals.beforeHooks, 配置操作执行前的钩子
````
globals: { // 全局配置
            baseModel: { // 全局模型字段
                id: { // 配置全局id属性
                    type: String,
                    size: 36,
                    mapping: {
                        type: "char"
                    }
                }
            },
            extend: { // 模型扩展功能
               createTime: true, // 扩展createTime属性，并默认每次新增时配置当前时间
               updateTime: true, // 扩展updateTime属性，并在每次更新时配置当前时间
               logicDel: true  // 扩展逻辑删除功能，模型增加deleteTime，并在每次删除时设置此字段的删除时间，并在查询更新删除时默认增加此参数为空限制
            },
            beforeHooks: { // 操作执行前钩子
                create: function(data) { // 新增操作，data为新增对象
                    console.log("create hook", data);
                },
                update: function(queryData, data) { // 更新操作，queryData为条件，data为更新内容
                    console.log("update hook", queryData, data);
                }
                // TODO find and del。find操作比较特殊，在任何有查询操作时候都会执行，如count,findOne
            }
        }
````
5.增加sql语句表列转义
6.修改bug，size不能为空
7.重构model部分，不支持模型为class,只支持object

## 2017-03-08 v2.0.1
1.修复模型无法定义额外属性bug

## 2017-03-09 v2.1.1
1.重构index，去掉工厂管理者，只保留init方法用来总体导出模型及仓储方法

## 2017-03-09 v2.1.2
1.修改增删改的返回值结构，增加返回增加内容，修改和删除返回true或false

## 2017-03-13 v2.1.5
1.修改排序，排序键的值以1 or -1的形式标识正序与反序

## 2017-03-14 v2.1.6
1.修改关联查询bug,多次使用``嵌套模型
2.修改模型检测规则，不存在的键不会抛出异常，而是从对象中删除

## 2017-03-16 v2.1.7
1.修改bug，join，多次使用``嵌套模型名

## 待修改内容

$where与$ob参数未检查