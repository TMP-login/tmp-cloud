// functions/api/upload.js
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

    // 检查空间
    const listResult = await bucket.list()
    const allObjects = listResult.objects || []
    let totalUsed = 0
    for (const obj of allObjects) {
      totalUsed += obj.size
    }

    const fileSize = file.size
    const LIMIT = 10 * 1024 * 1024 * 1024 // 10GB
    const newTotal = totalUsed + fileSize

    // 如果超过限制，需要密码
    if (newTotal > LIMIT) {
      if (!password || password !== UPLOAD_PASSWORD) {
        return new Response(JSON.stringify({ error: '需要正确密码才能上传' }), { status: 403 })
      }
    }

    // 上传文件
    const buffer = await file.arrayBuffer()
    const sanitizedPath = filePath
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')

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
