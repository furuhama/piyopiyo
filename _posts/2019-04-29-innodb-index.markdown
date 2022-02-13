---
layout: post
title: InnoDB における index page のデータ構造
date: 2019-04-29 12:43:40 +0900
tag: [mysql, db, innodb]
---

一つ前の記事に引き続き、今回は index page のデータ構造について。

## InnoDB の index の性質

InnoDB は B+Tree を利用した index を基本構造としており、またデータの保持を行う際には cluster index というデータ構造を採用している。

仮に CREATE TABLE 文が発行されたタイミングで PRIMARY KEY が指定されていなかった場合には、最初に出てきた `非 NULL で UNIQUE なカラム` をベースに cluster index が構築される。

それも存在しなかった場合には暗黙的に 48-bit の `Row ID` というカラムが cluster index のベースキーとして作成される。

## index page の構造

16 KB(= 16384 bytes) で構成される page のうち、先頭 38 bytes と末尾 8 bytes は前回の記事で紹介した通り `FIL Header`, `FIL Trailer` と呼ばれるヘッダとトレイラが置かれている。この部分で前後の index page へのポインタを保持する。

それらも含めて構造を記載すると以下のようになる。

- FIL Header: 38 bytes
- Index Header: 36 bytes
  - 後述。
- FSEG Header: 20 bytes
  - index の root となっている page のみ、この index で用いている file segment へのポインタを保持している。 root 以外の page (intenal な page とか leaf page とか) では使っていないので 0 埋めされている。
- System Records: 26 bytes
  - 後述。
- User Records
  - 可変長。実際にレコードとして持っているデータが置かれる。
- (Free Space)
- Page Derectory
  - User Records にあるレコードに対して 4 つから 8 つごとのポインタを持つ。あるレコードの N 番目のカラムのみを引きたい、という場合に最適化するため。
- FIL Trailer: 8 bytes

### Index Header

36 bytes の構成は以下。

- Number of Directory Slots: 2 bytes
- Heap Top Position: 2 bytes
  - 現在 User Records で使用している領域の末尾までの offset。
- Number of Heap Records / Format Flag: 2 bytes
  - Format Flag は Number of Heap Records のある bit を用いて表現されている。 COMPACT か REDUNDANT の二値をとる。 Number of Heap Records は Garbage となったレコードも含めた総数。
- First Garbage Record Offset: 2 bytes
  - Garbage record は list 構造で保持されていて、各 Garbage record は次の Garbage record へのポインタを持つ。そしてここでは先頭の Garbage record までの offset を持っている。
- Garbage Space: 2 bytes
  - Garbage となった record の占有するバイト数。
- Last Insert Position: 2 bytes
  - 最後に insert が行われた場所までの offset。
- Page Direction: 2 bytes
  - 一つの page に対して insert がシーケンシャルに行われているのか、 ランダムに行われているのかを保持する。 insert 時にはこの Direction と最後に insert されたレコードの key と比較してどこに保持すべきかを決定する。
- Number of Inserts in Page Direction: 2 bytes
- Number of Records: 2 bytes
  - Number of Heap Records とは異なり Garbage になっていない(つまり non-deleted な)レコードの総数。
- Maximum Transaction ID: 8 bytes
  - この page 内のレコードに変更を加えたトランザクションのうち ID の最大のものの ID
- Page Level: 2 bytes
  - B+Tree においてこの page がどの level にいるのか。 Leaf page なら 0。
- Index ID: 4 bytes

### Index System Records

全ての index page は `infimum` と `supremum` と呼ばれる 2 つの system record を保持している。

`infimum` はその index page に存在するどの record よりも低く最大の key 値を持ち、next record として user record 内で最小の key 値の record を持つ。 `supremum` は対照的にどの record よりも高く最小の key 値を持つ。

これによって page 全体を走査しなくてもスキップする page というのを特定することができるっぽい。


## 参考
- [The physical structure of InnoDB index pages](https://blog.jcole.us/2013/01/07/the-physical-structure-of-innodb-index-pages/)
- [MySQL :: MySQL 5.7 Reference Manual :: 14.6.2.2 The Physical Structure of an InnoDB Index](https://dev.mysql.com/doc/refman/5.7/en/innodb-physical-structure.html)
- [MySQL :: MySQL Internals Manual :: 22.2.1 High-Altitude View](https://dev.mysql.com/doc/internals/en/innodb-page-overview.html)
