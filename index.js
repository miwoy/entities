var fectory = require("./fectory");
var models = require('./lib/models');
var repository = require('./repository');
module.exports = {
    Fectory: fectory.Fectory,
    getModel: models.get,
    setModel: models.set,
    init: function(opts, mds) {
        if (mds)
            models.set(mds);
        repository.createPool(opts);
        return fectory.Fectory;
    },
    createPool: function(ops) {
        repository.createPool(opts);
    },
    createFectory: function() {
        return new fectory.Fectory();
    }
};
