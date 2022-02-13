---
layout: post
title: Rust で wasm 使って lifegame 書いた時のメモ
date: 2018-05-13 23:00:00 +0900
tag: [rust, wasm, javascript]
---

もともとの話として、ブラウザというものは各デバイス間の差異を吸収してくれる偉いやつだなと思っていて、しかもそんなブラウザの上で、ネイティブアプリに近い性能を実現できる仕組み( asm.js とか Web Assembly とか)に興味はあった。

しかし僕は javascript をほとんど書いたことがないので、 asm.js だとつらそうだなと思ってたし、正直それまでフロントエンドの生態系にほとんど興味がなかった。

(だって、サーバーサイドで豊富な計算資源で処理を行ったり、機械のことを考えたデータ型をその構造のまま扱ったり、データベースとのやり取りを考えたりするほうが面白いじゃない？！って思う。)

そんな中 `web を支える技術` という有名な本を読んで、またエンジニア業務でどっぷりと web に関わって、 web のコンセプトとその生態系にとてつもなく感動してしまった。

そんなわけで、 WebAssembly をきっかけにフロントエンドへの取っ掛かりを作りたいなって思って、休日一日かけて Rust + WebAssembly でライフゲームを書いてみたので、その記録を残しておく。

(だいぶ前にやったんだけど、まあ、いいかな)

## tl; dr

rust で書いた wasm binary を Firefox 上で動かした。

僕の完成品は[こちら](https://github.com/furuhama/wasm_lifegame)です。

### 僕の環境

- OSX High Sierra 10.13.3
- Firefox nightly 62.0a1
  - (beta とか stable でも動くはずです)
  - (chrome には「君 buffer 使いすぎでは？！？！」みたいな怒られ方をされました)

### 必要なもの(Homebrewとか自前ビルドとかで)

- node.js
- wasm-bindgen-cli tool

## 詳しいやり方

[wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) のリポジトリに使い方は結構詳しく書いてあるので、ここを参考にするといいと思います。

あと僕は[ここ](https://rust-lang-nursery.github.io/rust-wasm/game-of-life/introduction.html)も参考にしました。

ほとんど上にあげた URL で情報は足りると思います。

### 初回起動

node の npm run コマンドにビルドからサーバースタートまでのタスクを設定してしまうと楽に開発が進められます。( package.json にて設定する。)

```
$ npm install
$ npm run build-debug && npm run serve
$ npm run build-release && npm run serve # release 版はこちら (build の option が変わるよ)
```

### 作業風景

仕組みとしては Rust で書いたコードが、 wasm-bindgen によってバイナリを読むための js コードと、 wasm バイナリに変換される

例えば Rust で定義した struct みたいなフロント側でも利用したい部分が js のコードとして変換されてて、
ライフゲームのロジック部分やメモリ(バッファ？ ブラウザの仕組みのこの辺りよくわかってない)のような資源の利用戦略部分はバイナリとして渡されて、ブラウザはそれを実行している

最初とりあえず Rust 側で定義した alert 関数を js 側で呼んでみた

![hello_alert](/images/2018-05-13-wasm-lifegame/hello_alert.png)

で、 tutorial に沿って canvas の API を利用するような形式で lifegame を実装した

この画面が動いた時は結構感動した(しかもこれ、僕が ruby で書いてターミナルで動かしていたやつよりも速そうだぞ、、、、)

![first_lifegame](/images/2018-05-13-wasm-lifegame/first_lifegame.png)

そんであとは規模を大きくしたり、画面クリックでセルの状態を反転させられるようにしたり、世代更新をスタート/ストップする仕組みをつけたり

![second_lifegame](/images/2018-05-13-wasm-lifegame/second_lifegame.png)

フロント側の処理とバックエンド側の処理がどちらも工夫のしがいがあって、とても面白かったのでした。

![third_lifegame](/images/2018-05-13-wasm-lifegame/third_lifegame.png)

## 思ったこと

- ブラウザはデバイス間のアーキテクチャの差異を埋めてくれるので偉い
- バイナリを吐く言語処理系側の実装としては、 wasm という新しいアーキテクチャが増えたような感じなので、結構大変そう
- ネイティブに負けない性能を、従来の js のみのアプリケーションよりも達成可能っぽい(?)
  - とはいえこの辺は、そもそもこのまま web で(ブラウザで)突き進むのかっていう壮大な話に繋がっていく気もする
    - つまり、web に変わる共通の基盤が求められていて、 wasm はあくまで web とネイティブの間を埋めようとするアプローチで生まれたものでしかない
    - モバイルの隆盛のおかげで UX の担保/向上が喫緊かつとても難しい問題となってそう
- 知ってる言語でフロント向けのバイナリ作れるようになるのはとてもいいと思う
  - できればこのまま javascript から完全に解放されたいなと思った
- 想像だけど、 node.js 側のデザインパターンと wasm 用言語のデザインパターンでかち合ってしまうことがある気がしていて、大きなアプリケーションは wasm 対応しようとするとかなり大変なことになりそう
  - そもそも誰が wasm 部分をメンテナンスするのかという話もある
  - プロダクションで投入するのは、よっぽどフルスタックのエンジニアがたくさんいて、状況に合わせて柔軟にメンテナンスできる状態でないときついのでは。
- フロントは面白いけど難しい(a575)

## 参考:

- [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen)
- [rust-wasm/game-of-life](https://rust-lang-nursery.github.io/rust-wasm/game-of-life/introduction.html)
