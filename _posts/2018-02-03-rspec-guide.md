---
layout: post
title:  "Rspecのまとめ"
date:   2018-02-03 16:50:00 +0900
tag: [ruby]
---

Rspec が苦手なので、大事なことをメモ

- 基本的な書き方

{% highlight ruby %}

describe 'テスト対象' do # => '#インスタンスメソッド' '.クラスメソッド'
 context '条件' do
    it '結果' do # => テスト内容で自明なら ''は省略で、 it {}

{% endhighlight %}

