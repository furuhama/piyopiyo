---
layout: post
title: Puma の内部構造やアーキテクチャを追う
date: 2019-12-01 21:27:54
tag: [ruby, rails, puma]
---

## 背景

ECS みたいなコンテナ環境で Rails アプリケーションを動かすときに、アプリサーバに何を採用するか問題がある。

スレッドセーフな Rails アプリが書けていて、使っている gem も全部問題なさそうな人は多分 puma 一択でいいと思う。

そうじゃなくて歴史ある Rails アプリであるがゆえに全体がスレッドセーフなコードなのか、利用ライブラリも全部スレッドセーフな実装になっているのか、という点が判断しづらいケースにおいてどうするといいのかを考えたい。

その場合最近の流行りとかも考慮すると大きく分けて 2 つの選択肢がありそうな気がしている。

- プロセスとスレッドが 1:1 の関係になっているような Unicorn を選ぶ
- プロセスとスレッドが 1:N の関係になっているけど N=1 に設定した上で puma を選ぶ

普通に考えたら前者でいいじゃんってなるんですが、そこでややこしくなってくるのが ECS だとコンテナ内のアプリプロセスに対して graceful な shutdown を要求する際に SIGTERM を送る。けど Unicorn は SIGTERM で即死してしまうようになっていて、 Unicorn 自体は SIGQUIT で graceful shutdown を行う。なのでこの差分をシグナルハンドラ書いてマップする必要が出てくる。

じゃあ後者の可能性を探ると、 puma は SIGTERM でちゃんと graceful な shutdown を行ってくれる。よしこれはいいぞってことで、 puma をシングルスレッドな設定で動かせば、もしかするとあまり難しいことをせずに Rails が ECS 環境で動かせるようになるんじゃないの、みたいな話をしていたのがこの調査の始まり。
更にいうと Rails も標準では puma を使うようになっているし、シグナル以外の観点でも puma に乗れると何かと楽そうな気もしている。
でも軽く調べると https://github.com/puma/puma/pull/1425/files や https://github.com/puma/puma/issues/531#issuecomment-48828357 みたいな話も出てきたりして、ほんとに大丈夫なんだっけ？！？！みたいな気持ちになっている。からちゃんと調べる。

(シングルスレッドで動かすとなるとリソース効率みたいな点は望めなくなってしまうし、ちゃんとマルチスレッドで動かしているときと比較してコストが相対的に多くなってしまいうるのは仕方ないかなーという気持ち。そこは会社としてお金かけてスレッドセーフなアプリにするために時間使うとかそういうことしないと駄目だよね)

## 問題になりそうだなと思っていること

1 プロセス内で複数スレッドが上がり、共通のリソースを同時に書き換えるパターン。なので 1 プロセスで複数スレッド作って複数リクエストを同時に受けるのはやっぱりきついと思う。初期化だけ複数スレッドでやることがある、とかならまだいけるのかも。

## 前提

puma v4.3.0

## 実験

まずは puma が外側から見たときにどういう挙動になるのかを触ってみがてら実験してみる。
puma の config で workers 値と threads 値をいじれるのでそれを変化させる。

{% highlight ruby %}
# frozen_string_literal: true

bind 'tcp://localhost:3000'

workers M
threads N, N

environment 'development'
{% endhighlight %}

そしてほぼ 1 秒ぴったしでレスポンスを返すエンドポイントを作る。

{% highlight ruby %}
# frozen_string_literal: true

class SlowEndpointsController < ApplicationController
  def show
    puts 'Started to wait 1 second'
    sleep 1
    puts 'waiting ends'

    head :ok
  end
end
{% endhighlight %}

クライアントからは並列でリクエスト投げたいので

{% highlight ruby %}
# frozen_string_literal: true

require 'faraday'

time = Time.now
threads = []
trials = 3

(1..trials).each do |i|
  t = Thread.new do
    puts "#{i} time start"
    Faraday.get 'http://localhost:3000/slow_endpoint' # 試したいエンドポイント
    puts "#{i} time end"
  end
  threads.push t
