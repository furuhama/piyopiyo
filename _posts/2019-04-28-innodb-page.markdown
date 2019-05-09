---
layout: post
title: InnoDB はどうやってファイルにデータを保持するのか
date: 2019-04-28 23:17:51
tag: [mysql, db, innodb]
---

今日は MySQL のストレージエンジンとして有名な InnoDB がデータをどうやってディスク上に保持しているのかについて。

半分くらいは翻訳記事と言えなくもない。

## 基本的な構造

### space

InnoDB は内部的に `space` という仮想的なデータの単位を持つ。 これは MySQL のリファレンスとかだと `tablespace` と呼ばれることもある。 `space` はファイルシステム上では複数のファイルに分かれていることもあるが、論理的には一つのファイルとして扱われる。

`space` は 32-bit integer の ID を持つ。

InnoDB は必ず `system space` と呼ばれる `space` を持っており、これは ID 0 で表現される。

MySQL では一つのテーブルが一つの `space` を持つという構造になっている。(だから多分 InnoDB をストレージエンジンにしていると、テーブルは使える ID の個数に対応して 16383(=16384 - 1) 個くらいしか作れないんだと思う)

### page

`space` は `page` という単位で構成される。

これは基本的に `16KB` のサイズを持っていて、それぞれの `page` は 32-bit integer の ID を持つ(これを `offset` と呼んでいる)。

なので `64 TB` までしかデータを保持することができない(16KB * 32-bit)。

## space の内部構造

実際には `space` という論理的な単位だとサイズが不定で色々と都合が悪い。そこで `space` と `page` の中間単位として `extent` というものがある。(`extent` はデフォルトで `page` が 64 個分、つまり 1 MB になっている)

すごくざっくりと説明すると `space` の内部構造は、 `extent` が 256 個ごとにその先頭 `page` にメタ情報を保持するヘッダ `page` がやってくる、という連続的な構造になっている。ただし `space` の 0 番目の `page` のみ `space` 全体に対するメタ情報も持つ。

このメタ情報を持つ `page` のうち、 `space` の先頭のものを `FSP_HDR` (file space header) と呼び、それに続く 256 の `extent` の先頭のものを `XDES` (extent descriptor) と呼ぶ。

`FSP_HDR` と `XDES` の次には必ず `IBUF_BITMAP` と呼ばれる insert buffering に関わる `page` が置かれる。

また `FSP_HDR` に続く `IBUF_BITMAP` の後には `INODE` と呼ばれる index に関わる `page` が置かれる。

以下、 `system space` と `per-table space` の場合に分けて詳しく見ていく。

### system space の場合

先頭の `FSP_HDR`, `IBUF_BITMAP`, `INODE` page に続いて以下の type を持つ page が置かれる。

- SYS
  - insert buffering に関するメタデータを保持する。
- INDEX
  - insert buffering に使われる index の root となっている。
- TRX_SYS
  - 最新のトランザクション ID や binlog の情報、 double write buffer のある extent の場所などを保持する。
- SYS
  - rollback 時に備えて保持しておくデータを持つ。
- SYS
  - data disctionary に関するメタデータを保持する。

また 64 - 127 番目と 128 - 191 番目の page には double write buffer に使われる。

### per-table space の場合

先頭の 3 つの page に続いて定義順に index の root の page が配置される。つまり 4 番目 の page にクラスタインデックスの root が来ることになる。

## page の内部構造

`page` はそれぞれ `FIL Header`, `FIL Trailer` と呼ばれる 38 byte のヘッダと 8 byte のトレイラを持つ。残りは肝心の中身。

### ヘッダの構成

- Checksum: 4 bytes
- Offset: 4 bytes
  - Page の ID 。
- Previous Page: 4 bytes
  - InnoDB の index は B+Tree であり前後のページへの参照を保持しておくことで range でデータを引く時に効率的に引けるようにしている。
- Next Page: 4 bytes
  - 同上。
- LSN for last page modification: 8 bytes
  - Log Sequence Number のこと。 InnoDB は Redo log などを使って fail tolerance を実現しており、この page に最後に行なった log に対応する ID を保持している。ここでは 64-bit で保持している。
- Page Type: 2 bytes
  - `page` 自体のメタ情報はヘッダで持つ。 `page` はテーブルデータあるいは index だけでなく undo log や blob, data dictionary, トランザクションなどの用途で用いられるため。
- Flush LSN (0 except space 0 page 0): 8 bytes
  - `system space` の `0` 番ページ以外では使っていない値。システム全体として一番最後に flush まで行なった LSN を保持する。
- Space ID: 4 bytes
  - 属する space の ID 。

### トレイラの構成

- Old-style Checksum: 4 bytes
  - deprecate になっているけどまだ残っている
- Low 32-bits of LSN: 4 bytes
  - ヘッダで持っている LSN の 32-bit 版。

## 参考

- [MySQL :: MySQL 5.7 Reference Manual :: 14.6.3 Tablespaces](https://dev.mysql.com/doc/refman/5.7/en/innodb-tablespace.html)
- [The basics of InnoDB space file layout](https://blog.jcole.us/2013/01/03/the-basics-of-innodb-space-file-layout/)
- [Page management InnoDB space files](https://blog.jcole.us/2013/01/04/page-management-in-innodb-space-files/)
