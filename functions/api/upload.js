// functions/api/upload.js
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

const ensureDirectoryMarkers = async (bucket, objectPath) => {
  const parts = normalizePath(objectPath).split('/').filter(Boolean)
  const markerKeys = []

  for (let i = 0; i < parts.length - 1; i++) {
    markerKeys.push(`${parts.slice(0, i + 1).join('/')}/`)
  }

  for (const markerKey of markerKeys) {
    await bucket.put(markerKey, new Uint8Array(0), {
      httpMetadata: {
        contentType: 'application/x-directory'
      }
    })
  }
}

const assertUploadPathAvailable = async (bucket, filePath) => {
  const parts = normalizePath(filePath).split('/').filter(Boolean)

  for (let i = 0; i < parts.length; i++) {
    const segmentPath = parts.slice(0, i + 1).join('/')
    const exactObject = await bucket.get(segmentPath)
    const exactMarker = await bucket.get(`${segmentPath}/`)

    if (i < parts.length - 1) {
      if (exactObject) {
        return false
      }
      continue
    }

    if (exactMarker && !exactObject) {
      return false
    }
  }

  return true
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const bucket = env.R2_BUCKET
    const UPLOAD_PASSWORD = env.UPLOAD_PASSWORD

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const filePath = formData.get('path')
    const password = formData.get('password')

    if (!file || !filePath) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), { status: 400 })
    }

    const sanitizedPath = normalizePath(filePath)
    if (!sanitizedPath) {
      return new Response(JSON.stringify({ error: '路径无效' }), { status: 400 })
    }

    if (!(await assertUploadPathAvailable(bucket, sanitizedPath))) {
      return new Response(JSON.stringify({ error: '同名文件或文件夹已存在' }), { status: 409 })
    }

    const allObjects = await listAllObjects(bucket)
    const totalUsed = allObjects.reduce((sum, obj) => sum + (obj.size || 0), 0)

    const fileSize = file.size
    const LIMIT = 10 * 1024 * 1024 * 1024 // 10GB
    const newTotal = totalUsed + fileSize

    if (newTotal > LIMIT) {
      if (!password || password !== UPLOAD_PASSWORD) {
        return new Response(JSON.stringify({ error: '需要正确密码才能上传' }), { status: 403 })
      }
    }

    await ensureDirectoryMarkers(bucket, sanitizedPath)

    const buffer = await file.arrayBuffer()
    await bucket.put(sanitizedPath, buffer, {
      httpMetadata: {
        contentType: file.type
      }
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