end

threads.each(&:join)

took = Time.now - time

puts "It takes #{took/trials} seconds per request"
puts "It takes #{took} seconds for #{trials} requests"
{% endhighlight %}

この前提で、 puma のレスポンスを返却するプロセスの数に対して、クライアントから見たときにリクエストを並行で受けられるとレースコンディション起こりうる状態のはずなので(単一の puma プロセスで複数リクエストを同時に受けていることになるので)、それが問題ないかを検証してみる。

ちなみに僕は途中までよく理解してなかったんだけど、 `workers` の値を 0 にした場合と 1 にした場合は挙動が異なっていて、前者は master プロセスでリクエストを受けるし、後者はワーカープロセスを一つ立ててそこでリクエストを受けるっぽい。(考えてみたら当たり前)
リクエストを受け取ってレスポンスを返却するプロセスの数という意味だとどちらも 1 つなので、今回のレースコンディションのケアの話だとそこは問題にならないっぽいんだけど他の理由からどっちを使うべきかの話というのは出てきそう。

#### 0 worker, 1 thread

```
workers 0
threads 1, 1
```

結果はこんな感じ

```
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
3 time end
1 time end
It takes 1.0434803333333333 seconds per request
It takes 3.130441 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
1 time end
3 time end
It takes 1.0632603333333333 seconds per request
It takes 3.189781 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
3 time end
2 time end
1 time end
It takes 1.0426356666666667 seconds per request
It takes 3.127907 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
3 time end
2 time end
1 time end
It takes 1.0452386666666666 seconds per request
It takes 3.135716 seconds for 3 requests
```

全部 1 秒くらいで終わっているので問題なさそう。

#### 0 worker, 2 threads

じゃあ設定を変えるとちゃんと リクエスト回数 * 1 秒 かからないのか

```
workers 0
threads 2, 2
```

```
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
1 time end
3 time end
It takes 0.8126483333333333 seconds per request
It takes 2.437945 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
3 time end
2 time end
1 time end
It takes 0.7088506666666667 seconds per request
It takes 2.126552 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
1 time end
3 time end
It takes 0.7305796666666667 seconds per request
It takes 2.191739 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
1 time end
3 time end
2 time end
It takes 0.7067406666666667 seconds per request
It takes 2.120222 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
3 time start
2 time start
3 time end
1 time end
2 time end
It takes 0.7069683333333333 seconds per request
It takes 2.120905 seconds for 3 requests
```

ふむ素晴らしい。 2 thread に対して 3 requests を一気に投げているので、一度に 2 つを処理してその後速かった thread が 1 つ処理するという話になってそう。平均の値の意味があんまりなくなってるけど、まあ今回の趣旨じゃない実験なのでいいかな。

#### 1 worker, 1 thread

上の方で

> `workers` の値を 0 にした場合と 1 にした場合は挙動が異なっていて、前者は master プロセスでリクエストを受けるし、後者はワーカープロセスを一つ立ててそこでリクエストを受けるっぽい。(考えてみたら当たり前)
リクエストを受け取ってレスポンスを返却するプロセスの数という意味だとどちらも 1 つ

とか書いてるけどほんとかよって話があると思う。

```
workers 1
threads 1, 1
```

```
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
3 time end
2 time end
1 time end
It takes 1.1501386666666666 seconds per request
It takes 3.450416 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
3 time start
2 time start
3 time end
1 time end
2 time end
It takes 1.0699333333333334 seconds per request
It takes 3.2098 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
1 time end
3 time end
It takes 1.0447886666666666 seconds per request
It takes 3.134366 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
1 time end
3 time end
It takes 1.0412743333333332 seconds per request
It takes 3.123823 seconds for 3 requests
```

となり大体 1 sec/1 req なのであってそう。

#### 2 workers, 1 thread

では(Unicorn 的に)ワーカープロセスを増やすというアプローチでリクエストの処理を並列化したらどうなるのか。

