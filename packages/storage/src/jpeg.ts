/** Remove APP/COM metadata, including EXIF/GPS, before controlled distribution. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid JPEG");
  const chunks: Uint8Array[] = [bytes.slice(0, 2)];
  let pos = 2;
  while (pos < bytes.length) {
    const start = pos;
    if (bytes[pos++] !== 0xff) throw new Error("Invalid JPEG marker");
    while (bytes[pos] === 0xff) pos++;
    const marker = bytes[pos++];
    if (marker === 0xd9) {
      chunks.push(bytes.slice(start, pos));
      break;
    }
    if (marker === 0 || marker === undefined || marker === 0xd8)
      throw new Error("Invalid JPEG marker");
    if (marker >= 0xd0 && marker <= 0xd7) {
      chunks.push(bytes.slice(start, pos));
      continue;
    }
    const size = (bytes[pos] << 8) | bytes[pos + 1];
    if (size < 2 || pos + size > bytes.length)
      throw new Error("Invalid JPEG segment");
    const end = pos + size;
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe)
      chunks.push(bytes.slice(start, end));
    pos = end;
    if (marker === 0xda) {
      let scanEnd = pos;
      while (scanEnd < bytes.length - 1) {
        if (
          bytes[scanEnd] === 0xff &&
          bytes[scanEnd + 1] !== 0x00 &&
          bytes[scanEnd + 1] !== 0xff &&
          !(bytes[scanEnd + 1] >= 0xd0 && bytes[scanEnd + 1] <= 0xd7)
        )
          break;
        scanEnd++;
      }
      chunks.push(bytes.slice(pos, scanEnd));
      pos = scanEnd;
    }
  }
  if (chunks[chunks.length - 1]?.at(-1) !== 0xd9)
    throw new Error("Truncated JPEG");
  const output = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    output.set(c, offset);
    offset += c.length;
  }
  return output;
}
