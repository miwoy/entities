var _pool = require('./db').pool;

var mysql = {};

mysql.pool = null;

mysql.query = function(sql, args, callback) {
    if (this.pool) {
        this.pool.getConnection(function(err, connection) {
            if (err) {
                console.log(err);
                callback(err, 2001, null);
                return;
            }
            connection.query(sql, args, function(err, results) {
                connection.release();
                if (err) {
                    callback(err, 2000, null);
                    return;
                }

                callback(false, 200, results);
            });
        });
    } else {
        throw new Error("未成功配置连接池");
    }

};

mysql.find = function(sql, args, callback) {
    this.query(sql, args, function(err, code, results) {
        if (err) return callback(err, code === 2000 ? 2002 : code, results);
        callback(err, code, results);
    });
};
mysql.insert = function(sql, args, callback) {
    this.query(sql, args, function(err, code, results) {
        if (err) return callback(err, code === 2000 ? 2004 : code, results);
        callback(err, code, results);
    });
};
mysql.update = function(sql, args, callback) {
    this.query(sql, args, function(err, code, results) {
        if (err) return callback(err, code === 2000 ? 2006 : code, results);
        callback(err, code, results);
    });
};
mysql.delete = function(sql, args, callback) {
    this.query(sql, args, function(err, code, results) {
        if (err) return callback(err, code === 2000 ? 2007 : code, results);
        callback(err, code, results);
    });
};

mysql.begin = function(callback) {
    if (this.pool) {
        this.pool.getConnection(function(err, connection) {
            if (err) {
                callback(err, 2001, null);
                return;
            }
            connection.beginTransaction(function(err) {
                if (err) {
                    callback(err, 2005, null);
                    return;
                }

                var trans = function(connection) {
                    var _conn = connection;

                    return {
                        commit: function(callback) {
                            _conn.commit(function(err, results) {
                                if (err) {
                                    return _conn.rollback(function(err, results) {
                                        connection.release();
                                        callback(err, 2005, null);
                                    });
                                }
                                connection.release();
                                callback(false, 200, results);
                            });
                        },
                        rollback: function(callback) {
                            _conn.rollback(function(err, results) {
                                connection.release();
                                callback(err, 2005, null);
                            });
                        },
                        inject: function(model) {
                            model._connection = connection;
                            return model;
                        },
                        query: function(sql, args, callback) {
                            var self = this;
                            _conn.query(sql, args, function(err, results) {
                                if (err) {
                                    console.log(err);
                                    return self.rollback(function(e, c, r) {
                                        callback(err, 2000, null);
                                    });
                                }

                                callback(null, 200, results);
                            });
                        },
                        find: function(sql, args, callback) {
                            this.query(sql, args, function(err, code, results) {
                                if (err) return callback(err, code === 2000 ? 2002 : code, results);
                                callback(err, code, results);
                            });
                        },
                        insert: function(sql, args, callback) {
                            this.query(sql, args, function(err, code, results) {
                                if (err) return callback(err, code === 2000 ? 2004 : code, results);
                                callback(err, code, results);
                            });
                        },
                        update: function(sql, args, callback) {
                            this.query(sql, args, function(err, code, results) {
                                if (err) return callback(err, code === 2000 ? 2006 : code, results);
                                callback(err, code, results);
                            });
                        },
                        delete: function(sql, args, callback) {
                            this.query(sql, args, function(err, code, results) {
                                if (err) return callback(err, code === 2000 ? 2007 : code, results);
                                callback(err, code, results);
                            });
                        }
                    };
                };

                callback(null, 200, trans(connection));
            });
        });
    } else {
        throw new Error("未成功配置连接池");
    }
};


module.exports = mysql;
