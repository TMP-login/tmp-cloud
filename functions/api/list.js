// functions/api/list.js
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

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = normalizePath(url.searchParams.get('path') || '')

  try {
    const bucket = env.R2_BUCKET
    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    const prefix = path ? `${path}/` : ''
    const allObjects = await listAllObjects(bucket)
    const fileMap = new Map()
    let totalUsed = 0

    for (const obj of allObjects) {
      totalUsed += obj.size || 0

      if (prefix && !obj.key.startsWith(prefix)) {
        continue
      }

      const remainder = obj.key.slice(prefix.length)
      if (!remainder) {
        continue
      }

      const parts = remainder.split('/').filter(Boolean)
      if (parts.length === 0) {
        continue
      }

      const firstPart = parts[0]
      const isDirectoryMarker = obj.key.endsWith('/')

      if (parts.length === 1 && !isDirectoryMarker) {
        fileMap.set(firstPart, {
          name: firstPart,
          size: obj.size,
          uploaded: obj.uploaded,
          isDirectory: false
        })
        continue
      }

      fileMap.set(firstPart, {
        name: firstPart,
        isDirectory: true
      })
    }

    return new Response(JSON.stringify({
      files: Array.from(fileMap.values()),
      totalUsed
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('List error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
