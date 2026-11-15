/**
 * Synthetic Binary Image Fixture Generator for CleanStream Studio E2E Tests
 * Generates syntactically valid JPEG, PNG, WebP, BMP, TIFF, AVIF, and HEIC buffers
 * with embedded EXIF, IPTC, XMP, and C2PA markers for opaque-box verification.
 */

// IEEE 802.3 CRC32 for PNG chunk integrity
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16BE(arr, val) {
  arr.push((val >> 8) & 0xff, val & 0xff);
}

function writeUInt32BE(arr, val) {
  arr.push((val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff);
}

function writeUInt16LE(arr, val) {
  arr.push(val & 0xff, (val >> 8) & 0xff);
}

function writeUInt32LE(arr, val) {
  arr.push(val & 0xff, (val >>> 8) & 0xff, (val >>> 16) & 0xff, (val >>> 24) & 0xff);
}

function stringToBytes(str) {
  return Array.from(Buffer.from(str, 'utf8'));
}

/**
 * Creates a valid JPEG image buffer with optional EXIF, IPTC, XMP, and C2PA markers.
 */
export function createJpegWithMetadata({
  width = 64,
  height = 64,
  includeExif = true,
  includeIptc = true,
  includeXmp = true,
  includeC2pa = true,
  includeSynthId = false,
} = {}) {
  const bytes = [];

  // SOI (Start of Image)
  bytes.push(0xff, 0xd8);

  // APP0 (JFIF standard header)
  const app0Payload = [
    ...stringToBytes('JFIF\0'),
    0x01, 0x01, // version 1.1
    0x00,       // aspect ratio units (none)
    0x00, 0x01, // X density = 1
    0x00, 0x01, // Y density = 1
    0x00, 0x00  // no thumbnail
  ];
  bytes.push(0xff, 0xe0);
  writeUInt16BE(bytes, app0Payload.length + 2);
  bytes.push(...app0Payload);

  // APP1: EXIF
  if (includeExif) {
    const exifData = [
      ...stringToBytes('Exif\0\0'),
      // TIFF Header (Little Endian 'II', magic 42, offset 8)
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      // IFD0 with 2 tags (Make: Canon, Software: CleanStream Camera)
      0x02, 0x00, // 2 tags
      // Tag 1: Make (0x010F), ASCII (2), count 6, value offset
      0x0f, 0x01, 0x02, 0x00, 0x06, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00,
      // Tag 2: Model (0x0110), ASCII (2), count 8, value offset
      0x10, 0x01, 0x02, 0x00, 0x08, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00,
      // Next IFD offset: 0
      0x00, 0x00, 0x00, 0x00,
      ...stringToBytes('Canon\0'),
      ...stringToBytes('EOS R5\0\0')
    ];
    bytes.push(0xff, 0xe1);
    writeUInt16BE(bytes, exifData.length + 2);
    bytes.push(...exifData);
  }

  // APP1: Adobe XMP
  if (includeXmp) {
    const xmpXml =
      'http://ns.adobe.com/xap/1.0/\0' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">' +
      '<dc:format>image/jpeg</dc:format>' +
      '<photoshop:Credit>Synthetic Studio</photoshop:Credit>' +
      '</rdf:Description></rdf:RDF></x:xmpmeta>';
    const xmpData = stringToBytes(xmpXml);
    bytes.push(0xff, 0xe1);
    writeUInt16BE(bytes, xmpData.length + 2);
    bytes.push(...xmpData);
  }

  // APP13: IPTC (Photoshop 3.0 8BIM)
  if (includeIptc) {
    const iptcPayload = [
      ...stringToBytes('Photoshop 3.0\0'),
      ...stringToBytes('8BIM'),
      0x04, 0x04, // IPTC-NAA record tag
      0x00, 0x00, // Name length 0
      0x00, 0x00, 0x00, 0x18, // Resource size (24 bytes)
      // IPTC datasets (Record 2: Dataset 5: Object Name)
      0x1c, 0x02, 0x05, 0x00, 0x08,
      ...stringToBytes('SampleAI'),
      // Record 2: Dataset 105: Headline with trainedAlgorithmicMedia
      0x1c, 0x02, 0x69, 0x00, 0x0b,
      ...stringToBytes('AI-Generated')
    ];
    bytes.push(0xff, 0xed);
    writeUInt16BE(bytes, iptcPayload.length + 2);
    bytes.push(...iptcPayload);
  }

  // APP11: C2PA JUMBF Manifest Box
  if (includeC2pa) {
    const c2paPayload = [
      0x4a, 0x50, 0x00, 0x00, // Enclosed 'JP\0\0'
      ...stringToBytes('jumb'),
      ...stringToBytes('c2pa'),
      ...stringToBytes('Google LLC C2PA Manifest v1.2'),
      ...stringToBytes('trainedAlgorithmicMedia')
    ];
    bytes.push(0xff, 0xeb); // APP11 marker
    writeUInt16BE(bytes, c2paPayload.length + 2);
    bytes.push(...c2paPayload);
  }

  // APP2: SynthID Watermark Simulation
  if (includeSynthId) {
    const synthPayload = [
      ...stringToBytes('SynthID\0Google DeepMind SynthID Spatial Watermark v2.0')
    ];
    bytes.push(0xff, 0xe2);
    writeUInt16BE(bytes, synthPayload.length + 2);
    bytes.push(...synthPayload);
  }

  // DQT (Define Quantization Table)
  const dqtPayload = [
    0x00, // Table 0, 8-bit precision
    ...new Array(64).fill(0x10) // Quantization values
  ];
  bytes.push(0xff, 0xdb);
  writeUInt16BE(bytes, dqtPayload.length + 2);
  bytes.push(...dqtPayload);

  // SOF0 (Start of Frame: Baseline DCT)
  const sof0Payload = [
    0x08, // 8 bits per sample
    (height >> 8) & 0xff, height & 0xff, // Height
    (width >> 8) & 0xff, width & 0xff,   // Width
    0x03, // 3 color components (Y, Cb, Cr)
    0x01, 0x11, 0x00, // Component 1: Y (id 1, sub 1x1, qTable 0)
    0x02, 0x11, 0x00, // Component 2: Cb
    0x03, 0x11, 0x00  // Component 3: Cr
  ];
  bytes.push(0xff, 0xc0);
  writeUInt16BE(bytes, sof0Payload.length + 2);
  bytes.push(...sof0Payload);

  // DHT (Define Huffman Table)
  const dhtPayload = [
    0x00, // DC table 0
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b
  ];
  bytes.push(0xff, 0xc4);
  writeUInt16BE(bytes, dhtPayload.length + 2);
  bytes.push(...dhtPayload);

  // SOS (Start of Scan)
  const sosPayload = [
    0x03, // 3 components
    0x01, 0x00,
    0x02, 0x00,
    0x03, 0x00,
    0x00, 0x3f, 0x00 // spectral selection 0..63
  ];
  bytes.push(0xff, 0xda);
  writeUInt16BE(bytes, sosPayload.length + 2);
  bytes.push(...sosPayload);

  // Scan compressed data (minimal valid payload)
  bytes.push(0x00, 0x3f, 0xff, 0x00, 0x55, 0xaa, 0x33);

  // EOI (End of Image)
  bytes.push(0xff, 0xd9);

  return Buffer.from(bytes);
}

/**
 * Creates a clean JPEG with strictly 0 EXIF, 0 IPTC, 0 XMP, and 0 C2PA.
 */
export function createCleanJpeg({ width = 64, height = 64 } = {}) {
  return createJpegWithMetadata({
    width,
    height,
    includeExif: false,
    includeIptc: false,
    includeXmp: false,
    includeC2pa: false,
    includeSynthId: false,
  });
}

/**
 * Creates a valid PNG image buffer with optional eXIf, iTXt (XMP), and caBX (C2PA) chunks.
 */
export function createPngWithMetadata({
  width = 32,
  height = 32,
  includeExif = true,
  includeXmp = true,
  includeC2pa = true,
} = {}) {
  const chunks = [];

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Helper to build a standard PNG chunk with CRC32
  function buildChunk(typeStr, dataBuf) {
    const typeBuf = Buffer.from(typeStr, 'ascii');
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32BE(dataBuf.length, 0);

    const crcPayload = Buffer.concat([typeBuf, dataBuf]);
    const crcVal = crc32(crcPayload);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);

    return Buffer.concat([lengthBuf, typeBuf, dataBuf, crcBuf]);
  }

  // 1. IHDR Chunk (13 bytes)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // 8-bit depth
  ihdrData.writeUInt8(2, 9);  // RGB (color type 2)
  ihdrData.writeUInt8(0, 10); // Compression deflate
  ihdrData.writeUInt8(0, 11); // Filter standard
  ihdrData.writeUInt8(0, 12); // No interlace
  chunks.push(buildChunk('IHDR', ihdrData));

  // 2. eXIf Chunk (EXIF metadata in PNG)
  if (includeExif) {
    const exifData = Buffer.concat([
      Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]),
      Buffer.from('CleanStream-EXIF-Metadata-Tag')
    ]);
    chunks.push(buildChunk('eXIf', exifData));
  }

  // 3. iTXt Chunk (XMP Metadata)
  if (includeXmp) {
    const keyword = Buffer.from('XML:com.adobe.xmp\0\0\0\0\0');
    const xmpText = Buffer.from(
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">' +
      '<photoshop:Credit>PNG Studio</photoshop:Credit>' +
      '</rdf:Description></rdf:RDF></x:xmpmeta>'
    );
    chunks.push(buildChunk('iTXt', Buffer.concat([keyword, xmpText])));
  }

  // 4. caBX Chunk (C2PA manifest block)
  if (includeC2pa) {
    const c2paData = Buffer.from('c2pa-jumb-manifest-box:trainedAlgorithmicMedia:Google LLC');
    chunks.push(buildChunk('caBX', c2paData));
  }

  // 5. IDAT Chunk (valid minimal zlib-compressed scanline)
  // Deflate stream: 78 01 01 01 00 FE FF 00 00 00 00 01 (uncompressed 1 byte filter 0)
  const idatData = Buffer.from([0x78, 0x01, 0x01, 0x01, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x00, 0x01]);
  chunks.push(buildChunk('IDAT', idatData));

  // 6. IEND Chunk (empty data)
  chunks.push(buildChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat([signature, ...chunks]);
}

