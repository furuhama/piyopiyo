let searchData;
let idx;
const xhr = new XMLHttpRequest();

xhr.onreadystatechange = () => {
  if (xhr.readyState == 4 && xhr.status == 200) {
    const res = xhr.response;

    // データの読み出し
    searchData = Object.keys(res).map((k, idx) => {
      const obj = res[k];

      // minipost の場合にはアンカーリンクにする
      const url = obj.tags.includes('minipost') ? `/miniposts${obj.minipost_anker}` : obj.url;

      return { id: idx, title: obj.title, content: obj.content, tags: obj.tags, url: url };
    });

    // 検索用 index の構築
    idx = lunr(function() {
      this.field('id');
      this.field('title', { boost: 10 });
      this.field('content', { boost: 10 });
      this.field('tags');

      searchData.forEach((data) => {
        this.add({ id: data.id, title: data.title, content: data.content, tags: data.tags });
      });
    });
  }
};

xhr.open("GET", "/search_data.json");
xhr.responseType = 'json';
xhr.send();

const refreshSearchResult = (value) => {
  const results = [];
  // MEMO: search_data.json の読み込みが終わるまで idx は undefined
  if (idx !== undefined ) {
    // 末尾に ~<integer> をつけることで fuzzy search になる
    value = value ? value + '~1' : value;
    const qResults = idx.search(value);
    qResults.forEach((qResult) => {
      results.push(searchData[qResult.ref]);
    });
  }
  display(results);
}

const display = (results) => {
  const resultsElem = document.getElementById("results");
  resultsElem.innerHTML = "";

  if (results.length) {
    results.forEach((result) => {
      const li = document.createElement("li");
      li.innerHTML = `<a href=${result.url}>${result.title}</a>: ${result.tags}`;
      resultsElem.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No results found";
    resultsElem.appendChild(li);
  }
}