```ruby
workers 2
threads 1, 1
```

```
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
3 time end
1 time end
It takes 0.7936256666666667 seconds per request
It takes 2.380877 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
3 time end
1 time end
2 time end
It takes 0.7036326666666667 seconds per request
It takes 2.110898 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
2 time start
3 time start
2 time end
1 time end
3 time end
It takes 0.704265 seconds per request
It takes 2.112795 seconds for 3 requests
(′•_•) be ruby test.rb
1 time start
3 time start
2 time start
3 time end
1 time end
2 time end
It takes 0.7153186666666667 seconds per request
It takes 2.145956 seconds for 3 requests
```

クライアントから見た場合には 0 worker, 2 threads のケースとほぼ同じになったので、期待した通りと言って良さそう。

### ちなみにどこでスレッドが生成されているのか

vendoring している puma gem の `lib/puma.rb` の頭の方で

```ruby
module ThreadTracer
  def new(*arg, **kwarg, &block)
    cl = caller.first

    puts cl if cl.include?('puma')

    super(*arg, **kwarg, &block) # 関係ないけどこの辺ってもっと簡単に書けないんだっけ...
  end
end

Thread.singleton_class.prepend ThreadTracer
```

とかってパッチを仕込むといい感じに bunlder 経由で読み込まれ始めてから puma 上で Thread を作ったところがわかりそう。

先程と同様 M, N の workers 値と threads 値を変化させてみる。(ちなみに以下のログでは、ほんとは caller ってフルパスでバックトレースをくれるけど邪魔 & 不要なので編集してます)

#### 0 worker, 1 thread

```
( '-') be puma -C puma.rb
Puma starting in single mode...
* Version 4.3.0 (ruby 2.6.5-p114), codename: Mysterious Traveller
* Min threads: 1, max threads: 1
* Environment: development
* Listening on tcp://127.0.0.1:4449
Use Ctrl-C to stop
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:89:in `spawn_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/reactor.rb:310:in `run_in_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/server.rb:354:in `run'
```

#### 1 worker, 1 thread

```
( '-') be puma -C puma.rb
[41782] Puma starting in cluster mode...
[41782] * Version 4.3.0 (ruby 2.6.5-p114), codename: Mysterious Traveller
[41782] * Min threads: 1, max threads: 1
[41782] * Environment: development
[41782] * Process workers: 1
[41782] * Phased restart available
[41782] * Listening on tcp://127.0.0.1:4449
[41782] Use Ctrl-C to stop
./vendor/bundle/gems/puma-4.3.0/lib/puma/cluster.rb:248:in `worker'
./vendor/bundle/gems/puma-4.3.0/lib/puma/cluster.rb:284:in `worker'
[41782] - Worker 0 (pid: 41806) booted, phase: 0
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:89:in `spawn_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/reactor.rb:310:in `run_in_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/server.rb:354:in `run'
```

#### 0 worker, 2 threads

```
( '-') be puma -C puma.rb
Puma starting in single mode...
* Version 4.3.0 (ruby 2.6.5-p114), codename: Mysterious Traveller
* Min threads: 2, max threads: 2
* Environment: development
* Listening on tcp://127.0.0.1:4449
Use Ctrl-C to stop
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:89:in `spawn_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:89:in `spawn_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/reactor.rb:310:in `run_in_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/server.rb:354:in `run'
```

#### 2 workers, 1 thread

