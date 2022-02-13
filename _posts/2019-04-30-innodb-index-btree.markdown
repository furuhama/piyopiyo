---
layout: post
title: InnoDB の B+Tree Index について
date: 2019-04-29 19:59:05 +0900
tag: [mysql, db, innodb]
---

やっと B+Tree Index まできた...。

## InnoDB における index の B+Tree の構造

InnoDB の B+Tree Index はディスクからの読み出しに対して最適化された構造になっている。

root page, leaf page, non-leaf page(internal page) で構成される。

root page は必ず一つ。そこから leaf page もしくは internal page への参照を持つ。

全ての leaf page は同じ level に存在し、その level を 0 として扱う。

leaf page では infimum レコードから始まって supremum レコードまで次のレコードへの参照が続く single-linked list の構造を持っている。そして infimum と supremum レコードの間の user record は index を構成する key 値と value 値を持つ。

internal page では leaf page 同様に infimum から始まり supremum まで続く single-linked list 構造だが、子供となる internal/leaf page の最小の key 値とその pgae へのポインタを持つ。

同じ level に属する page 同士はそれぞれ次の page と前の page へのポインタも持っている。

## 参考

- [B+Tree index structures in InnoDB](https://blog.jcole.us/2013/01/10/btree-index-structures-in-innodb/)
- [MySQL with InnoDB のインデックスの基礎知識とありがちな間違い - クックパッド開発者ブログ](https://techlife.cookpad.com/entry/2017/04/18/092524)
- [B+ tree - Wikipedia](https://en.wikipedia.org/wiki/B%2B_tree)
