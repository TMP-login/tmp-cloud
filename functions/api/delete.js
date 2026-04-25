// functions/api/delete.js
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

const deleteKeysInBatches = async (bucket, keys) => {
  const batchSize = 100
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    await Promise.all(batch.map(key => bucket.delete(key)))
  }
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const bucket = env.R2_BUCKET

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    const data = await request.json()
    const filePath = data.path
    const isDirectory = Boolean(data.isDirectory)

    if (!filePath) {
      return new Response(JSON.stringify({ error: '缺少路径参数' }), { status: 400 })
    }

    const sanitizedPath = normalizePath(filePath)
    if (!sanitizedPath) {
      return new Response(JSON.stringify({ error: '路径无效' }), { status: 400 })
    }

    if (isDirectory) {
      const folderPrefix = `${sanitizedPath}/`
      const allObjects = await listAllObjects(bucket, folderPrefix)
      const keysToDelete = allObjects
        .map(obj => obj.key)
        .filter(Boolean)
        .filter(key => key !== folderPrefix)

      if (keysToDelete.length > 0) {
        await deleteKeysInBatches(bucket, keysToDelete)
      }

      await bucket.delete(folderPrefix)
    } else {
      await bucket.delete(sanitizedPath)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Delete error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
