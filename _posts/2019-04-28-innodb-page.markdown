---
layout: post
title: InnoDB はどうやってファイルにデータを保持するのか
date: 2019-04-28 23:17:51
tag: [mysql, db, innodb]
---

今日は MySQL のストレージエンジンとして有名な InnoDB がデータをどうやってディスク上に保持しているのかについて。

## 基本的な構造

InnoDB がディスク常に保持しているデータは `page` という単位で構成される。

これは基本的に `16KB` のサイズを持っていて、それぞれの `page` は 32-bit integer の ID を持つ。

## page の内部構造

`page` は 38 byte のヘッダと 8 byte のトレイラを持つ。




## 参考

- [The basics of InnoDB space file layout](https://blog.jcole.us/2013/01/03/the-basics-of-innodb-space-file-layout/)
