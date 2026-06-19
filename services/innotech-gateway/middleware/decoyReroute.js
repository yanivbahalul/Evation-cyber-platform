'use strict';

const TRAP_TYPES = require('@evation/shared-constants');
const decoyController = require('../controllers/decoyController');
const honeyToken = require('../traps/honeyToken');
const { attackLog, getAttackerIp } = require('@evation/shared-utils');
const {
  isHoneyTokenAcknowledged,
  shouldReportTokenUsed,
  markTokenUsedReported,
} = require('../utils/honeyTokenFlow');
const {
  PATHS: DP,
  isDatabaseTrapPath,
  isEmployeeLoginPath,
  isLegacySignInPath,
  isFileViewerPath,
  isFetchStatusPath,
  isHoneyTokenApiExportPath,
  isStorageListPath,
  isLeakedArtifactPath,
  isConsolePath,
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
    // Planted leaked artifacts (.env, .git/config) are served as raw text no
    // matter which trap classified the request, so the attacker reliably
    // "discovers" the honey-token catalog values.
    if (isLeakedArtifactPath(req.path)) {
      if (req.path === DP.gitConfigLeak) {
        return decoyController.serveGitConfigLeak(req, res);
      }
      return decoyController.serveEnvLeak(req, res);
    }

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
        // A stolen credential used against a real-looking API → realistic handler.
        if (isHoneyTokenApiExportPath(req.path)) {
          return decoyController.serveHoneyTokenApiExport(req, res);
        }
        if (isStorageListPath(req.path)) {
          return decoyController.serveHoneyTokenStorageList(req, res);
        }
        {
          const acked = isHoneyTokenAcknowledged(req);
          const onConsole = isConsolePath(req.path);
          const alreadyLogged = !shouldReportTokenUsed(req);

          if (acked || alreadyLogged) {
            return decoyController.renderAdminDashboard(req, res);
          }

          const outcome = onConsole ? 200 : 302;
          if (req.honeyToken) {
            await honeyToken.recordUsage(req.honeyToken.value || req.honeyToken.presented, {
              attackerIp: getAttackerIp(req),
              networkContext: 'HTTP',
              method: req.method,
              path: req.originalUrl || req.path,
              userAgent: req.headers['user-agent'],
              outcome,
              traceId: req.traceId,
            });
          }
          await decoyController.report(TRAP_TYPES.HONEY_TOKEN, req, {
            payload: JSON.stringify({
              action: 'token_used',
              outcome,
              service: req.honeyToken?.service,
              tokenType: req.honeyToken?.tokenType,
              leakSource: req.honeyToken?.leakSource,
              path: req.originalUrl || req.path,
            }),
            wasted_time_ms: 0,
          });
          markTokenUsedReported(req);

          if (onConsole) {
            return decoyController.renderAdminDashboard(req, res);
          }
          return res.redirect(302, req.withBase(`${DP.console}?token_ack=1`));
        }
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
