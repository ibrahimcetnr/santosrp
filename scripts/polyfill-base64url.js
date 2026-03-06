/**
 * base64url polyfill - Node.js < v16 için
 * RAGE:MP'nin eski Node.js runtime'ı base64url'i desteklemiyor
 */
(function () {
  var _origFrom = Buffer.from.bind(Buffer);

  function b64urlToB64(s) {
    var padded = (s + '===').slice(0, s.length + (4 - (s.length % 4)) % 4);
    return padded.replace(/-/g, '+').replace(/_/g, '/');
  }

  Buffer.from = function (data, encoding) {
    if (encoding === 'base64url' && typeof data === 'string') {
      return _origFrom(b64urlToB64(data), 'base64');
    }
    return _origFrom.apply(Buffer, arguments);
  };

  var _origProtoToString = Buffer.prototype.toString;
  Buffer.prototype.toString = function (encoding) {
    if (encoding === 'base64url') {
      return _origProtoToString.call(this, 'base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return _origProtoToString.apply(this, arguments);
  };
})();
