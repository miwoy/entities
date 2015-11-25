var _ = require('underscore');


/**
 * 模型验证，检测此对象属性是否全部属于模型，并与模型中属性类型吻合
 * @param  {Object} model 验证模型
 * @param  {Object} obj   待验证的对象
 * @return {Boolean} 验证成功返回true, 失败返回false
 */
function checkObjForModel(model, obj) {
    _.each(obj, function(v, k) {
        if (!(/\$/g.test(k) || k in model)) {

            throw new Error("模型检测失败：", obj);

        } else {
            // 检测值类型是否与模型中定的类型一致
            // if (!(_.isObject(v) && v.value.constructor === model[k].type)) {
            //     rlt = false;
            // }
        }
    });
}

/**
 * 命名转换，由小驼峰命名转换至匈牙利命名法
 * @param  {String} name 名称
 * @return {String}              转化后的值
 */
function convertC2_(str) {
    return str.replace(/[A-Z]/g, function(v) {
        return "_" + v.toLowerCase();
    });
}

/**
 * 命名转换，由匈牙利命名法转为小驼峰
 * @param  {String} str 名称
 * @return {String}              转化后的值
 */
function convert_2C(str) {
    return str.replace(/_[a-z]{0,1}/g, function(v) {
        return v.charAt(1).toUpperCase();
    });
}


module.exports = {
    checkObjForModel: checkObjForModel,
    convertC2_: convertC2_,
    convert_2C: convert_2C
}
