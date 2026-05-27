'use strict';

/**
 * Data Bomb Trap — fires on DATA_BOMB detection / generic scanner traffic.
 * Streams up to 100 GB of garbage bytes to the attacker using a Readable
 * stream with backpressure (stream.pipe(res)). RAM stays flat regardless of
 * the requested cap because chunks are reused and dropped as soon as flushed.
 */

const { Readable } = require('stream');
const TRAP_TYPES   = require('@evation/shared-constants');
const attackLog    = require('../utils/attackLog');

const CHUNK_SIZE  = 64 * 1024;                 // 64 KB per push
const TOTAL_BYTES = 100 * 1024 * 1024 * 1024;  // 100 GB cap
const FILLER_BYTE = 0x41;                      // 'A'

class GarbageStream extends Readable {
  constructor(totalBytes) {
    super({ highWaterMark: CHUNK_SIZE });
    this.remaining = totalBytes;
    this._chunk    = Buffer.alloc(CHUNK_SIZE, FILLER_BYTE);
  }
  _read() {
    if (this.remaining <= 0) { this.push(null); return; }
    const size = Math.min(CHUNK_SIZE, this.remaining);
    const out  = size === CHUNK_SIZE ? this._chunk : this._chunk.subarray(0, size);
    this.remaining -= size;
    this.push(out);
  }
}

exports.stream = (req, res, { report } = {}) => {
  const startTime = Date.now();
  const bomb      = new GarbageStream(TOTAL_BYTES);
  let bytesSent   = 0;
  let finalized   = false;

  attackLog.info('TRAP', 'data_bomb_stream_started', {
    trap: TRAP_TYPES.DATA_BOMB,
    trap_label: attackLog.trapLabel(TRAP_TYPES.DATA_BOMB),
    max_bytes: TOTAL_BYTES,
    filename: 'backup.zip',
    ...attackLog.requestFields(req),
  });

  res.status(200);
  res.setHeader('Content-Type',        'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="backup.zip"');
  res.setHeader('Content-Length',      String(TOTAL_BYTES));
  res.setHeader('Cache-Control',       'no-store');

  bomb.on('data', (chunk) => { bytesSent += chunk.length; });

  const finalize = async () => {
    if (finalized) return;
    finalized = true;
    bomb.destroy();
    const wasted = Date.now() - startTime;
    attackLog.info('TRAP', 'data_bomb_stream_ended', {
      trap: TRAP_TYPES.DATA_BOMB,
      wasted_ms: wasted,
      bytes_sent: bytesSent,
      ...attackLog.requestFields(req),
    });
    if (report) {
      await report(TRAP_TYPES.DATA_BOMB, req, {
        startTime,
        wasted_time_ms: wasted,
        bytes_sent: bytesSent,
      });
    }
  };

  req.on('close', finalize);
  res.on('close', finalize);
  res.on('finish', finalize);

  bomb.pipe(res).on('error', (err) => {
    attackLog.warn('TRAP', 'data_bomb_stream_error', { error: err.code || err.message, bytes_sent: bytesSent });
  });
};
