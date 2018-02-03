---
layout: post
title:  "Rubyを関数型っぽく扱う"
date:   2018-02-03 15:49:00 +0900
tag: [ruby, fuctional]
categories: jekyll update
---

Jekyll で Github pages はじめた。

最近、関数型言語面白いなと感じるので
Rubyでごにょごにょしてみる。

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

