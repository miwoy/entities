var _ = require('underscore');
// 用来全局配置models
var models = {};
module.exports = {
    get: function() {
        return models;
    },
    set: function(modelName, model) {
        if (arguments.length === 2) {
            models[modelName] = model;
        } else if (arguments.length === 1) {
            if (_.isObject(arguments[0])) {
                _.extend(models, arguments[0]);
            } else {
                throw new Error("参数类型错误，models必须是一个对象");
            }

        }
    },
};
