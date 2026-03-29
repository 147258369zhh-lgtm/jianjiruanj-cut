use serde_json::Value;

#[tokio::main]
async fn main() {
    let client = reqwest::Client::new();
    
    // Test Kuwo
    let url = "http://search.kuwo.cn/r.s?all=钢琴&ft=music&itemset=web_2013&client=kt&pn=0&rn=5&rformat=json&encoding=utf8";
    match client.get(url).send().await {
        Ok(resp) => {
            let text = resp.text().await.unwrap();
            println!("Kuwo Search: {}", text);
        },
        Err(e) => println!("Kuwo err: {}", e)
    }

    // Test Kuwo Audio URL
    let audio = "http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_119420601&format=mp3&response=url";
    match client.get(audio).send().await {
        Ok(resp) => println!("Kuwo URL: {:?}", resp.text().await.unwrap()),
        Err(e) => println!("Kuwo URL err: {}", e)
    }
}
