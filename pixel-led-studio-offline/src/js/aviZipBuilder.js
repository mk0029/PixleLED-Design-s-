const encoder = new TextEncoder();
const ascii = (text) => encoder.encode(text);
const join = (...arrays) => {
  const size = arrays.reduce((sum, item) => sum + item.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
};

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function chunk(tag, payload) {
  return join(ascii(tag), u32(payload.length), payload, payload.length & 1 ? new Uint8Array(1) : new Uint8Array());
}

function listChunk(type, payload) {
  return chunk('LIST', join(ascii(type), payload));
}

function bgrFrame(rgb, width, height, rowBytes) {
  const output = new Uint8Array(rowBytes * height);
  const padding = rowBytes - width * 3;
  let target = 0;
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 3;
      output[target++] = rgb[source + 2];
      output[target++] = rgb[source + 1];
      output[target++] = rgb[source];
    }
    target += padding;
  }
  return output;
}

function makeAviChunk(tag, payload) {
  return chunk(tag, payload);
}

export function buildAvi(frames, width, height, fps) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 120 || height > 80) {
    throw new Error('AVI dimensions must be between 1×1 and 120×80.');
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('AVI FPS must be from 1 to 60.');
  if (!Array.isArray(frames) || !frames.length) throw new Error('Cannot export a show with no frames.');
  const rowBytes = Math.ceil(width * 3 / 4) * 4;
  const frameSize = rowBytes * height;
  const estimatedSize = frameSize * frames.length + 4096;
  if (estimatedSize > 0xffffffff) throw new Error('This animation exceeds the RIFF AVI 4 GiB size limit.');
  if (estimatedSize > 128 * 1024 * 1024) throw new Error('This animation is too large to safely assemble in browser memory (128 MiB AVI limit).');

  const frameChunks = [];
  const indexRows = [];
  let moviOffset = 4;
  let maxFrameSize = 0;
  for (const frame of frames) {
    if (!(frame instanceof Uint8Array) || frame.length !== width * height * 3) {
      throw new Error('Every AVI frame must be a tightly packed RGB Uint8Array of the configured matrix size.');
    }
    const data = bgrFrame(frame, width, height, rowBytes);
    const currentChunk = makeAviChunk('00db', data);
    frameChunks.push(currentChunk);
    indexRows.push(join(ascii('00db'), u32(0x10), u32(moviOffset), u32(data.length)));
    moviOffset += currentChunk.length;
    maxFrameSize = Math.max(maxFrameSize, data.length);
  }

  const mainHeader = join(
    u32(Math.round(1_000_000 / fps)), u32(Math.min(0xffffffff, maxFrameSize * fps)), u32(0), u32(0x10),
    u32(frames.length), u32(0), u32(1), u32(maxFrameSize), u32(width), u32(height),
    u32(0), u32(0), u32(0), u32(0),
  );
  const streamHeader = join(
    ascii('vids'), u32(0), u32(0), u16(0), u16(0), u32(0), u32(1), u32(fps),
    u32(0), u32(frames.length), u32(maxFrameSize), u32(0xffffffff), u32(0),
    u16(0), u16(0), u16(width), u16(height),
  );
  const formatHeader = join(
    u32(40), u32(width), u32(height), u16(1), u16(24), u32(0),
    u32(frameSize), u32(0), u32(0), u32(0), u32(0),
  );
  const headers = listChunk('hdrl', join(
    chunk('avih', mainHeader),
    listChunk('strl', join(chunk('strh', streamHeader), chunk('strf', formatHeader))),
  ));
  const moviePayloadSize = frameChunks.reduce((size, current) => size + current.length, 0);
  const movieHeader = join(ascii('LIST'), u32(moviePayloadSize + 4), ascii('movi'));
  const index = chunk('idx1', join(...indexRows));
  const bodySize = 4 + headers.length + movieHeader.length + moviePayloadSize + index.length;
  if (bodySize > 0xffffffff) throw new Error('AVI data exceeds the RIFF container size limit.');
  const riffHeader = join(ascii('RIFF'), u32(bodySize), ascii('AVI '));
  return new Blob([riffHeader, headers, movieHeader, ...frameChunks, index], { type: 'video/x-msvideo' });
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | (Math.floor(date.getSeconds() / 2) & 31);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return [time, day];
}

export async function buildZip(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('ZIP archive must contain at least one file.');
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  const [time, date] = dosDateTime();
  for (const entry of entries) {
    const name = encoder.encode(String(entry.name));
    const data = entry.data instanceof Blob ? entry.data : new Uint8Array(entry.data);
    const size = data instanceof Blob ? data.size : data.length;
    if (!name.length || name.length > 65535 || size > 0xffffffff) throw new Error('ZIP entry exceeds supported size.');
    const crc = data instanceof Blob ? await crc32Blob(data) : crc32(data);
    const localHeader = join(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc),
      u32(size), u32(size), u16(name.length), u16(0),
    );
    locals.push({ localHeader, name, data });
    centrals.push(join(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc),
      u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffset), name,
    ));
    localOffset += localHeader.length + name.length + size;
  }
  const centralDirectory = join(...centrals);
  if (locals.length > 65535 || centralDirectory.length > 0xffffffff) {
    throw new Error('ZIP exceeds classic PKZIP limits.');
  }
  const end = join(
    u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
    u32(centralDirectory.length), u32(localOffset), u16(0),
  );
  const localParts = locals.flatMap(({ localHeader, name, data }) => [localHeader, name, data]);
  return new Blob([...localParts, centralDirectory, end], { type: 'application/zip' });
}

async function crc32Blob(blob) {
  if (typeof blob.stream !== 'function') throw new Error('Streaming ZIP checksums are not supported in this browser.');
  const reader = blob.stream().getReader();
  let crc = 0xffffffff;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const byte of value) crc = crcTableValue((crc ^ byte) & 0xff) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crcTableValue(index) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let tableIndex = 0; tableIndex < 256; tableIndex += 1) {
      let value = tableIndex;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[tableIndex] = value >>> 0;
    }
  }
  return crcTable[index];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