```
( '-') be puma -C puma.rb
[43765] Puma starting in cluster mode...
[43765] * Version 4.3.0 (ruby 2.6.5-p114), codename: Mysterious Traveller
[43765] * Min threads: 1, max threads: 1
[43765] * Environment: development
[43765] * Process workers: 2
[43765] * Phased restart available
[43765] * Listening on tcp://127.0.0.1:4449
[43765] Use Ctrl-C to stop
./vendor/bundle/gems/puma-4.3.0/lib/puma/cluster.rb:248:in `worker'
./vendor/bundle/gems/puma-4.3.0/lib/puma/cluster.rb:248:in `worker'
./vendor/bundle/gems/puma-4.3.0/lib/puma/cluster.rb:284:in `worker'
[43765] - Worker 1 (pid: 43779) booted, phase: 0
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:89:in `spawn_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/reactor.rb:310:in `run_in_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/server.rb:354:in `run'
[43765] - Worker 0 (pid: 43778) booted, phase: 0
./vendor/bundle/gems/puma-4.3.0/lib/puma/cluster.rb:284:in `worker'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:89:in `spawn_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/reactor.rb:310:in `run_in_thread'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/thread_pool.rb:258:in `start!'
./vendor/bundle/gems/puma-4.3.0/lib/puma/server.rb:354:in `run'
```

### ドキュメントを読む

https://github.com/puma/puma/tree/master/docs
ドキュメントの類はここに並んでいる

https://github.com/puma/puma/blob/master/docs/architecture.md
とりあえずこれを読む。

https://github.com/puma/puma/blob/master/docs/architecture.md#connection-pipeline
特にこれの図を読むとわかりやすいと思うけど

- クライアントからのリクエストを Accept することでできるコネクションの TCP socket をワーカープロセスごとにバッファリング(Accept して socket 作るところもワーカーがやるのかな?)
    - 調べてわかったけど Accept して TCP socket 作るのもワーカーがやる。全体の構造としては、全ワーカーは同じ host, port で待ち構えている(`Puma::Binder` がどこと bind しているのかを表現するモデルなんだけど、これをそれぞれのワーカーが `Puma::Server` のインスタンスのインスタンス変数として持っている。)
    - https://github.com/puma/puma/blob/v4.3.0/lib/puma/server.rb#L367-L383 この辺りを見るとわかるんだけど、 複数プロセスで同じ接続用のポートに用意している socket に対して while loop を回して `IO.select` でコネクション張れたものを随時見つけて accept していくということをしている
        - `IO.select` 自体はブロッキングな命令なので、複数ワーカーで同じポートでのリクエストを待ち構えていると同じリクエストに対して複数のワーカーの `IO.select` がリターンしてくるということは普通にある(デバッグコード仕込んで眺めたので間違いないと思う)
            - つまりクライアントからリクエストが来るまではここで待機する https://github.com/puma/puma/blob/v4.3.0/lib/puma/server.rb#L383
        - このとき bind を tcp のアドレスと行っていた場合には `TCPServer#accept_nonblock` を読んでいて、これはブロックせずにすぐに結果が帰ってくる accept システムコールだと思う。(たぶん `EAGAIN` か `EWOULDBLOCK` のエラーを貰ったらすぐにリターンするようにしているのだと思われ。)
        - ここでノンブロッキングなシステムコールを発行しているのは、上に書いたように 1 つのリクエストに対して複数のワーカーで待っている人たちがいると、彼らが一度に accept を発行しにいくアーキテクチャになっているから。カジュアルに accept がうまく行かないケースがあるのでノンブロッキングにして次のループに早いところ入るのは重要。
            - accept() が失敗したときは https://github.com/puma/puma/blob/v4.3.0/lib/puma/server.rb#L403-L404 に来る
- ワーカープロセスの中でワーカースレッドで一人でも暇な子ができたら、`Puma::Reactor` インスタンスの socket 見る用のスレッドが動いて、バッファリングされた TCP socket を見てリクエストを最後まで受け取ったかを判定する(後述してるけどここは nio4r 使って見てる)。最後まで受け取ったらクライアントからのリクエストとしてはサーバー側でそれ以上なにかする必要はないので、リクエスト内容をワーカープロセスがプロセス全体で持ってる todo リストに詰める。
- ワーカースレッドは暇になったら todo リストを一個ずつ貰ってレスポンス作るところまで頑張る

みたいな流れ。

---

