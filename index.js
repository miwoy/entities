var fectory = require("./new_fectory");
var models = require('./lib/models');
var repository = require('./repository');
module.exports = {
    Fectory: fectory.Fectory,
    getModels: models.get,
    setModels: models.set,
    init: function(opts, mds) {
        if (mds)
            models.set(mds);
        repository.createPool(opts);
        return fectory.Fectory;
    },
    createPool: function(ops) {
        repository.createPool(opts);
    },
    createFactory: function() {
        return new fectory.Fectory();
    }
};
