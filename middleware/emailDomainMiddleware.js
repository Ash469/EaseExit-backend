// middleware/emailDomainMiddleware.js

exports.ensurePimsEmail = (req, res, next) => {
  // if (!req.user.email.endsWith('@prasad.edu.in')) {
  //   return res
  //     .status(403)
  //     .json({ message: 'Access denied: must use @pims.edu.in email' });
  // }
  next();
};
