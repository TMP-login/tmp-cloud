// functions/api/delete.js
export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const bucket = env.R2_BUCKET

    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    const data = await request.json()
    const filePath = data.path

    if (!filePath) {
      return new Response(JSON.stringify({ error: '缺少路径参数' }), { status: 400 })
    }

    const sanitizedPath = filePath
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')

    // 删除文件
    await bucket.delete(sanitizedPath)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Delete error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
