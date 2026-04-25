// functions/api/verify-password.js
export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const UPLOAD_PASSWORD = env.UPLOAD_PASSWORD

    if (!UPLOAD_PASSWORD) {
      return new Response(JSON.stringify({ error: '密码未配置' }), { status: 500 })
    }

    const data = await request.json()
    const password = data.password

    if (!password) {
      return new Response(JSON.stringify({ error: '缺少密码' }), { status: 400 })
    }

    if (password === UPLOAD_PASSWORD) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ error: '密码错误' }), { status: 401 })
    }
  } catch (error) {
    console.error('Verify password error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
