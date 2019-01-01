---
layout: post
title: Ruby から ffi を使って Rust を呼ぶ
date: 2019-01-01 13:03:45
tag: [rust, ruby, ffi]
---

## なにするの

あけおめです。

最近少し C を勉強しています。目的としては Ruby のソースコードを読めるようになりたいとか、 native extension 周りのトラブルに対応したいとか、自分で `lib~~` のラッパー書いてみたいとか、そんな感じ。

C 自体の勉強もいいんですけど、後半の方の目的を考えてさっきまで `ffi` の使い方を調べていました。

普通に C をコンパイルしてできた shared object を呼び出しても飽きるので、 Ruby と同じくらい好きな Rust で処理を書いてそれを呼び出そうと思います。

## まずは簡単な関数と dylib ファイルを

こんな感じの簡単な関数を Rust で書きます。
マングリングされちゃうと外部から呼ぶのが難しくなってしまうので、 no_mangle オプションを利用します。

```rust
#[no_mangle]
pub extern fn foo() {
    println!("Hi, I'm called from Rust!");
}
```

これを `test1.rs` とでもして保存しておきましょう。

その上で `--crate-type="dylib"` オプションをつけてコンパイルしてあげましょう。

`rustc --crate-type="dylib" test.rs`

そうすると `librust.dylib` というファイルができるかなと思います。

一応 `nm` コマンドを使ってちゃんとシンボルテーブル内に `foo` 関数があることを確認してみます。

```
$ nm libtest.dylib | rg foo
0000000000001380 T _foo
```

大丈夫そうですね。

## Ruby から呼び出します

あとは Rust 特有のパターンはあまりなさそうですね。

出来上がった `dylib` ファイルを指定した上で `attach_function` してあげれば問題ないでしょう。

```ruby
require 'ffi'

module LibTest
  extend FFI::Library

  ffi_lib 'libtest.dylib'

  attach_function :foo, [], :int
end

LibTest::foo
```

さて、実行してみます。

```
$ bundle exec ruby call_rust.rb
Hi, I'm called from Rust!
```

良さそうですね。

## もうちょっと難しい関数を呼び出してみる

これ以上特に難しいことはないんですが、一応ベンチマーク取ってみたいと思います。

fibonacci してみましょう。

### 純 Ruby の場合

```ruby
def fib(n)
  return 1 if n <= 1

  fib(n-1) + fib(n-2)
end
```

### Rust called from Ruby の場合

```rust
#[no_mangle]
pub extern fn fib(n: i32) -> i32 {
    if n <= 1 {
        return 1;
    }

    fib(n-1) + fib(n-2)
}
```

```ruby
require 'ffi'

module Fib
  extend FFI::Library

  ffi_lib 'libfib.dylib'

  attach_function :fib, %i[int], :int
end
```

### ざっくりベンチマーク

上の二つのスクリプトをくっつけて、まとめてベンチマーク取ってみます。

```ruby
require 'benchmark'
require 'ffi'

module Fib
  extend FFI::Library

  ffi_lib 'libfib.dylib'

  attach_function :fib, %i[int], :int
end

def fib(n)
  return 1 if n <= 1

  fib(n-1) + fib(n-2)
end

Benchmark.bm 15 do |bm|
  bm.report 'pure Ruby' do
    fib(40)
  end
  bm.report 'Rust from Ruby' do
    Fib.fib(40)
  end
end
```

### 結果

```
$ bundle exec ruby fib.rb
                      user     system      total        real
pure Ruby        10.723500   0.012867  10.736367 ( 10.761758)
Rust from Ruby    1.490607   0.001886   1.492493 (  1.496130)
```

やはり Rust を呼び出している方が速いですね、なるほど。

#### JIT 付きの場合

せっかくなので Ruby 2.6 で JIT オプションを有効にしたパターンで呼び出してみましょう。

僕の勘だと fib メソッドのような同じメソッドを多く呼び出すケースは JIT で最適化されて速くなると思うんですが...。

```
$ bundle exec ruby --jit fib.rb
                      user     system      total        real
pure Ruby         6.652373   0.086251  12.121539 (  7.010239)
Rust from Ruby    1.812068   0.007281   2.963557 (  1.829464)
```

よかったです。純粋な Ruby の方は 30% くらい削減されましたね。
逆に Rust を呼び出す方は 30% くらい実行時間が増加していて、同じメソッドを多く呼び出さないケースでは JIT を行うオーバーヘッドの影響の方が大きいということもわかったみたいです。

## References

- [ruby-ffi](https://github.com/ffi/ffi)
- [今回使ったコード](https://github.com/furuhama/ruby_sandbox/tree/master/lib/ffi)
