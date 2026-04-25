import urllib.request
import urllib.error
import json

# 配置信息
api_token = 'cfat_iWZa79Q2RncrI629SeGj93EA10MWsYSmbE1lssfw315757d1'

headers = {
    'Authorization': f'Bearer {api_token}',
    'Content-Type': 'application/json'
}

graphql_url = 'https://api.cloudflare.com/client/v4/graphql'

# 尝试使用 r2Operations 而不是 r2OperationsAdaptiveGroups
query = '''
query {
  viewer {
    accounts(filter: { accountTag: "5d4a9e31fb626889b130410ed0590d86" }) {
      r2Operations {
        requests
      }
    }
  }
}
'''

payload = {
    'query': query
}

print('测试 r2Operations 查询...')
try:
    req = urllib.request.Request(graphql_url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(f'结果: {json.dumps(data, indent=2)}')

        if data.get('data') and data['data']['viewer']['accounts']:
            accounts = data['data']['viewer']['accounts']
            if accounts and len(accounts) > 0:
                r2_ops = accounts[0].get('r2Operations')
                if r2_ops:
                    print(f'\n✅ 成功获取 R2 数据!')
                    print(f'数据: {r2_ops}')
        else:
            if 'errors' in data:
                print(f'\n❌ 错误: {data["errors"]}')

except Exception as e:
    print(f'错误: {e}')

print('\n测试完成')