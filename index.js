'use strict';

/**
 * Very simple disk cache module
 * @param cachedir String with cache dir. if none is given, <appdir>/cache is used.
 * @param options Object with the following valid options
 * * debug Function (optional) to pass debug data to. You may use `console.log`.
 * * compress Boolean (optional) to compress or not to compress (default: false)
 *
 * adapted from: https://github.com/mostlygeek/Node-Simple-Cache
 */
module.exports = function(cachedir, options) {
	var fs = require('fs');
	var path = require('path');
	var promise = require('promise');
	var crypto = require('crypto');

	var zlib;
	var debug;
	var compress;

	if (options.debug) {
		debug = options.debug || function() {};
	}
	if (options.compress === true) {
		zlib = require('zlib');
	}

	cachedir = cachedir || path.join(process.cwd, 'cache');
	var context = null;

	/**
	 * Function to get the value from the disk or grab and store if needed.
	 * @param key String the value to be retrieved from the disk
	 * @param fillFn Function (context, callback) to produce the value if no value exists on cache.
	 *              The Callback function must be called with the data to be cached and to the
	 *              returned promise be resolved.
	 * @return promise object that will be fulfilled with the data from the cache, when available.
	 */
	var getFunc = function(key, fillFn) {
		var ret = new promise();
		var file = cachenameFunc(key);

		var compressPromise = new promise();
		compressPromise.done(ret);

		fs.readFile(file, 'utf8', function(err, data) {
			if (err) {
				if (!fillFn) {
					ret.reject('no fill function');
					return;
				}
				fillFn.call(context, function(results) {
					writeFunc(key, results);
					ret.resolve(results);
				});
			}
			else {
				/**
				 * Resolve promise immediately with the 
				 * data from the cache. 
				 */
				if (options.compress === true) {
					zlib.gunzip(data, function(err, data) {
						if (err) compressPromise.reject(err);
						else compressPromise.resolve(data);
					});
				}
				else {
					compressPromise.resolve(data);
				}
			}
		});

		return(ret);
	};

	/**
	 * Stores value in cache.
	 * @param key string
	 * @param data string
	 */
	var writeFunc = function(key, data) {
		var file = cachenameFunc(key);
		var ret = new promise();

		var compressPromise = new promise();

		compressPromise.done(function(err, data) {
			if (err) { ret.reject(err); return; }

			fs.writeFile(file, data, function(err) {
				if (err) {
					debug("Cache write error: " + err);
				}
				ret.resolve();
			});
		});

		if (options.compress === true) {
			actualData = zlib.gzip(
				data,
				function(err, data) {
					if (err) compressPromise.reject(err, data);
					else compressPromise.resolve(data);
				}
			);
		}
		else {
			compressPromise.resolve(data);
		}

		return (ret);
	};

	/**
	 * Deletes the given key from the cache
	 * @param key String value to delete from cache
	 * @return promise
	 */
	var deleteFunc = function(key) {
		var file = cachenameFunc(key);
		var ret = new promise();

		fs.stat(file, function(err, stat) {
			if (err == null) {
				fs.unlink(file, function() {
					promise.resolve();
				});
			}
			else if (err.code == 'ENOENT') {
				promise.resolve();
			}
			else {
				promise.reject('Error erasing file: ' + err.code);
			}
		});

		return (ret);
	};

	/**
	 * Creates a cache name based on the given key
	 * @param key String representing the original file name
	 * @return String with the full folder to use
	 */
	var cachenameFunc = function(key) {
		var shasum = crypto.createHash('sha1');
		shasum.update(key);
		var digest = shasum.digest('hex')
		return (path.join(cachedir, digest[0], digest));
	};

	context = {
		get: getFunc,
		write: writeFunc,
		delete: deleteFunc,
		cachname: cachenameFunc
	};

	return (context);
};
