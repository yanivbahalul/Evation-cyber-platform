'use strict';

const TRAP_TYPES = require('@evation/shared-constants');
const decoyController = require('../controllers/decoyController');
const { attackLog } = require('@evation/shared-utils');
const {
  PATHS: DP,
  isDatabaseTrapPath,
  isEmployeeLoginPath,
  isLegacySignInPath,
  isFileViewerPath,
  isFetchStatusPath,
} = require('../config/deceptionPaths');

module.exports = async function decoyReroute(req, res, next) {
  const threat = req.threatInfo?.type;
  if (!threat) return next();

  attackLog.info('GATEWAY', 'trap_handler_start', {
    trap: threat,
    trap_label: attackLog.trapLabel(threat),
    secondary_traps: req.threatInfo?.secondary?.length
      ? req.threatInfo.secondary.join(',')
      : undefined,
    ...attackLog.requestFields(req),
  });

  req.trapHandled = true;

  try {
    switch (threat) {
      case TRAP_TYPES.DATA_BOMB:
        // DATA_BOMB regex currently matches `export=...`, which can collide with the DB export decoy
        // (e.g. `/internal/services/database?export=credentials`). For DB routes, always prefer
        // the SQLI database handler so the attacker receives the credential dump illusion.
        if (isDatabaseTrapPath(req.path)) {
          if (res.headersSent) return;
          return decoyController.handleDatabaseExport(req, res);
        }
        await decoyController.serveDataBomb(req, res);
        return;
      case TRAP_TYPES.SQLI: {
        const onTrapPage = isDatabaseTrapPath(req.path);
        const onLegacySignIn = isLegacySignInPath(req.path);

        if (
          req.method === 'POST' &&
          isEmployeeLoginPath(req.path) &&
          !onTrapPage &&
          !onLegacySignIn
        ) {
          return decoyController.handoffSqliBypassLogin(req, res);
        }

        if (onTrapPage) {
          if (res.headersSent) return;
          return decoyController.handleDatabaseExport(req, res);
        }

        if (!res.headersSent) {
          return res.redirect(302, req.withBase(DP.database));
        }
        return;
      }
      case TRAP_TYPES.XSS:
        await decoyController.renderSandboxXSS(req, res);
        return;
      case TRAP_TYPES.PATH_TRAVERSAL:
        if (isFileViewerPath(req.path)) {
          return decoyController.renderFileViewer(req, res);
        }
        if (!res.headersSent) {
          return res.redirect(302, req.withBase(`${DP.fileViewer}?file=${encodeURIComponent(req.query?.file || '../etc/passwd')}`));
        }
        return;
      case TRAP_TYPES.SSRF:
        if (isFetchStatusPath(req.path)) {
          return decoyController.renderFetchStatus(req, res);
        }
        if (!res.headersSent) {
          return res.redirect(302, req.withBase(`${DP.fetchStatus}?url=${encodeURIComponent(req.query?.url || 'http://169.254.169.254/latest/meta-data/')}`));
        }
        return;
      case TRAP_TYPES.SCANNER:
        return decoyController.serveScannerTarpit(req, res);
      case TRAP_TYPES.HONEY_TOKEN:
        await decoyController.report(TRAP_TYPES.HONEY_TOKEN, req, {
          payload: JSON.stringify({ action: 'token_used', path: req.originalUrl || req.path }),
          wasted_time_ms: 0,
        });
        return res.redirect(302, req.withBase(`${DP.console}?token_ack=1`));
      case TRAP_TYPES.RECON:
        await decoyController.renderAdminDashboard(req, res);
        return;
      default:
        await decoyController.dispatch(req, res);
        return;
    }
  } catch (err) {
    attackLog.error('GATEWAY', 'trap_handler_failed', {
      trap: threat,
      error: err?.message || String(err),
      ...attackLog.requestFields(req),
    });
    if (!res.headersSent) {
      res.status(500).send('Trap handler error');
    }
  }
};
