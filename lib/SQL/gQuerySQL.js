var _ = require('underscore');
var tool = require('./tool');


/**
 * 生成查询参数（where）部分sql语句，
 * @param  {[type]} query [description]
 * @return {[type]}       [description]
 */
function gQuerySQL(where) {
    var sql = "";
    var args = [];
    var _keys = [];

    _.each(where, function(query, as) {


        // 遍历查询参数对象
        _.each(query, function(v, key) {

            key = as + "." + key;
            // 如果参数值为数组时
            if (_.isArray(v)) {
                _.each(v, function(v, i) {
                    if (_.isObject(v)) {
                        // value类型为数组时
                        if (_.isArray(v.value)) {
                            if (v.type === "in") { // type为=时
                                _keys.push(key + " in (" + tool.formatSqlForArry(v.value) + ")");

                                args = args.concat(v.value);
                            } else if (v.type === "=" || v.type === "!=") { // type为!=时
                                var _type = v.type;
                                _.each(v, function(v, i) {
                                    _keys.push(key + _type + "?");

                                });
                                args = args.concat(v.value);
                            } else { // 其他
                                throw new Error("参数query类型错误，type必须为'=' or '!=':", query);
                            }

                        } else if (v.value !== undefined && v.value !== null) { //  否则为string或number时
                            tool.checkType(v.type);
                            if (v.type === "like")
                                v.value = "%" + v.value + "%";
                            _keys.push(key + v.type + "?");
                            args.push(v.value);
                        }
                    } else { // 当时数字或字符串时
                        _keys.push(key + " in (" + tool.formatSqlForArry(v) + ")");

                        args = args.concat(v);
                    }


                });
            } else if (_.isObject(v)) { // 否则为对象时


                // value类型为数组时
                if (_.isArray(v.value)) {
                    if (v.type === "in") { // type为=时
                        _keys.push(key + " in (" + tool.formatSqlForArry(v.value) + ")");

                        args = args.concat(v.value);
                    } else if (v.type === "=" || v.type === "!=") { // type为!=时
                        var _type = v.type;
                        _.each(v, function(v, i) {
                            _keys.push(key + _type + "?");

                        });
                        args = args.concat(v.value);
                    } else { // 其他
                        throw new Error("参数query类型错误，type必须为'=' or '!=' or 'in':", query);
                    }

                } else if (v.value !== undefined && v.value !== null) { //  否则为string或number时
                    tool.checkType(v.type);
                    if (v.type === "like")
                        v.value = "%" + v.value + "%";
                    if (_.isString(v.value) && /^\$\d+\.\w+$/.test(v.value.trim()))
                        _keys.push(key + " " + v.type + " " + v.value);
                    else {
                        _keys.push(key + " " + v.type + " " + "?");
                        args.push(v.value);
                    }

                }

            } else { // 其他
                if (_.isString(v) && /^\$\d+\.\w+$/.test(v.trim())) {
                    _keys.push(key + "=" + v);
                } else {
                    _keys.push(key + "=" + "?");
                    args.push(v);
                }

                // throw new Error("参数query类型错误，参数值必须是数组或对象类型:", query);
            }



        });
    });
    if (_keys.length > 0)
        sql += _keys.join(" and ");



    return {
        sql: sql,
        args: args
    };

}



module.exports = gQuerySQL;
