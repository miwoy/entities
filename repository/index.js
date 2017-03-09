var mysqlClient = require('mysql');

var mysql = {};

// 连接池
mysql.pool = null;

// 创建连接池
mysql.createPool = function(opts) {
    this.pool = mysqlClient.createPool(opts);
};

// 封装query
mysql.query = function(sql, args, callback) {
    if (this.pool) {
        this.pool.getConnection(function(err, connection) {
            if (err) {
                console.log(err);
                callback(err, null);
                return;
            }
            connection.query(sql, args, function(err, results) {
                connection.release();
                if (err) {
                    callback(err, null);
                    return;
                }

                callback(false, results);
            });
        });
    } else {
        throw new Error("未成功配置连接池");
    }

};

// 封装事物导出方法
mysql.begin = function(callback) {
    if (this.pool) {
        this.pool.getConnection(function(err, connection) {
            if (err) {
                callback(err, null);
                return;
            }
            connection.beginTransaction(function(err) {
                if (err) {
                    callback(err, null);
                    return;
                }

                var trans = function(connection) {

                    return {
                        commit: function(callback) {
                            connection.commit(function(err, results) {
                                if (err) {
                                    return connection.rollback(function(e, results) {
                                        connection.release();
                                        callback(err, null);
                                    });
                                }

                                connection.release();
                                callback(null, results);
                            });
                        },
                        rollback: function(callback) {
                            connection.rollback(function(err, results) {
                                connection.release();
                                callback(err, null);
                            });
                        },
                        query: function(sql, args, callback) {
                            connection.query(sql, args, function(err, results) {
                                if (err) {
                                    return connection.rollback(function(e, results) {
                                        connection.release();
                                        callback(err, null);
                                    });
                                }

                                callback(null, results);
                            });
                        }
                    };
                };

                callback(null, trans(connection));
            });
        });
    } else {
        throw new Error("未成功配置连接池");
    }
};


module.exports = mysql;
