import https from 'https';

const url = 'https://music.163.com/api/search/get/web?s=' + encodeURIComponent('周杰伦') + '&type=1&offset=0&total=true&limit=2';
const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com'
    }
};

https.get(url, options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data.substring(0, 500)));
}).on('error', console.error);