/**
 * Creates a clean PNG image with 0 metadata chunks.
 */
export function createCleanPng({ width = 32, height = 32 } = {}) {
  return createPngWithMetadata({
    width,
    height,
    includeExif: false,
    includeXmp: false,
    includeC2pa: false,
  });
}

/**
 * Creates a valid WebP image buffer (Extended VP8X format) with optional EXIF, XMP, and C2PA (jumb).
 */
export function createWebpWithMetadata({
  width = 64,
  height = 64,
  includeExif = true,
  includeXmp = true,
  includeC2pa = true,
} = {}) {
  const subChunks = [];

  // VP8X Chunk (10 bytes payload)
  // Flags: bit 3 (EXIF), bit 2 (XMP)
  let flags = 0;
  if (includeExif) flags |= 0x08;
  if (includeXmp) flags |= 0x04;

  const vp8xPayload = Buffer.alloc(10);
  vp8xPayload.writeUInt8(flags, 0); // Flags
  // Canvas width - 1 (24-bit uint LE)
  const wMinus1 = width - 1;
  vp8xPayload.writeUInt8(wMinus1 & 0xff, 4);
  vp8xPayload.writeUInt8((wMinus1 >> 8) & 0xff, 5);
  vp8xPayload.writeUInt8((wMinus1 >> 16) & 0xff, 6);
  // Canvas height - 1 (24-bit uint LE)
  const hMinus1 = height - 1;
  vp8xPayload.writeUInt8(hMinus1 & 0xff, 7);
  vp8xPayload.writeUInt8((hMinus1 >> 8) & 0xff, 8);
  vp8xPayload.writeUInt8((hMinus1 >> 16) & 0xff, 9);

  function wrapRiffChunk(fourCC, data) {
    const header = Buffer.alloc(8);
    header.write(fourCC, 0, 4, 'ascii');
    header.writeUInt32LE(data.length, 4);
    // WebP chunks must be padded to even length if odd
    const pad = (data.length % 2 !== 0) ? Buffer.from([0x00]) : Buffer.alloc(0);
    return Buffer.concat([header, data, pad]);
  }

  subChunks.push(wrapRiffChunk('VP8X', vp8xPayload));

  if (includeExif) {
    const exifPayload = Buffer.from('Exif\0\0II*\0\x08\0\0\0CleanStream-WebP-EXIF');
    subChunks.push(wrapRiffChunk('EXIF', exifPayload));
  }

  if (includeXmp) {
    const xmpPayload = Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""/></rdf:RDF></x:xmpmeta>');
    subChunks.push(wrapRiffChunk('XMP ', xmpPayload));
  }

  if (includeC2pa) {
    const c2paPayload = Buffer.from('jumbc2patrainedAlgorithmicMediaGoogle LLC');
    subChunks.push(wrapRiffChunk('jumb', c2paPayload));
  }

  // VP8L image data chunk
  // Minimal valid lossless WebP frame: 0x2f (signature), width/height bits, etc.
  const vp8lPayload = Buffer.from([
    0x2f, // Lossless signature
    (wMinus1 & 0x3f),
    ((wMinus1 >> 6) & 0x3f) | ((hMinus1 & 0x03) << 6),
    ((hMinus1 >> 2) & 0xff),
    ((hMinus1 >> 10) & 0x0f),
    0x00, 0x00 // transform bits & data
  ]);
  subChunks.push(wrapRiffChunk('VP8L', vp8lPayload));

  // Assemble RIFF container
  const allSubChunks = Buffer.concat(subChunks);
  const totalRiffLen = 4 + allSubChunks.length; // 'WEBP' (4) + chunks

  const riffHeader = Buffer.alloc(12);
  riffHeader.write('RIFF', 0, 4, 'ascii');
  riffHeader.writeUInt32LE(totalRiffLen, 4);
  riffHeader.write('WEBP', 8, 4, 'ascii');

  return Buffer.concat([riffHeader, allSubChunks]);
}

