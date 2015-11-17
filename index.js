var fectory = require("./fectory");
var _ = require('underscore');
var mysql = require('mysql');

module.exports = {
    models: fectory.models,
    addModels: function(models) {
    	fectory.models = _.extend(fectory.models, models);
    },
    addModel: function(modelName, model) {
    	if (modelName in fectory.models) {
    		throw new Error("模型:" + modelName + "已存在");
    	}

    	fectory.models[modelName] = model;
    },
    repositoryConfig: function(config) {
    	fectory.repository.pool = mysql.createPool(config);
    },
    Fectory:fectory.Fectory,
    createFactory: function() {
        return new fectory.Fectory();
    }
};
