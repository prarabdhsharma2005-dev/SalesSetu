const assert = require('node:assert/strict')
const test = require('node:test')
const { TavilyService } = require('../dist/services/tavily.service.js')

test('POC search targets official leadership and relevant professional profiles', async () => {
  const originalFetch = global.fetch
  const originalKey = process.env.TAVILY_API_KEY
  const requests = []
  process.env.TAVILY_API_KEY = 't'
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init.body)) })
    const index = requests.length
    return new Response(JSON.stringify({
      results: [{ title: `Search result ${index}`, url: `https://example.com/source-${index}`, content: 'Public company information.' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const results = await TavilyService.searchPOCs('Example Systems', 'https://example.com')
    assert.equal(requests.length, 2)
    assert.equal(requests[0].url, 'https://api.tavily.com/search')
    assert.equal(requests[0].body.query, 'Example Systems leadership team executives official company sales partnerships business development')
    assert.deepEqual(requests[0].body.include_domains, ['example.com'])
    assert.equal(requests[1].body.query, 'Example Systems LinkedIn professional profiles sales partnerships business development marketing technology procurement')
    assert.equal(results.length, 2)
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.TAVILY_API_KEY
    else process.env.TAVILY_API_KEY = originalKey
  }
})