ちなみに `queue_requests` っていうオプションがあって上はそれが有効になっているパターン。(デフォルトで有効)
もしそれを無効にした場合 Accept してソケットを作成するところからリクエストを全部受け取るところまでを一緒に行って、いきなり todo リストに突っ込むということをする。
(queue_requests を無効にすることによって、有効にした場合とどういう差が出るのかイマイチわからない。例えばコネクションが出来てからクライアントからリクエストが送られてくるときにすんごく遅いクライアントがいる、という状況を考える。コネクション(TCP socket)ごとのリクエスト内容の受け取りはサーバープロセスから見てノンブロッキングに行えるとすると、コネクションの待機列をぐるぐる眺めて終わっているやつから todo リストに突っ込んでいけばいいから、コネクション張ったもののリクエスト送りきるのが遅いクライアントが一人いても他の人達を先にさばけるようになるから嬉しそうではある。けどコネクションに紐づくリクエストの受け取りってそもそも非同期にやってもらえるのかわかってないなー ~~コード読んで調べる~~ => 調べた :point_down: )

TCP socket が出来てからそれぞれのリクエストが完了してるかどうかチェックして、 todo に突っ込んでいくのは `Puma::Reactor` の責務。以下のドキュメントを見るとわかるけど、 `nio4r` を使って(実態は `libev` か `IO#select`) socket に紐づくデータの変更とかリクエストが完了しているのかとかを上手いこと取っているみたい。
https://github.com/puma/puma/blob/v4.3.0/lib/puma/reactor.rb#L21-L34

---

色々書いたけどつまるところ今回気にすべきは最後の todo に積まれたリクエストを並列で処理しないように気をつけるところだけだからそんなに難しくなさそうだ。

- ワーカー内での thread の生成は簡単で、 thread の管理は `Puma::ThreadPool` が責務を持っていて https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L56-L58 で実際の生成をやっている
- `Puma::ThreadPool` はどこで作られるかというと `Puma::Server#run` 内の https://github.com/puma/puma/blob/v4.3.0/lib/puma/server.rb#L295-L334 で作られる

ここ読んだ限りだとちゃんと設定で指定した thread が生成されて利用されるので問題なさそう

元々 puma のドキュメントに、 threads を `1:1` に設定しても内部的に Thread 使うことあるよーって書いてあったのは Reactor とかの話であって、ユーザーが書いた Rack アプリケーションのコードが実行される部分はちゃんとあの設定を見てくれている

### ちなみにどこでスレッドが生成されているのか(puma のコード読む編)

上の復習的な内容になるけれども一応ちゃんと追ってみる。

- レスポンスを生成する部分は `Puma::ThreadPool` によって管理された Thread が行うが、まずその生成を行う箇所は https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L86-L149 ここ。ここで設定値の最小のスレッド数になるまで mutex を取りながら Thread を作っていく。
- さらに `Puma::ThreadPool` では過剰に thread が出来ていたり、 alive な状態でない thread が出来ているとそれを刈り取る人が別 thread で動いている。 https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L216-L244 この辺に定義されたメソッドを実行するための https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L246-L281 の処理がある
- リクエストのコネクションを眺めてリクエストが終わったかのチェックは `Puma::Reactor` が行う。これは本体とは別 Thread で行われる処理であり https://github.com/puma/puma/blob/v4.3.0/lib/puma/reactor.rb#L309-L323 で Thread が作られる。
- ワーカープロセスごとに `Puma::Server` っていうのが上がってそれが ThreadPool 持っていたり Reactor 持っていたりするんだけど、 Server が動き始めるときにモードによっては本体が別 Thread で動く https://github.com/puma/puma/blob/v4.3.0/lib/puma/server.rb#L282-L362

### そういえば 1 worker あたり 1 thread の設定で動かしたらうまいこと SIGTERM で graceful shutdown するの

