import { inflateSync } from 'node:zlib';

export const BLACK_BAND = Object.freeze({
  runtime: 'RUNTIME_DEFECT',
  capture: 'CAPTURE_HARNESS_DEFECT',
  none: 'NO_BLACK_BAND',
});

export function classifyBlackBandEvidence({
  runtimeHasBand,
  prototypeHasBand = false,
  capturedBeforeReady = false,
}) {
  if (runtimeHasBand) return BLACK_BAND.runtime;
  if (prototypeHasBand || capturedBeforeReady) return BLACK_BAND.capture;
  return BLACK_BAND.none;
}

export function inspectPngTopBand(buffer, { rows = 56, darkness = 72 } = {}) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error('Not a PNG file');
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const payload = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      payload.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error('Unsupported PNG format; expected non-interlaced 8-bit RGB/RGBA');
  }
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(payload));
  const previous = Buffer.alloc(stride);
  let cursor = 0;
  let longestDarkRun = 0;
  let darkPixelCount = 0;
  const inspectedRows = Math.min(rows, height);
  for (let y = 0; y < inspectedRows; y += 1) {
    const filter = inflated[cursor++];
    const raw = inflated.subarray(cursor, cursor + stride);
    cursor += stride;
    const row = Buffer.allocUnsafe(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : (() => { throw new Error(`Unsupported PNG filter ${filter}`); })();
      row[x] = (raw[x] + predictor) & 0xff;
    }
    let currentRun = 0;
    for (let x = 0; x < width; x += 1) {
      const index = x * bytesPerPixel;
      const opaque = colorType === 2 || row[index + 3] >= 200;
      const dark = opaque && row[index] < darkness && row[index + 1] < darkness && row[index + 2] < darkness;
      if (dark) {
        darkPixelCount += 1;
        currentRun += 1;
        longestDarkRun = Math.max(longestDarkRun, currentRun);
      } else {
        currentRun = 0;
      }
    }
    row.copy(previous);
  }
  const bandThreshold = Math.max(40, Math.floor(width * 0.12));
  return {
    width,
    height,
    inspectedRows,
    darkPixelCount,
    longestDarkRun,
    bandThreshold,
    hasBlackBand: longestDarkRun >= bandThreshold,
  };
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}
