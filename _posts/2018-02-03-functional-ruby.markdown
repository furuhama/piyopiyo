---
layout: post
title:  "Rubyを関数型っぽく扱う"
date:   2018-02-03 15:49:00 +0900
tag: [ruby, fuctional]
---

Jekyll で Github pages はじめた。

最近、関数型言語面白いなと感じるので
Ruby でごにょごにょしてみる。

### Object#method

関数をオブジェクト化していじる

{% highlight ruby %}
# ふつうの関数定義
def square(x)
  x * x
end

# 関数をオブジェクト化
sq = method(:square)
# sq(2) => error

# call で呼び出す (call で呼ぶまで遅延評価している)
puts sq.call(9) # => 81
{% endhighlight %}

### Proc

ブロックを利用してみる

{% highlight ruby %}
# パターン1
def do_fn(x, &fn)
  puts fn.call(arg)
end

do_fn(16) { |x| x * x }
# => 256

# 上述の Object#method を利用しても同じことができる
def square(x)
  x * x
end

sq = method(square)

do_fn(16, &sq)
# => 256
{% endhighlight %}

& の役割を確認する

{% highlight ruby %}
def print_fn(arg, &fn)
  puts fn.class
end

print_fn(0) { |x| x }
# => Proc
# ここからわかるように & は
# ブロックを Proc に変換している(#to_proc の実行)

# パターン2 (yield)
def yield_fn(arg)
  puts yield(arg)
end

yield_fn(256) { |x| x * x }
# => 65536
{% endhighlight %}

無名関数の作成

{% highlight ruby %}
# Proc class のインスタンスをつくる(無名関数)
Proc.new { |x| x * x }
proc { |x| x * x }
lambda { |x| x * x }
->x{ x * x }
# どれも call で呼べる
# 細かい挙動は次に挙げるように Proc.new, proc と
# lambda, ->() で異なる
{% endhighlight %}

無名関数の定義の仕方による違い

{% highlight ruby %}

# 前提:
# Proc.new と proc は同じ
# lambda と -> は同じ

# 違い 1: Proc.new => 引数の数が少なくても nil で補ってくれる
#         lambda  =>  引数の数が合わないと ArgumentError が発生する

proc = Proc.new{ |a, b, c| p "#{a}, #{b}, #{c}" }
proc.call(2, 4)
# => "2, 4, " (nil で補っている)

lamb = lambda { |a, b, c| p "#{a}, #{b}, #{c}" }
lamb.call(2, 4)
# => ArgumentError: wrong number of arguments (given 2, expected 3)

lamb2 = ->(a, b, c){ p "#{a}, #{b}, #{c}" }
lamb2.call(2, 4)
# => ArgumentError: wrong number of arguments (given 2, expected 3)

# ==============

# 違い 2: return 後の挙動が異なる

# Proc.new, proc の場合
def method_proc
  proc = Proc.new { return p "proc"}
  proc.call

  p "hi, my name is furuhama"
end

method_proc
# => "proc"
# 'hi, my name is furuhama' のプリント行にまで到達する前に return を読んで
# method_proc の実行自体を終了する

# lambda, ->() の場合
def method_lambda
  lamb = lambda{ return p "nyanko"}
  lamb.call

  p "method_lambdaaaaaaaaaaaaaa"
end

method_lambda
# => "nyanko"
#    "method_lambdaaaaaaaaaaaaaa"
# 'method_lambda' は lambda 式の中の return を読んでも
# 実行を終了しない(無視する)

# 一応 proc と ->() の場合も見ておく
def small_proc
  proc = proc { return p "small proc" }
  proc.call

  p "I will never be called"
end

small_proc
# => "small proc"

def method_arrow
  arr = -> { return p "->->->" }
  arr.call

  p "remember the milk"
end

method_arrow
# => "->->->"
#    "remember the milk"

{% endhighlight %}

カリー化する(部分適用できる形にする)

{% highlight ruby %}

require 'date'

