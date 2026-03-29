use reqwest::header::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".parse()?);
    headers.insert(REFERER, "https://m.music.migu.cn/".parse()?);

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()?;

    // Search Migu
    let search_url = "https://m.music.migu.cn/migumusic/h5/search/all?text=周杰伦&pageNo=1&pageSize=5";
    let resp = client.get(search_url).send().await?.text().await?;
    println!("Migu search: {}", &resp[..usize::min(resp.len(), 500)]);

    // Try a direct Migu play url for a known copyrightId (e.g. 60054701923 for a Jay song)
    // Actually the h5 play API is difficult, let's see search results first.
    Ok(())
}
