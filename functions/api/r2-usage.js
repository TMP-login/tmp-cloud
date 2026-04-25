export async function onRequestGet(context) {
  const { env } = context
  const accountId = '5d4a9e31fb626889b130410ed0590d86'
  const apiToken = 'cfat_iWZa79Q2RncrI629SeGj93EA10MWsYSmbE1lssfw315757d1'
  const bucketName = 'tmp-cloud-r2'

  try {
    // 1. 计算存储使用情况
    let totalStorage = 0
    let objectCount = 0
    let truncated = true
    let cursor

    while (truncated) {
      const result = await env.R2_BUCKET.list({
        limit: 1000,
        cursor: cursor
      })

      objectCount += result.objects.length
      for (const obj of result.objects) {
        totalStorage += obj.size || 0
      }

      truncated = result.truncated
      cursor = result.cursor

      if (!truncated || !cursor) {
        break
      }
    }

    // 2. 尝试获取 R2 操作数据（使用 GraphQL API）
    let classAOperations = 0
    let classBOperations = 0

    try {
      const graphqlUrl = 'https://api.cloudflare.com/client/v4/graphql'
      const query = `
        query R2Usage {
          viewer {
            accounts(filter: { accountTag: "${accountId}" }) {
              r2OperationsAdaptiveGroups {
                requests
              }
            }
          }
        }
      `

      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.data && data.data.viewer && data.data.viewer.accounts) {
          const accounts = data.data.viewer.accounts
          if (accounts.length > 0) {
            const r2Groups = accounts[0].r2OperationsAdaptiveGroups
            if (r2Groups) {
              // 简化处理：将所有请求都视为 B 类操作
              classBOperations = r2Groups.reduce((total, group) => total + (group.requests || 0), 0)
            }
          }
        }
      }
    } catch (e) {
      console.log('GraphQL API error:', e.message)
    }

    // 3. 计算免费额度使用情况
    const storageGB = totalStorage / (1024 * 1024 * 1024)
    const storageLimitGB = 10
    const classALimit = 1000000
    const classBLimit = 10000000

    return new Response(JSON.stringify({
      success: true,
      storage: {
        used: totalStorage,
        usedGB: Number(storageGB.toFixed(4)),
        limitGB: storageLimitGB,
        percentage: Math.min(100, Math.round((storageGB / storageLimitGB) * 100))
      },
      classA: {
        used: classAOperations,
        limit: classALimit,
        percentage: Math.min(100, Math.round((classAOperations / classALimit) * 100))
      },
      classB: {
        used: classBOperations,
        limit: classBLimit,
        percentage: Math.min(100, Math.round((classBOperations / classBLimit) * 100))
      },
      objectCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('R2 Usage error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}