# 期間と対象日を引数として、対象日が期間に入っているかどうかを確かめる関数
# カリー化して季節を期間として定義しておくことで
# 別のタイミングで対象日を引数としてもらって確かめることができるようにする
season = lambda{|range, date| range.include? Date.parse(date).mon }.curry

# 季節の定義(もともとの関数の一つ目の引数を固定するようなイメージ)
is_spring = season[4..6]
is_summer = season[7..9]
is_autumn = season[10..12]
is_winter = season[1..3]

is_autumn['11/23']
# => true
is_summer['1/1']
# => false

# ただしカリー化して定義した関数に引数を渡すときは
# function[argument] の記法としなきゃいけないっぽい
# function(argument) だと怒られる (あくまで is_spring とかは変数なので、関数ではない)

{% endhighlight %}

to_proc 定義による拡張

{% highlight ruby %}
def try_fn(arg, &fn)
  puts fn.call(arg)
end

try_fn(2, &10) # => error

# Fixnum class に to_proc を定義するといける
class Fixnum
  def to_proc
    lambda { |x| self ** x }
  end
end

try_fn(2, &10)
# => 100
{% endhighlight %}

### Symbol#to_proc

{% highlight ruby %}
# メソッドをシンボル化したものを適用できる
# まずは適当に関数定義
class Fixnum
  def triple
    self ** 3
  end

  def three?
    self%3 == 0
  end
end

# map
(1..20).map(&:triple)
# => [1, 8, 27, 64, 125, 216, 343, 512, 729,
#     1000, 1331, 1728, 2197, 2744, 3375,
#     4096, 4913, 5832, 6859, 8000]

# select
(1..20).select(&:three?)
# => [3, 6, 9, 12, 15, 18]

# これらは以下と同値
(1..20).map { |x| x.triple }
(1..20).select { |x| x.three? }

# ちなみに inject(reduce) はこんな感じ
require 'prime'
(1..10).select(&:prime?).inject { |prod, n| prod * n }
# => 210

# シンボルを利用してこんな書き方もできる
(1..10).select(&:prime?).inject(:*)
# => 210
{% endhighlight %}

Symbol#to_proc を簡単に String に拡張してみる

{% highlight ruby %}
class String
  def to_proc
    # #send は #__send__ のエイリアス
    # obj の self というメソッドの呼び出しを行う
    # ちなみに private なメソッドも呼べちゃう
    lambda { |obj| obj.send(self) }
  end
end

(1..20).map(&'triple')
# => [1, 8, 27, 64, 125, 216, 343, 512, 729,
#     1000, 1331, 1728, 2197, 2744, 3375,
#     4096, 4913, 5832, 6859, 8000]

# うまくいった
{% endhighlight %}

Symbol#to_proc を利用してポーランド記法っぽく書く

{% highlight ruby %}
:**.to_proc[2, 16] # => 65536
:+.to_proc['rust', 'acean'] # => "rustacean"
:*.to_proc['nyaan', 2] # => "nyaannyaan"
{% endhighlight %}

### fizzbuzz をやってみる

{% highlight ruby %}
# fizzbuzz by functional way

class FizzBuzz
  def self.to_proc
    # `->n{` is ok as well
    lambda { |n|
      case n % 15
      when 0 then :FizBuzz
      when 3, 6, 9, 12 then :Fizz
      when 5, 10 then :Buzz
      else n
      end
    }
  end
end

puts (1..100).map(&FizzBuzz)
#=> 1, 2, :Fizz, 4, :Buzz, ...
{% endhighlight %}

--

参考:

- [Procを制する者がRubyを制す（嘘）](http://melborne.github.io/2014/04/28/proc-is-the-path-to-understand-ruby/)
- [Ruby block/proc/lambdaの使いどころ](https://qiita.com/kidach1/items/15cfee9ec66804c3afd2)
- [Rubyの ブロック、Proc.new、lambdaの違い](https://qiita.com/ryo-ma/items/24c46592b45775e8644d)

