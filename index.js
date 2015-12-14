var factory = require("./factory");
var models = require('./lib/models');
var repository = require('./repository');
module.exports = {
    Factory: factory.Factory,
    getModel: models.get,
    setModel: models.set,
    init: function(opts, mds) {
        if (mds)
            models.set(mds);
        repository.createPool(opts);
        return factory.Factory;
    },
    createPool: function(ops) {
        repository.createPool(opts);
    },
    createFactory: function() {
        return new factory.Factory();
    }
};
