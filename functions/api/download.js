// functions/api/download.js
export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const filePath = url.searchParams.get('path')

  try {
    const bucket = env.R2_BUCKET

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    if (!filePath) {
      return new Response(JSON.stringify({ error: '缺少路径参数' }), { status: 400 })
    }

    const sanitizedPath = filePath
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')

    // 获取文件
    const object = await bucket.get(sanitizedPath)

    if (!object) {
      return new Response(JSON.stringify({ error: '文件不存在' }), { status: 404 })
    }

    // 获取文件名
    const fileName = sanitizedPath.split('/').pop()

    // 返回文件
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
      }
    })
  } catch (error) {
    console.error('Download error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
