// Force no-cache headers on all dev server responses.
// Prevents browsers (especially Brave) from serving stale assets on Ctrl-R.
//
// Why writeHead override instead of setHeader?
//   setupProxy middleware runs before webpack-dev-middleware, but
//   webpack-dev-middleware can overwrite Cache-Control and set ETag/Last-Modified
//   headers later. By patching writeHead we inject our headers at the last moment
//   before they hit the wire, guaranteeing they stick.
//
// Why strip ETag / Last-Modified?
//   On a normal reload (Ctrl-R) Brave sends conditional requests
//   (If-None-Match / If-Modified-Since). If the server replies 304 the browser
//   serves the old cached body — exactly the stale-UI problem. Removing these
//   headers forces a full 200 response every time.

module.exports = function (app) {
  app.use((req, res, next) => {
    const originalWriteHead = res.writeHead;

    res.writeHead = function () {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      // Prevent 304 Not Modified responses
      res.removeHeader('ETag');
      res.removeHeader('Last-Modified');

      return originalWriteHead.apply(this, arguments);
    };

    next();
  });
};
