---
layout: post
title:  "Webのコンセプト"
date:   2018-02-11 12:00:00 +0900
tag: [web]
---

[Goならわかるシステムプログラミング](http://ascii.jp/elem/000/001/235/1235262/)の[第6回](http://ascii.jp/elem/000/001/276/1276572/)を読んでいて、ネットワーク通信についてあまり理解していないなと思った。
そこでネットワーク通信技術の前提となるwebページの考え方(特にREST)、モチベーションなどについて調べてまとめることにする。

### 通信のレイヤとプロトコル

|レイヤの名称|プロトコル|
|--|--|
|アプリケーション層|HTTP|
|トランスポート層|TCP/UDP/QUIC|
|インターネット層|IP|
|リンク層|Wi-Fi/イーサネット|


--

参考:

- [Goならわかるシステムプログラミング](http://ascii.jp/elem/000/001/235/1235262/)
- [Goならわかるシステムプログラミング 第6回 - GoでたたくTCPソケット(前編)](http://ascii.jp/elem/000/001/276/1276572/)
- [RailsのAPIにHATEOASを散りばめてみる : RESTの拡張、HATEOASの詳解と実装例](http://postd.cc/sprinkle-some-hateoas-on-your-rails-apis/)
- [奥さんに REST をどう説明したかというと…](http://www.geocities.jp/yamamotoyohei/rest/rest-to-my-wife.htm)