/**
 * Creates a clean WebP image with zero metadata chunks.
 */
export function createCleanWebp({ width = 64, height = 64 } = {}) {
  return createWebpWithMetadata({
    width,
    height,
    includeExif: false,
    includeXmp: false,
    includeC2pa: false,
  });
}

/**
 * Creates a valid BMP image file buffer.
 */
export function createBmpImage({ width = 16, height = 16 } = {}) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buf = Buffer.alloc(fileSize);

  // Bitmap File Header (14 bytes)
  buf.write('BM', 0, 2, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt16LE(0, 6);  // reserved
  buf.writeUInt16LE(0, 8);  // reserved
  buf.writeUInt32LE(54, 10); // pixel data offset

  // DIB Header (BITMAPINFOHEADER: 40 bytes)
  buf.writeUInt32LE(40, 14);     // DIB header size
  buf.writeInt32LE(width, 18);    // Width
  buf.writeInt32LE(height, 22);   // Height
  buf.writeUInt16LE(1, 26);       // Color planes
  buf.writeUInt16LE(24, 28);      // Bits per pixel (24-bit RGB)
  buf.writeUInt32LE(0, 30);       // Compression (BI_RGB none)
  buf.writeUInt32LE(pixelArraySize, 34); // Image size
  buf.writeInt32LE(2835, 38);     // Horizontal resolution (72 DPI)
  buf.writeInt32LE(2835, 42);     // Vertical resolution
  buf.writeUInt32LE(0, 46);       // Colors in palette
  buf.writeUInt32LE(0, 50);       // Important colors

  // Fill pixels with synthetic pattern (gradient)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = 54 + y * rowSize + x * 3;
      buf[offset + 0] = (x * 16) & 0xff; // Blue
      buf[offset + 1] = (y * 16) & 0xff; // Green
      buf[offset + 2] = 0xcc;            // Red
    }
  }

  return buf;
}

