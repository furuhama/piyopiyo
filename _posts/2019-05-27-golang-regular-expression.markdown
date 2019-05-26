---
layout: post
title: Golang の正規表現
date: 2019-05-27 06:27:54
tag: [golang, regexp]
---

検索という処理を自由に効率良く行うのは夢があるなと常々思っていたんだけど、正規表現すらちゃんとわかっていなかったのでその実装をちょっと調べてみようと思った。(その上で簡単なものを自分で実装できるといいなーって)

Golang なら標準ライブラリが全部 Golang で書かれているはずだし、 C 読むよりは簡単かなと思った。

ということで Golang の正規表現ライブラリを眺めてみたログ

対象のバージョンは `1.12.5`

## おおまかな流れ

正規表現と文字列を与えてマッチするかどうかを Boolean で返すような処理を考える

```
正規表現形式の文字列を受け取る (regexp.Compile)

-> パースして Regexp 構造体を作る (syntax.Parse)

================================================

検索対象の文字列を受け取る (Regexp.Match)

-> マッチするかを判定する (Regexp.doExecute)
```

## Compile

`regexp` パッケージの `Compile` 関数は private な `compile` 関数のラッパーになっている。
(`MustCompile` や `CompilePOSIX` も同じ。フラグの立て方などが変わるだけ。)

今回は処理の流れを見ていくだけなので、フラグ等は全部無視する。
https://github.com/golang/go/blob/go1.12.5/src/regexp/regexp.go#L167-L215

### Parse

内部的には `syntax` パッケージの `Parse` を呼んでいる。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/parse.go#L698-L903

この `Parse` 関数は内部的に変数 `p` と `t` を持っていて、これらに操作を行うことでパース(コンパイル)を行なっている。

`p` は `parser` 構造体を表している。いくつかのアトリビュートを持っているが、重要なのは `stack` だと思う。これは `Regexp` 構造体へのポインタのスライスになっている。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/parse.go#L79-L86

ここでいう `Regexp` 構造体は `regexp` パッケージに定義されているものとは異なる。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/regexp.go#L16-L27

`t` は正規表現形式として受け取った文字列を表している。

`Parse` 関数の内部では受け取った `t` 文字列を一文字ずつ(これは場合によっては嘘かも)読んでいって Opcode に変換し、 `parser` の `op` メソッドを利用して `Regexp` 構造体の Op アトリビュートに詰めて `stack` に積んでいく。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/parse.go#L213-L219

Opcode は以下で定義されている。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/regexp.go#L34-L58

例えば `|` オペレータはその前後を等価に扱って、どっちかにマッチするかを見る特殊文字だけど、これを表現するために正規表現はツリー的な構造になっているはず。そこで `stack` に積まれた `Regexp` 構造体を徐々にツリーにしていく `parser` の `collaspe` メソッドもある。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/parse.go#L365-L392

### Simplify

パースしてできた `syntax` の `Regexp` 構造体を、等価性を保ったまま変換していく `Simplify` メソッドを実行する。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/simplify.go#L7-L117

このメソッド内でやっていることは最適化の類だと思うので一旦スキップする。

### Compile

`Simplify` を実行した `syntax` の `Regexp` 構造体に対して `Compile` を行う。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/compile.go#L78-L87

内部的には `compiler` 構造体の `compile` メソッドを叩いている。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/compile.go#L98-L168

`compiler` 構造体は `Prog` 構造体へのポインタだけを持っていて、 `Prog` 構造体は以下のような定義になっている。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/prog.go#L16-L21

`Prog` 構造体は `Inst` 構造体のスライスを持っていて、たぶんこれがひとつの Opcode に対応するのかな。
`Inst` 構造体の定義は以下。 `Out` とか `Arg` とかっていうアトリビュートも持っているんだけど、これらがなにを表す情報なのかはいまいちわかっていない。
https://github.com/golang/go/blob/go1.12.5/src/regexp/syntax/prog.go#L111-L117

最終的に `Compile` は `Inst` の集合を表す `Prog` 構造体へのポインタを返す。

### その後...

正規表現リテラルが `Inst` 構造体の集合である `Prog` 構造体の形式にまで変換(コンパイル)されたら、それを `regexp` パッケージに定義された `Regexp` 構造体の `prog` アトリビュートに入れ他にも様々なフラグや情報を入れた上で、 `Regexp` 構造体へのポインタを返却して `regexp` パッケージの `compile` 関数は処理を終える。

ここまでが正規表現のコンパイル処理。

## Match

正規表現を用いて検索相当の処理をするために、その引数や戻り値、検索方法によって様々なメソッドが用意されている。
それらは全て `doExecute` に対してどう引数を渡すかが異なっている。
https://github.com/golang/go/blob/go1.12.5/src/regexp/exec.go#L517-L546

`doExecute` 内ではまず `Regexp` 構造体の `get` メソッドを叩いて `machine` 構造体へのポインタを取得する。
`machine` 構造体は `matchPool` にプーリングされているみたい。
https://github.com/golang/go/blob/go1.12.5/src/regexp/regexp.go#L228-L256
`matchPool` は以下で定義されている。説明読んでもいまいちなんのための最適化なのかわからないな...。
https://github.com/golang/go/blob/go1.12.5/src/regexp/regexp.go#L217-L226

この `machine` 構造体は以下のような定義になっている。これが正規表現でのいわゆるステートマシンに相当するのかな。
https://github.com/golang/go/blob/go1.12.5/src/regexp/exec.go#L37-L47

`machine` の初期化を行うなどした上で、最終的にマッチするかの判定は `machine` 構造体の `match` メソッドで行う。
https://github.com/golang/go/blob/go1.12.5/src/regexp/exec.go#L172-L243
ここでは正規表現が対象文字列に対してどうマッチしているかを `machine` 構造体の `matchcap` というアトリビュートで管理している。 `matchcap` は int のスライス型。

そのあとで `Regexp` 構造体の `put` メソッドを叩いて、 `machine` 構造体を `matchPool` に格納するみたい。
https://github.com/golang/go/blob/go1.12.5/src/regexp/regexp.go#L258-L264

最終的に `machine` 構造体の `matchcap` というアトリビュート返す。
https://github.com/golang/go/blob/go1.12.5/src/regexp/regexp.go#L93

## おわりに

という流れみたいです。

朝の空いてる時間でザーッと読んだけど、今度は詳細な処理について追ってみようかな。
理解が間違っているところもいくつかありそうな気がするし。
