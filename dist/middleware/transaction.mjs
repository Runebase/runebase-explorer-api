import db from '../models/index.mjs';
export function transactionMiddleware() {
  return async (req, res, next) => {
    req.state = req.state || {};
    req.state.transaction = await db.sequelize.transaction();
    try {
      await next();
      await req.state.transaction.commit();
    } catch (err) {
      await req.state.transaction.rollback();
      throw err;
    }
  };
}

// Express-compatible version using res.on('finish')
export function dbTransaction() {
  return async (req, res, next) => {
    req.state = req.state || {};
    let t;
    try {
      t = await db.sequelize.transaction();
      req.state.transaction = t;

      // Store the original res.json to intercept
      const originalJson = res.json.bind(res);
      const originalEnd = res.end.bind(res);
      let committed = false;
      res.json = async function (...args) {
        if (!committed) {
          committed = true;
          try {
            await t.commit();
          } catch (e) {
            // already committed or rolled back
          }
        }
        return originalJson(...args);
      };
      res.end = async function (...args) {
        if (!committed) {
          committed = true;
          try {
            await t.commit();
          } catch (e) {
            // already committed or rolled back
          }
        }
        return originalEnd(...args);
      };

      // If error occurs, rollback
      res.on('close', async () => {
        if (!committed) {
          committed = true;
          try {
            await t.rollback();
          } catch (e) {
            // already committed or rolled back
          }
        }
      });
      next();
    } catch (err) {
      if (t) {
        try {
          await t.rollback();
        } catch (e) {}
      }
      next(err);
    }
  };
}