/**
 * Creates a valid TIFF image buffer (Little Endian 'II\x2A\x00') with optional EXIF tags.
 */
export function createTiffWithMetadata({
  width = 16,
  height = 16,
  includeExif = true,
} = {}) {
  const bytes = [];

  // Header: 'II' (0x49, 0x49), 42 (0x2a, 0x00), offset to IFD 8
  bytes.push(0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00);

  // IFD: tag count
  const numTags = includeExif ? 5 : 4;
  writeUInt16LE(bytes, numTags);

  // Tag 1: ImageWidth (256, SHORT, 1, width)
  writeUInt16LE(bytes, 256);
  writeUInt16LE(bytes, 3);
  writeUInt32LE(bytes, 1);
  writeUInt32LE(bytes, width);

  // Tag 2: ImageLength (257, SHORT, 1, height)
  writeUInt16LE(bytes, 257);
  writeUInt16LE(bytes, 3);
  writeUInt32LE(bytes, 1);
  writeUInt32LE(bytes, height);

  // Tag 3: PhotometricInterpretation (262, SHORT, 1, 1: BlackIsZero)
  writeUInt16LE(bytes, 262);
  writeUInt16LE(bytes, 3);
  writeUInt32LE(bytes, 1);
  writeUInt32LE(bytes, 1);

  // Tag 4: StripOffsets (273, LONG, 1, offset 200)
  writeUInt16LE(bytes, 273);
  writeUInt16LE(bytes, 4);
  writeUInt32LE(bytes, 1);
  writeUInt32LE(bytes, 200);

  // Tag 5: EXIF / Software Tag (305, ASCII)
  if (includeExif) {
    writeUInt16LE(bytes, 305);
    writeUInt16LE(bytes, 2);
    writeUInt32LE(bytes, 12);
    writeUInt32LE(bytes, 150); // offset to string
  }

  // Next IFD Offset (0 = none)
  writeUInt32LE(bytes, 0);

  // Pad up to offset 150
  while (bytes.length < 150) bytes.push(0x00);
  if (includeExif) {
    const soft = stringToBytes('Canon EOS\0\0\0');
    bytes.push(...soft);
  }

  // Pad up to offset 200 (pixel data)
  while (bytes.length < 200) bytes.push(0x00);
  // Add width * height raw bytes
  for (let i = 0; i < width * height; i++) {
    bytes.push((i * 17) & 0xff);
  }

  return Buffer.from(bytes);
}