thread の数はあまり関係なくて、 cluster モードの場合(worker が 1 以上の場合)には `Puma::Launcher` から `Puma::Cluster` が呼ばれるときに `setup_signals` が呼ばれて設定される。 https://github.com/puma/puma/blob/17035b0ee95019bb8b2ae93e0a2405f5262bf6ff/lib/puma/cluster.rb#L366-L400
その後 cluster 内で fork することによって worker プロセスが生えるので彼らも同じ signal のトラップの設定は持っている。
worker が 0 のときは `Puma::Launcher` から `Puma::Single` がそのまま呼ばれる。そこで `Puma::Launcher` で設定した `setup_signals` https://github.com/puma/puma/blob/17035b0ee95019bb8b2ae93e0a2405f5262bf6ff/lib/puma/launcher.rb#L409-L466 が呼ばれてトラップできるようになる。

### check ってなに

ワーカープロセスのステータス管理に使っているっぽい IO オブジェクトというところまではわかったけど、マスターからワーカー向きの通信ってどうしているのか詳細はまだよくわかってない、ざっくりみた感じ pipe 使ってるっぽい

### thread に alive っていうステータスフラグがあったり、 thread が指定した数より多くなるケースをケアしているのなんで

コメントにも書いたけど、なんで trim とか reap とか必要なのかちゃんと考えてなかった。ので調べる。 https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L216-L244

まず puma のワーカースレッドの一生は https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L89-L144 に書いてあって基本的には while loop の中で work をこなし続けるというのが正常系の処理の流れ。
そして todo が空になった場合には外側から shutdown 要求の来ているケースと、単純にリクエストを全部さばいてしまって暇っていうケースがある。
shutdown の場合は thread は終わればいいのでそこで while loop を抜けて死ぬ(このとき `@workers` という変数に管理されているワーカースレッド群から自分を消して終わり)。
リクエストを全部さばいてしまって暇な場合では別スレッドで `auto_trim!` ってやつが動いていて、ユーザーが設定したスレッド数の min になるまで trim_request というのが送られてくる(送られてくると言っても実態はただ共有しているだけの Integer 値)。これが 1 以上で、しかもワーカースレッドが自分も暇だと思ったら、じゃあ退場しますって言って死ぬ。(つまりこの仕組みを trim が提供している。これで前者の疑問は解消したと思う。)

さらに上記前提の上で後者の reap の疑問を考える。そもそも `Thread#alive?` ってよく知らなかったんだけど Ruby の標準ライブラリの Thread クラスで生えているインスタンスメソッドみたいで、正常終了や例外終了したスレッドの場合に false を返してくれるらしい。
 ワーカースレッドは上に書いたような一生をたどるわけだけど、想定外の例外が起きたケースには `ThreadPool` が管理している `@workers` っていう変数には Thread インスタンスは残っているけど実際には異常終了してしまって仕事してない、というケースがありうる。この場合いつまでも `@workers` にそういったスレッドを残しておく意味がないのでそれを reap が刈り取ってくれている。

### ワーカースレッドが 1 人しかいないのに異常終了したらどうなんの

上の話の続きで、今この esa の主旨としてワーカースレッド 1 つで puma を動かそうとしているわけだけど、じゃあそいつが異常終了したらどうなるのって話がある。
どうなるか気になる話として、今ワーカースレッドが処理しようと思っていたレスポンスがどうなるのかという点と、後続のリクエストはどうなるのかという点がある。

後者のほうが簡単なので後者から考える。
Reactor が ThreadPool にお仕事を渡す時には `ThreadPool#<<` が使われる。 https://github.com/puma/puma/blob/v4.3.0/lib/puma/thread_pool.rb#L153-L168
この処理を見てみると、待機中のワーカースレッド数と残 todo 数と全ワーカースレッド数とユーザー設定の max スレッド数を比較して、いい感じにワーカースレッドを作ってくれるようになっている。なので後続のリクエストが todo に突っ込まれたタイミングで元気なワーカースレッドが生まれて仕事を始める。(ここまで書いてて思ったけどすでに todo に残タスクがある状態で唯一のワーカースレッドが死んだら次 todo に変化あるまでワーカースレッド増えない...???それはちょっと困るな...)

