const normalizePath = (path = '') => path
  .replace(/[<>:"|?*]/g, '_')
  .replace(/\\+/g, '/')
  .replace(/\/+/g, '/')
  .replace(/^\/+/, '')
  .replace(/\/+$/, '')

const ensureDirectoryMarkers = async (bucket, folderPath) => {
  const parts = normalizePath(folderPath).split('/').filter(Boolean)
  const markerKeys = []

  for (let i = 0; i < parts.length; i++) {
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

const assertFolderPathAvailable = async (bucket, folderPath) => {
  const exactObject = await bucket.get(folderPath)
  const exactMarker = await bucket.get(`${folderPath}/`)

  if (exactObject || exactMarker) {
    return false
  }

  return true
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const bucket = env.R2_BUCKET

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    const data = await request.json()
    const folderPath = normalizePath(data.path || '')

    if (!folderPath) {
      return new Response(JSON.stringify({ error: '缺少路径参数' }), { status: 400 })
    }

    if (!(await assertFolderPathAvailable(bucket, folderPath))) {
      return new Response(JSON.stringify({ error: '同名文件或文件夹已存在' }), { status: 409 })
    }

    await ensureDirectoryMarkers(bucket, folderPath)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Create folder error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}