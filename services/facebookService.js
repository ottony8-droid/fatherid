const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const mime = require('mime-types');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

function buildProxyAgent(proxyConfig) {
  if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) return null;

  const { type, host, port, username, password } = proxyConfig;
  const auth = username && password ? `${username}:${password}@` : '';

  if (type === 'socks5' || type === 'socks4') {
    const url = `${type}://${auth}${host}:${port}`;
    return new SocksProxyAgent(url);
  }

  // HTTP/HTTPS proxy
  const url = `http://${auth}${host}:${port}`;
  return {
    httpAgent: new HttpProxyAgent(url),
    httpsAgent: new HttpsProxyAgent(url)
  };
}

function getAxiosConfig(proxyConfig) {
  if (!proxyConfig) return {};
  const agent = buildProxyAgent(proxyConfig);
  if (!agent) return {};

  if (agent.httpAgent) {
    return { httpAgent: agent.httpAgent, httpsAgent: agent.httpsAgent };
  }
  return { httpAgent: agent, httpsAgent: agent };
}

async function fetchAllPages(accessToken, proxyConfig = null) {
  const pagesMap = new Map();
  const axiosCfg = getAxiosConfig(proxyConfig);

  async function fetchWithPagination(initialUrl, callback) {
    let url = initialUrl;
    while (url) {
      try {
        const response = await axios.get(url, axiosCfg);
        const data = response.data;
        if (data && data.data) {
          await callback(data.data);
        }
        url = data.paging && data.paging.next ? data.paging.next : null;
      } catch (error) {
        console.error(`Error fetching URL: ${url}`, error.response?.data || error.message);
        break;
      }
    }
  }

  const accountsUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token,category&limit=100`;
  await fetchWithPagination(accountsUrl, (pagesData) => {
    pagesData.forEach(p => {
      pagesMap.set(p.id, { id: p.id, name: p.name, access_token: p.access_token, category: p.category || 'Page' });
    });
  });

  const bizUrl = `https://graph.facebook.com/v21.0/me/businesses?access_token=${accessToken}&limit=100`;
  let businesses = [];
  try {
    let bUrl = bizUrl;
    while (bUrl) {
      const bizRes = await axios.get(bUrl, axiosCfg);
      if (bizRes.data && bizRes.data.data) {
        businesses = businesses.concat(bizRes.data.data);
      }
      bUrl = bizRes.data.paging && bizRes.data.paging.next ? bizRes.data.paging.next : null;
    }
  } catch (bizErr) {}

  for (const biz of businesses) {
    const ownedPagesUrl = `https://graph.facebook.com/v21.0/${biz.id}/owned_pages?access_token=${accessToken}&limit=100`;
    await fetchWithPagination(ownedPagesUrl, (pagesData) => pagesData.forEach(p => pagesMap.set(p.id, { id: p.id, name: p.name, access_token: p.access_token, category: p.category || 'Business Owned Page' })));

    const clientPagesUrl = `https://graph.facebook.com/v21.0/${biz.id}/client_pages?access_token=${accessToken}&limit=100`;
    await fetchWithPagination(clientPagesUrl, (pagesData) => pagesData.forEach(p => pagesMap.set(p.id, { id: p.id, name: p.name, access_token: p.access_token, category: p.category || 'Business Client Page' })));
  }

  return Array.from(pagesMap.values());
}

async function postToPage(pageId, pageAccessToken, message, mediaPath = null, proxyConfig = null) {
  const axiosCfg = getAxiosConfig(proxyConfig);

  try {
    if (mediaPath && fs.existsSync(mediaPath)) {
      const mimeType = mime.lookup(mediaPath) || 'application/octet-stream';
      const form = new FormData();
      form.append('access_token', pageAccessToken);
      
      let url = '';
      if (mimeType.startsWith('image/')) {
        url = `https://graph.facebook.com/v21.0/${pageId}/photos`;
        if (message) form.append('message', message);
        form.append('source', fs.createReadStream(mediaPath));
      } else if (mimeType.startsWith('video/')) {
        url = `https://graph.facebook.com/v21.0/${pageId}/videos`;
        if (message) form.append('description', message);
        form.append('source', fs.createReadStream(mediaPath));
      } else {
        throw new Error(`Unsupported media type: ${mimeType}`);
      }

      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        ...axiosCfg
      });
      return response.data;
    } else {
      const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
      const response = await axios.post(url, {
        message: message,
        access_token: pageAccessToken
      }, axiosCfg);
      return response.data;
    }
  } catch (error) {
    console.error(`Error posting to page ${pageId}:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message || 'Unknown graph API error');
  }
}

module.exports = { fetchAllPages, postToPage, buildProxyAgent, getAxiosConfig };
