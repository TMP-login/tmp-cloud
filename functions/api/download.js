// functions/api/download.js
const normalizePath = (path = '') => path
  .replace(/[<>:"|?*]/g, '_')
  .replace(/\\+/g, '/')
  .replace(/\/+/g, '/')
  .replace(/^\/+/, '')
  .replace(/\/+$/, '')

const listAllObjects = async (bucket, prefix = '') => {
  const objects = []
  let cursor
  let truncated = true

  while (truncated) {
    const result = await bucket.list({
      prefix,
      cursor,
      limit: 1000
    })

    objects.push(...(result.objects || []))
    truncated = Boolean(result.truncated)
    cursor = result.cursor

    if (!truncated || !cursor) {
      break
    }
  }

  return objects
}

const crc32Table = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

const crc32Update = (crc, bytes) => {
  let value = crc ^ 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    value = crc32Table[(value ^ bytes[i]) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

const textEncoder = new TextEncoder()

const writeUint16LE = (view, offset, value) => {
  view.setUint16(offset, value, true)
}

const writeUint32LE = (view, offset, value) => {
  view.setUint32(offset, value >>> 0, true)
}

const dosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear())
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  return { dosDate, dosTime }
}

const createLocalFileHeader = (nameBytes, crc, size, dateInfo) => {
  const buffer = new ArrayBuffer(30 + nameBytes.length)
  const view = new DataView(buffer)
  writeUint32LE(view, 0, 0x04034b50)
  writeUint16LE(view, 4, 20)
  writeUint16LE(view, 6, 0x0808)
  writeUint16LE(view, 8, 0)
  writeUint16LE(view, 10, dateInfo.dosTime)
  writeUint16LE(view, 12, dateInfo.dosDate)
  writeUint32LE(view, 14, crc)
  writeUint32LE(view, 18, size)
  writeUint32LE(view, 22, size)
  writeUint16LE(view, 26, nameBytes.length)
  writeUint16LE(view, 28, 0)

  const header = new Uint8Array(buffer)
  header.set(nameBytes, 30)
  return header
}

const createCentralDirectoryHeader = (entry) => {
  const nameBytes = textEncoder.encode(entry.name)
  const buffer = new ArrayBuffer(46 + nameBytes.length)
  const view = new DataView(buffer)
  writeUint32LE(view, 0, 0x02014b50)
  writeUint16LE(view, 4, 20)
  writeUint16LE(view, 6, 20)
  writeUint16LE(view, 8, 0x0808)
  writeUint16LE(view, 10, 0)
  writeUint16LE(view, 12, entry.dateInfo.dosTime)
  writeUint16LE(view, 14, entry.dateInfo.dosDate)
  writeUint32LE(view, 16, entry.crc)
  writeUint32LE(view, 20, entry.size)
  writeUint32LE(view, 24, entry.size)
  writeUint16LE(view, 28, nameBytes.length)
  writeUint16LE(view, 30, 0)
  writeUint16LE(view, 32, 0)
  writeUint16LE(view, 34, 0)
  writeUint16LE(view, 36, entry.isDirectory ? 0x10 : 0)
  writeUint32LE(view, 38, entry.isDirectory ? 0x10 : 0)
  writeUint32LE(view, 42, entry.offset)

  const header = new Uint8Array(buffer)
  header.set(nameBytes, 46)
  return header
}

const createEndOfCentralDirectory = (entryCount, centralDirectorySize, centralDirectoryOffset) => {
  const buffer = new ArrayBuffer(22)
  const view = new DataView(buffer)
  writeUint32LE(view, 0, 0x06054b50)
  writeUint16LE(view, 4, 0)
  writeUint16LE(view, 6, 0)
  writeUint16LE(view, 8, entryCount)
  writeUint16LE(view, 10, entryCount)
  writeUint32LE(view, 12, centralDirectorySize)
  writeUint32LE(view, 16, centralDirectoryOffset)
  writeUint16LE(view, 20, 0)
  return new Uint8Array(buffer)
}

const createDataDescriptor = (crc, size) => {
  const buffer = new ArrayBuffer(16)
  const view = new DataView(buffer)
  writeUint32LE(view, 0, 0x08074b50)
  writeUint32LE(view, 4, crc)
  writeUint32LE(view, 8, size)
  writeUint32LE(view, 12, size)
  return new Uint8Array(buffer)
}

const ensureParentDirectories = (directorySet, path) => {
  const parts = path.split('/').filter(Boolean)
  for (let i = 1; i < parts.length; i++) {
    directorySet.add(`${parts.slice(0, i).join('/')}/`)
  }
}

const createZipResponse = async (entries, archiveName) => {
  const archiveFileName = `${archiveName || 'download'}.zip`

  const stream = new ReadableStream({
    async start(controller) {
      const centralDirectory = []
      let offset = 0

      for (const entry of entries) {
        const nameBytes = textEncoder.encode(entry.name)
        const dateInfo = dosDateTime(entry.uploaded || new Date())
        const localHeader = createLocalFileHeader(nameBytes, 0, 0, dateInfo)
        const entryOffset = offset

        controller.enqueue(localHeader)
        offset += localHeader.length

        let crc = 0
        let size = 0

        if (!entry.isDirectory) {
          const body = entry.object?.body
          if (body) {
            const reader = body.getReader()
            while (true) {
              const { value, done } = await reader.read()
              if (done) {
                break
              }
              const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
              crc = crc32Update(crc, chunk)
              size += chunk.length
              controller.enqueue(chunk)
              offset += chunk.length
            }
          }
        }

        const dataDescriptor = createDataDescriptor(crc, size)
        controller.enqueue(dataDescriptor)
        offset += dataDescriptor.length

        centralDirectory.push({
          name: entry.name,
          crc,
          size,
          offset: entryOffset,
          isDirectory: entry.isDirectory,
          dateInfo
        })
      }

      const centralDirectoryOffset = offset
      let centralDirectorySize = 0

      for (const entry of centralDirectory) {
        const header = createCentralDirectoryHeader(entry)
        controller.enqueue(header)
        centralDirectorySize += header.length
      }

      const endRecord = createEndOfCentralDirectory(centralDirectory.length, centralDirectorySize, centralDirectoryOffset)
      controller.enqueue(endRecord)
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(archiveFileName)}"`
    }
  })
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const filePath = url.searchParams.get('path')
  const requestedType = url.searchParams.get('type')

  try {
    const bucket = env.R2_BUCKET

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    if (!filePath) {
      return new Response(JSON.stringify({ error: '缺少路径参数' }), { status: 400 })
    }

    const sanitizedPath = normalizePath(filePath)
    if (!sanitizedPath) {
      return new Response(JSON.stringify({ error: '路径无效' }), { status: 400 })
    }

    const folderPrefix = `${sanitizedPath}/`
    const fileObject = requestedType !== 'folder' ? await bucket.get(sanitizedPath) : null

    const isFolder = requestedType === 'folder' || (!fileObject && (await bucket.get(folderPrefix) || (await listAllObjects(bucket, folderPrefix)).length > 0))

    if (!isFolder) {
      if (!fileObject) {
        return new Response(JSON.stringify({ error: '文件不存在' }), { status: 404 })
      }

      const fileName = sanitizedPath.split('/').pop()
      return new Response(fileObject.body, {
        headers: {
          'Content-Type': fileObject.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
        }
      })
    }

    const allObjects = await listAllObjects(bucket, folderPrefix)
    const archiveRootName = `${sanitizedPath.split('/').pop() || sanitizedPath}/`
    const directorySet = new Set([archiveRootName])
    const fileEntries = []

    for (const obj of allObjects) {
      if (!obj.key.startsWith(folderPrefix)) {
        continue
      }

      const relativePath = obj.key.slice(folderPrefix.length)
      if (!relativePath) {
        continue
      }

      if (obj.key.endsWith('/')) {
        directorySet.add(`${archiveRootName}${relativePath}`)
        continue
      }

      ensureParentDirectories(directorySet, relativePath)
      fileEntries.push({
        name: `${archiveRootName}${relativePath}`,
        object: await bucket.get(obj.key),
        isDirectory: false,
        uploaded: obj.uploaded || new Date()
      })
    }

    const directoryEntries = Array.from(directorySet)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({
        name,
        isDirectory: true,
        uploaded: new Date()
      }))

    const zipEntries = [...directoryEntries, ...fileEntries]

    return await createZipResponse(zipEntries, sanitizedPath.split('/').pop() || 'download')
  } catch (error) {
    console.error('Download error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
