// functions/api/list.js
export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.searchParams.get('path') || ''

  try {
    const bucket = env.R2_BUCKET
    if (!bucket) {
      return new Response(JSON.stringify({ error: '存储未配置' }), { status: 500 })
    }

    // 列出所有文件
    const listResult = await bucket.list()
    const allObjects = listResult.objects || []

    // 构建虚拟目录树
    const fileMap = new Map()
    let totalUsed = 0

    for (const obj of allObjects) {
      const key = obj.key
      totalUsed += obj.size

      // 解析路径
      const parts = key.split('/').filter(p => p)

      if (parts.length === 0) continue

      // 如果当前路径为空或匹配，才显示
      if (path === '') {
        // 根目录
        const firstPart = parts[0]
        if (parts.length === 1) {
          // 根目录文件
          fileMap.set(firstPart, {
            name: firstPart,
            size: obj.size,
            uploaded: obj.uploaded,
            isDirectory: false
          })
        } else {
          // 根目录文件夹
          if (!fileMap.has(firstPart)) {
            fileMap.set(firstPart, {
              name: firstPart,
              isDirectory: true
            })
          }
        }
      } else {
        // 非根目录
        const pathParts = path.split('/').filter(p => p)
        if (parts.length > pathParts.length) {
          // 检查是否在当前路径下
          let match = true
          for (let i = 0; i < pathParts.length; i++) {
            if (parts[i] !== pathParts[i]) {
              match = false
              break
            }
          }

          if (match) {
            const nextPart = parts[pathParts.length]
            if (parts.length === pathParts.length + 1) {
              // 当前目录的文件
              fileMap.set(nextPart, {
                name: nextPart,
                size: obj.size,
                uploaded: obj.uploaded,
                isDirectory: false
              })
            } else {
              // 当前目录的文件夹
              if (!fileMap.has(nextPart)) {
                fileMap.set(nextPart, {
                  name: nextPart,
                  isDirectory: true
                })
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      files: Array.from(fileMap.values()),
      totalUsed: totalUsed
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('List error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
