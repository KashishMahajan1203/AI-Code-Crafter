/*
  Redirects plain HTTP to HTTPS. Behind a proxy this relies on
  `trust proxy` so that req.secure reads X-Forwarded-Proto.
*/
export const enforceHttps = (req, res, next) => {
  if (req.secure) {
    return next();
  }

  // Health checks from the platform usually arrive over plain HTTP.
  if (req.path === "/api/health") {
    return next();
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }

  return res.status(403).json({
    success: false,
    message: "HTTPS is required.",
  });
};