前者を考えるために実験。 `ThreadPool#spawn_thread` に時限爆弾を仕込む。

```ruby
    # :nodoc:
    #
    # Must be called with @mutex held!
    #
    def spawn_thread
      @spawned += 1

      th = Thread.new(@spawned) do |spawned|
        Puma.set_thread_name 'threadpool %03i' % spawned
        todo  = @todo
        block = @block
        mutex = @mutex
        not_empty = @not_empty
        not_full = @not_full

        # 異常終了用のカウント変数を用意
        countdown = 1

        extra = @extra.map { |i| i.new }

        while true
          work = nil

          continue = true

          mutex.synchronize do
            while todo.empty?
              if @trim_requested > 0
                @trim_requested -= 1
                continue = false
                not_full.signal
                break
              end

              if @shutdown
                continue = false
                break
              end

              @waiting += 1
              not_full.signal
              not_empty.wait mutex
              @waiting -= 1
            end

            work = todo.shift if continue
          end

          break unless continue

          if @clean_thread_locals
            ThreadPool.clean_thread_locals
          end

          # 何回かリクエスト受けたら勝手に異常終了するようにしておく
          raise 'Countdown reached zero..' if countdown == 0
          countdown -= 1

          begin
            block.call(work, *extra)
          rescue Exception => e
            STDERR.puts "Error reached top of thread-pool: #{e.message} (#{e.class})"
          end
        end

        mutex.synchronize do
          @spawned -= 1
          @workers.delete th
        end
      end

      @workers << th

      th
    end
```

するとサーバ側のログは以下のように。

```
( o_o) be puma -C puma.rb
Puma starting in single mode...
* Version 4.3.0 (ruby 2.6.5-p114), codename: Mysterious Traveller
* Min threads: 1, max threads: 1
* Environment: development
* Listening on tcp://127.0.0.1:4449
Use Ctrl-C to stop
#<Thread:0x00007ff9668bb390@puma threadpool 001@./puma/puma/lib/puma/thread_pool.rb:89 run> terminated with exception (report_on_exception is true):
Traceback (most recent call last):
./puma/puma/lib/puma/thread_pool.rb:135:in `block in spawn_thread': Countdown reached zero.. (RuntimeError)
```

しかも kill コマンドで落とそうとしても

```
- Gracefully stopping, waiting for requests to finish
```

となりオワタ感。 SIGKILL で落とした。

クライアント側も同じように

```
( 'm') be ruby test.rb
1 time start
2 time start
3 time start
2 time end
```

で止まって、しばらく立ったら timeout エラーが出ていた。
しかもそこと別でもっかいリクエスト投げたらそっちも処理されず止まってしまっていた...。実際には少なくともシングルスレッドで動かした場合、上手いこと `ThreadPool#<<` で todo 更新されるよりも前にどっかで止まっちゃうっぽい。(まだどこなのか調べきれてない)

うーーーむ、これどうしようかなあ。そもそも puma 内で例外で異常終了するってことあんまりないと思うんだけど、とりあえず `report_on_exception` オプションで Rollbar なり開発者のわかるところに異常投げるのは必須って感じだな。
理想的にはどうなるのといいのかはもうちょっと考えて直せそうなら直してみよう...。

解決したいのは以下だな
- 異常終了したスレッドが掴んでるリクエストの切断
- worker が min 未満になってしまうケースがあるので、それの対応

## 最後に

はじめはこの調査ログを会社のドキュメント管理システムに投げていたんだけど、閉じたインターネットに置いておくべきものでもない気がしたのでここにも転載しておこうと思って載せてみました。それでは。

```
Seppuku is the only choice.
```
https://github.com/puma/puma/blob/v4.3.0/lib/puma/cluster.rb#L141

## ref

https://bogomips.org/unicorn
https://github.com/puma/puma
https://christina04.hatenablog.com/entry/socket-base