/**
 * Creates a clean TIFF without EXIF software tags.
 */
export function createCleanTiff({ width = 16, height = 16 } = {}) {
  return createTiffWithMetadata({ width, height, includeExif: false });
}

/**
 * Creates an ISOBMFF AVIF container with 'ftyp' box and optional C2PA manifest box.
 */
export function createAvifImage({ includeC2pa = false } = {}) {
  const boxes = [];

  // 'ftyp' box
  const ftypLen = 32;
  const ftypBuf = Buffer.alloc(ftypLen);
  ftypBuf.writeUInt32BE(ftypLen, 0);
  ftypBuf.write('ftyp', 4, 4, 'ascii');
  ftypBuf.write('avif', 8, 4, 'ascii');  // Major brand
  ftypBuf.writeUInt32BE(0, 12);           // Minor version
  ftypBuf.write('avif', 16, 4, 'ascii'); // Compatible brands
  ftypBuf.write('mif1', 20, 4, 'ascii');
  ftypBuf.write('miaf', 24, 4, 'ascii');
  ftypBuf.write('MA1B', 28, 4, 'ascii');
  boxes.push(ftypBuf);

  // 'meta' box
  const metaContent = Buffer.from([
    0x00, 0x00, 0x00, 0x00, // FullBox version + flags
    0x00, 0x00, 0x00, 0x0c, 0x68, 0x64, 0x6c, 0x72, 0x00, 0x00, 0x00, 0x00, // hdlr box
    0x00, 0x00, 0x00, 0x00, 0x70, 0x69, 0x63, 0x74, 0x00, 0x00, 0x00, 0x00  // 'pict' handler
  ]);
  const metaHeader = Buffer.alloc(8);
  metaHeader.writeUInt32BE(8 + metaContent.length, 0);
  metaHeader.write('meta', 4, 4, 'ascii');
  boxes.push(Buffer.concat([metaHeader, metaContent]));

  if (includeC2pa) {
    const c2paContent = Buffer.from('c2pa:trainedAlgorithmicMedia:Google LLC C2PA Box');
    const c2paHeader = Buffer.alloc(8);
    c2paHeader.writeUInt32BE(8 + c2paContent.length, 0);
    c2paHeader.write('c2pa', 4, 4, 'ascii');
    boxes.push(Buffer.concat([c2paHeader, c2paContent]));
  }

  // 'mdat' media data box
  const mdatContent = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(8 + mdatContent.length, 0);
  mdatHeader.write('mdat', 4, 4, 'ascii');
  boxes.push(Buffer.concat([mdatHeader, mdatContent]));

  return Buffer.concat(boxes);
}

