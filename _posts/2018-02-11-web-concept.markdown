---
layout: post
title:  "Webのコンセプト"
date:   2018-02-11 12:00:00 +0900
tag: [web]
---

[Goならわかるシステムプログラミング](http://ascii.jp/elem/000/001/235/1235262/)の[第6回](http://ascii.jp/elem/000/001/276/1276572/)を読んでいて、ネットワーク通信についてあまり理解していないなと思った。

そこでネットワーク通信技術の前提となるwebページの考え方(特にREST)、モチベーションなどについて調べてまとめることにする。

### 通信のレイヤとプロトコル

|レイヤの名称|代表的なプロトコル|
|--|--|
|アプリケーション層|HTTP|
|トランスポート層|TCP / UDP / QUIC|
|インターネット層|IP|
|リンク層|Wi-Fi / イーサネット|

### web の基本概念

情報は全て resource であり、webページは resource の表現( representation )の一つ。

### REST のモチベーション

あらゆる情報( resource ) をURLのように階層構造への配置として表現したい。その上で、 resource に対して行いたい操作を抽象化・共通化する(ポリモーフィックな定義)ことで、あらゆる resource に対して共通の文脈から接したい。( resource に応じた個別的なことはなるべく行いたくない。)

すべての resource が RESTful な状態で配置されているとすれば、機械的に処理できる情報が増えるはず。

予め配置がわかっていることで resource 同士のリンクが張れるようになる。

### http というプロトコルのモチベーション

REST を前提に、`行いたい操作`と`対象の情報`の2つの情報によって、クライアントがサーバに対して行いたい行動が一意に定まる(はず...?)。

この2つをクライアントとサーバ間で伝達することを実現するためにできたのが http というプロトコル。

### http のメソッド

|http メソッド|意味|
|--|--|
|GET|resource の取得|
|POST|resource の作成|
|PUT|resource の作成、置換|
|PATCH|resource の部分置換|
|DELETE|resource の削除|

※ 他にも HEAD とか OPTIONS とか TRACE とか LINK とか UNLINK とかあるみたい

#### POST と PUT と PATCH の違い

POST はクライアント側で resource の親 resource を指定して更新を行う(サーバ側で resource 名が割り振られる): 行うごとに結果としての resource の状態は変化する

PUT はクライアント側で resource を指定して更新を行う: 何度行っても結果としての resource の状態は同じになる

PATCH はクライアント側で resource を指定して部分的な更新を行う( PUT に似てる)

#### REST の発展系としての HATEOAS の考え方

REST は resource の位置と resource に対するメソッドの適用ですべての情報との関わり合いを定義していた。

しかしこれだと、既知の resource に対する追加的な resource が見えないことがあった。

(例: `/piyo/user/1` に対しての `/piyo/user/1/role` は、 `/piyo/user/1` という resource のみからでは知り得ない。(もちろんリンクしてあれば別だけど))

HATEOAS の考え方ではこの問題を解決するために以下のようなアイデアを用いている。

#### HATEOAS のアイデア

```
一つのAPIまたはリソースに対してはエントリポイントは単一であるべきで、リソースの表現はそのリソース上で実行できるすべてのアクションを含むべきである
```

#### ある HATEOAS な API による例

REST の場合

{% highlight javascript %}
{
  "user": {
    "first_name": "おでん君",
    "last_name": "ハイパー",
    "age": 65536
  }
}
{% endhighlight %}

HATEOAS の場合

{% highlight javascript %}
{
  "user": {
    "first_name": "おでん君",
    "last_name": "ハイパー",
    "age": 65536,
    "links": [
      {
        "rel": "self",
        "href": "https://piyofunction.com/piyo/user/1"
      },
      {
        "rel": "roles",
        "href": "https://piyofunction.com/piyo/user/1/roles"
      }
    ]
  }
}
{% endhighlight %}

この例からわかるように HATEOAS では追加的な情報として、単一エンドポイントとしての`self`と実行できるアクションとしての`roles`がレスポンスに含まれている

--

参考:

- [Goならわかるシステムプログラミング](http://ascii.jp/elem/000/001/235/1235262/)
- [Goならわかるシステムプログラミング 第6回 - GoでたたくTCPソケット(前編)](http://ascii.jp/elem/000/001/276/1276572/)
- [RailsのAPIにHATEOASを散りばめてみる : RESTの拡張、HATEOASの詳解と実装例](http://postd.cc/sprinkle-some-hateoas-on-your-rails-apis/)
- [奥さんに REST をどう説明したかというと…](http://www.geocities.jp/yamamotoyohei/rest/rest-to-my-wife.htm)
- [PUT か POST か PATCH か？](https://qiita.com/suin/items/d17bdfc8dba086d36115)
