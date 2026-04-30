// functions/api/rename.js
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

const pathExists = async (bucket, path) => {
  const normalizedPath = normalizePath(path)
  const exactObject = await bucket.get(normalizedPath)
  const exactMarker = await bucket.get(`${normalizedPath}/`)
  return Boolean(exactObject || exactMarker)
}

const copyObject = async (bucket, sourceKey, targetKey) => {
  const source = await bucket.get(sourceKey)
  if (!source) {
    throw new Error(`源对象不存在: ${sourceKey}`)
  }

  const body = await source.arrayBuffer()
  await bucket.put(targetKey, body, {
    httpMetadata: source.httpMetadata,
    customMetadata: source.customMetadata
  })
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const bucket = env.R2_BUCKET

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    const data = await request.json()
    const oldPath = normalizePath(data.oldPath || data.path)
    const newPath = normalizePath(data.newPath)
    const isDirectory = Boolean(data.isDirectory)

    if (!oldPath || !newPath) {
      return new Response(JSON.stringify({ error: '缺少路径参数' }), { status: 400 })
    }

    if (oldPath === newPath) {
      return new Response(JSON.stringify({ success: true, noChange: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (isDirectory && newPath.startsWith(`${oldPath}/`)) {
      return new Response(JSON.stringify({ error: '不能重命名到自身的子目录中' }), { status: 400 })
    }

    if (await pathExists(bucket, newPath)) {
      return new Response(JSON.stringify({ error: '目标名称已存在' }), { status: 409 })
    }

    if (isDirectory) {
      const oldPrefix = `${oldPath}/`
      const newPrefix = `${newPath}/`
      const allObjects = await listAllObjects(bucket, oldPrefix)

      if (allObjects.length === 0) {
        await bucket.put(newPrefix, new Uint8Array(0), {
          httpMetadata: {
            contentType: 'application/x-directory'
          }
        })
        await bucket.delete(oldPrefix)
      } else {
        const keysToDelete = []

        for (const object of allObjects) {
          const newKey = `${newPrefix}${object.key.slice(oldPrefix.length)}`
          await copyObject(bucket, object.key, newKey)
          keysToDelete.push(object.key)
        }

        if (keysToDelete.length > 0) {
          await deleteKeysInBatches(bucket, keysToDelete)
        }

        await bucket.delete(oldPrefix)
      }
    } else {
      await copyObject(bucket, oldPath, newPath)
      await bucket.delete(oldPath)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Rename error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}