/**
 * Creates an ISOBMFF HEIC container with 'ftyp' box ('heic' brand).
 */
export function createHeicImage({ includeC2pa = false } = {}) {
  const boxes = [];

  // 'ftyp' box
  const ftypLen = 28;
  const ftypBuf = Buffer.alloc(ftypLen);
  ftypBuf.writeUInt32BE(ftypLen, 0);
  ftypBuf.write('ftyp', 4, 4, 'ascii');
  ftypBuf.write('heic', 8, 4, 'ascii');  // Major brand
  ftypBuf.writeUInt32BE(0, 12);           // Minor version
  ftypBuf.write('heic', 16, 4, 'ascii'); // Compatible brands
  ftypBuf.write('mif1', 20, 4, 'ascii');
  ftypBuf.write('msf1', 24, 4, 'ascii');
  boxes.push(ftypBuf);

  // 'meta' box
  const metaContent = Buffer.from([
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x0c, 0x68, 0x64, 0x6c, 0x72, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x70, 0x69, 0x63, 0x74, 0x00, 0x00, 0x00, 0x00
  ]);
  const metaHeader = Buffer.alloc(8);
  metaHeader.writeUInt32BE(8 + metaContent.length, 0);
  metaHeader.write('meta', 4, 4, 'ascii');
  boxes.push(Buffer.concat([metaHeader, metaContent]));

  if (includeC2pa) {
    const c2paContent = Buffer.from('c2pa:jumb:manifest');
    const c2paHeader = Buffer.alloc(8);
    c2paHeader.writeUInt32BE(8 + c2paContent.length, 0);
    c2paHeader.write('c2pa', 4, 4, 'ascii');
    boxes.push(Buffer.concat([c2paHeader, c2paContent]));
  }

  // 'mdat' box
  const mdatContent = Buffer.from([0x10, 0x20, 0x30, 0x40]);
  const mdatHeader = Buffer.alloc(8);
  mdatHeader.writeUInt32BE(8 + mdatContent.length, 0);
  mdatHeader.write('mdat', 4, 4, 'ascii');
  boxes.push(Buffer.concat([mdatHeader, mdatContent]));

  return Buffer.concat(boxes);
}

/**
 * Creates corrupted or boundary image streams for Tier 2 corner cases.
 */
export function createCorruptedImage(kind) {
  switch (kind) {
    case 'empty':
      return Buffer.alloc(0);
    case 'truncated_jpeg_header':
      // Only SOI marker with incomplete APP0
      return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    case 'truncated_png_header':
      // Only first 4 bytes of signature
      return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    case 'corrupted_riff_webp':
      // RIFF header with length greater than file size
      return Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0xff, 0xff, 0xff, 0x7f, 0x57, 0x45, 0x42, 0x50
      ]);
    case 'zero_dimension_bmp': {
      const bmp = createBmpImage({ width: 16, height: 16 });
      bmp.writeInt32LE(0, 18); // set width to 0
      bmp.writeInt32LE(0, 22); // set height to 0
      return bmp;
    }
    case 'random_garbage_bytes': {
      const garbage = Buffer.alloc(256);
      for (let i = 0; i < garbage.length; i++) {
        garbage[i] = (i * 37 + 13) & 0xff;
      }
      return garbage;
    }
    case 'invalid_magic_bytes': {
      // Fake header that starts with known letters but invalid structure
      return Buffer.from('NOT_AN_IMAGE_FILE_BUFFER_1234567890');
    }
    case 'jpeg_missing_eoi': {
      const valid = createJpegWithMetadata({ width: 32, height: 32 });
      return valid.subarray(0, valid.length - 2); // strip 0xFFD9
    }
    case 'png_truncated_ihdr': {
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
      ]);
    }
    default:
      throw new Error(`Unknown corruption kind: ${kind}`);
  }
}
