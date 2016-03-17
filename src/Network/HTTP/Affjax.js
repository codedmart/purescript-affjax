/* global exports */
/* global XMLHttpRequest */
/* global console */
/* global module */
"use strict";

// module Network.HTTP.Affjax

// jshint maxparams: 6
exports._ajax = function (mkHeader, options, progess, canceler, errback, callback) {
  var platformSpecific = { };
  if (typeof module !== "undefined" && module.require) {
    // We are on node.js
    platformSpecific.newXHR = function () {
      var XHR = module.require("xhr2");
      return new XHR();
    };

    platformSpecific.fixupUrl = function (url) {
      var urllib = module.require("url");
      var u = urllib.parse(url);
      u.protocol = u.protocol || "http:";
      u.hostname = u.hostname || "localhost";
      return urllib.format(u);
    };

    platformSpecific.getResponse = function (xhr) {
      return xhr.response;
    };
  } else {
    // We are in the browser
    platformSpecific.newXHR = function () {
      return new XMLHttpRequest();
    };

    platformSpecific.fixupUrl = function (url) {
      return url || "/";
    };

    platformSpecific.getResponse = function (xhr) {
      return xhr.response;
    };
  }

  return function () {
    var xhr = platformSpecific.newXHR();
    var fixedUrl = platformSpecific.fixupUrl(options.url);
    xhr.open(options.method || "GET", fixedUrl, true, options.username, options.password);
    if (options.headers) {
      try {
        for (var i = 0, header; (header = options.headers[i]) != null; i++) {
          xhr.setRequestHeader(header.field, header.value);
        }
      }
      catch (e) {
        errback(e)();
      }
    }
    xhr.onerror = function () {
      errback(new Error("AJAX request failed: " + options.method + " " + options.url))();
    };
    xhr.onload = function () {
      callback({
        status: xhr.status,
        headers: xhr.getAllResponseHeaders().split("\n")
          .filter(function (header) {
            return header.length > 0;
          })
          .map(function (header) {
            var i = header.indexOf(":");
            return mkHeader(header.substring(0, i))(header.substring(i + 2));
          }),
        response: platformSpecific.getResponse(xhr)
      })();
    };
    xhr.responseType = options.responseType;
    xhr.withCredentials = options.withCredentials;
    xhr.send(options.content);
    return {
      progress: progess(xhr),
      canceler: canceler(xhr)
    };
  };
};

// jshint maxparams: 4
exports._progressAjax = function (xhr, progressError, errback, callback) {
  function onProgress(e) {
    if (e.computableLength) {
      console.log("onProgress", Math.floor(e.loaded / e.total * 100));
      return callback(Math.floor(e.loaded / e.total * 100))();
    }
  }

  function onLoadStart() {
    console.log("onLoadStart", 0);
    return callback(0)();
  }

  function onLoadEnd(e) {
    console.log("onLoadEnd", e.loaded);
    return callback(e.loaded)();
  }

  return function () {
    if (typeof module !== "undefined" && module.require) {
    } else {
      var _xhr = xhr.upload ? xhr.upload : xhr;

      _xhr.upload.onloadstart = onLoadStart;
      _xhr.upload.onprogress = onProgress;
      _xhr.upload.onloadend = onLoadEnd;
    }
  };
};

// jshint maxparams: 4
exports._cancelAjax = function (xhr, cancelError, errback, callback) {
  return function () {
    try { xhr.abort(); } catch (e) { return callback(false)(); }
    return callback(true)();
  };
};

exports._makeAff = function (cb) {
  return function (success, error) {
    return cb(function (e) {
      return function () {
        error(e);
      };
    })(function (v) {
      return function () {
        try {
          success(v);
        } catch (e) {
          error(e);
        }
      };
    })();
  };
};

exports._forkAff = function (nonSomething, aff) {
  var voidF = function () {};

  return function (success, error) {
    var canceler = aff(voidF, voidF);

    try {
      success(canceler);
    } catch (e) {
      error(e);
    }

    return nonSomething;
  };
};
