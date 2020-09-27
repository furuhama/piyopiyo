---
layout: post
title: gendoc という YAML からドキュメントを生成するコマンドを作った
date: 2020-09-28 01:54:08
tag: [rust, cli]
---

僕はローカルのテキストファイルに色々なことを書く

今ぱっと思いつく用途は以下

- このブログ記事
- 会社での 1on1
- 会社での面接の準備資料やメモ
- その時考えていて書き留めないと忘れてしまいそうなもの

このときにある程度決まったフォーマットだったり、ファイル作成時の日時をファイル名にしたかったり、都度自分でやるには手間のかかるくらいのルールを設けたいことが多い

そこで生成するファイルのファイル名や保存先のパスや生成直後の内容などをメタ的に記述しておき、どこでも同じコマンドで生成できるといいなと思った

んで久しぶりにちゃんとコード書きたかったというのもあり Rust 使って `gendoc` というコマンドを用意した(こういったツールはすでにありそうだけど、あまり大変でなさそうだし自分で使うものなので自分で実装していきたい)

リポジトリは以下

[https://github.com/furuhama/gendoc](https://github.com/furuhama/gendoc)

crates.io は以下

[https://crates.io/crates/gendoc](https://crates.io/crates/gendoc)

`meta tag` のパース部分や置換部分は実装してて結構楽しかった、 trait 境界使ってクロージャ渡す部分は割に綺麗に設計できたんじゃないかと思っている(`<input` tag に関してもうちょっとやりたいことがあるから最終的な設計は変化しているかもしれないけど)

例えばこのブログの記事ファイル生成のための `gendoc.yaml` は以下の通り

```
post:
  dir: _posts
  filename: <date:%Y-%m-%d>-<input>.markdown
  body: |
    ---
    layout: post
    title:
    date: <datetime:%Y-%m-%d %H:%M:%S>
    tag: []
    ---
minipost:
  dir: _posts/miniposts
  filename: <datetime:%Y-%m-%d-%H%M>.markdown
  body: |
    ---
    layout: post
    title:
    date: <datetime:%Y-%m-%d %H:%M:%S>
    tag: [minipost]
    ---
```

普通の記事は `gendoc post` で、 minipost は `gendoc minipost` で生成できる

作ってて思ったけどよくちょろっとスクリプト書きたいときがあるから、以下の様に Ruby なんかのスクリプトのテンプレを用意しておくのもいいかもしれない(ActiveRecord の bug report 用のファイルを参考にした)

```
ruby:
  filename: <datetime>.rb
  body: |
    # frozen_string_literal: true

    require "bundler/inline"

    gemfile(true) do
      source "https://rubygems.org"

      git_source(:github) { |repo| "https://github.com/#{repo}.git" }

      # Activate the gem you are reporting the issue against.
      gem "activerecord", "6.0.3.3"
      gem "sqlite3"
    end

    require "active_record"
    require "minitest/autorun"
    require "logger"

    # This connection will do for database-independent bug reports.
    ActiveRecord::Base.establish_connection(adapter: "sqlite3", database: ":memory:")
    ActiveRecord::Base.logger = Logger.new(STDOUT)

    ActiveRecord::Schema.define do
      create_table :authors, force: true do |t|
      end

      create_table :posts, force: true do |t|
        t.integer :author_id
      end

      create_table :comments, force: true do |t|
        t.integer :post_id
      end
    end

    class Author < ActiveRecord::Base
      has_many :posts
    end

    class Post < ActiveRecord::Base
      has_many :comments
      belongs_to :author
    end

    class Comment < ActiveRecord::Base
      belongs_to :post
    end

    class BugTest < Minitest::Test
      def test_association_stuff
        post = Post.create!
        post.comments << Comment.create!

        assert_equal 1, post.comments.count
        assert_equal 1, Comment.count
        assert_equal post.id, Comment.first.post.id
      end
    end
```
